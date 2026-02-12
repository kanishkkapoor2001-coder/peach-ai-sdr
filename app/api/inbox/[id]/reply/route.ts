/**
 * INBOX REPLY ROUTE - LOCKED FUNCTIONALITY
 * =========================================
 *
 * CRITICAL: This route handles sending replies to leads from the inbox.
 *
 * KEY BEHAVIOR (DO NOT CHANGE WITHOUT EXPLICIT REQUEST):
 * 1. Replies MUST come from the SAME email address that originally contacted the lead
 * 2. Sender matching priority:
 *    a) Original outbound email's fromEmail (most recent)
 *    b) Inbound message's toEmail (what they replied to)
 *    c) SMTP_FROM_EMAIL environment variable
 *    d) SMTP_USER environment variable
 * 3. fromName is looked up from sendingDomains table if domain matches
 *
 * This ensures thread continuity and prevents confusion for recipients.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, inboxMessages, leads, sendingDomains, meetings } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { sendReply } from "@/lib/services/email-sender";
import {
  createMeetingInviteAttachment,
  createCalendarAlternative,
} from "@/lib/services/calendar-invite";
import { generateMeetingPrep } from "@/lib/ai/meeting-prep";
import { syncLeadToNotion } from "@/lib/services/notion-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      body: replyBody,
      subject: customSubject,
      meetingTime,
      meetingDuration,
      meetingTitle,
    } = body;

    if (!replyBody) {
      return NextResponse.json(
        { error: "Reply body is required" },
        { status: 400 }
      );
    }

    const [result] = await db
      .select({
        message: inboxMessages,
        lead: leads,
      })
      .from(inboxMessages)
      .innerJoin(leads, eq(inboxMessages.leadId, leads.id))
      .where(eq(inboxMessages.id, id));

    if (!result) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const { message, lead } = result;

    // =========================================================================
    // SENDER MATCHING LOGIC - LOCKED (DO NOT MODIFY WITHOUT EXPLICIT REQUEST)
    // =========================================================================
    // Priority: originalOutbound.fromEmail > message.toEmail > SMTP_FROM_EMAIL > SMTP_USER
    // This ensures replies come from the SAME email that originally contacted the lead

    // Step 1: Find the most recent outbound email to this lead
    const [originalOutbound] = await db
      .select({
        fromEmail: inboxMessages.fromEmail,
      })
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.leadId, lead.id),
          eq(inboxMessages.direction, "outbound")
        )
      )
      .orderBy(desc(inboxMessages.createdAt))
      .limit(1);

    // Step 2: Determine fromEmail with fallback chain
    let fromEmail = "";
    let senderSource = "";

    if (originalOutbound?.fromEmail) {
      fromEmail = originalOutbound.fromEmail;
      senderSource = "original_outbound";
    } else if (message.toEmail) {
      fromEmail = message.toEmail;
      senderSource = "inbound_to_email";
    } else if (process.env.SMTP_FROM_EMAIL) {
      fromEmail = process.env.SMTP_FROM_EMAIL;
      senderSource = "smtp_from_email";
    } else if (process.env.SMTP_USER) {
      fromEmail = process.env.SMTP_USER;
      senderSource = "smtp_user";
    }

    // Step 3: Determine fromName from sendingDomains or env
    let fromName = process.env.SMTP_FROM_NAME || process.env.SMTP_USER || "";

    if (fromEmail) {
      const emailDomain = fromEmail.split("@")[1];
      if (emailDomain) {
        const [matchingDomain] = await db
          .select()
          .from(sendingDomains)
          .where(eq(sendingDomains.domain, emailDomain))
          .limit(1);

        if (matchingDomain?.fromName) {
          fromName = matchingDomain.fromName;
        }
      }
    }

    // Step 4: Validate we have a sender
    if (!fromEmail) {
      console.error("[Reply] FAILED: No sender email found. Checked: originalOutbound, message.toEmail, SMTP_FROM_EMAIL, SMTP_USER");
      return NextResponse.json(
        { error: "No sending identity available. Please configure SMTP settings or add a domain." },
        { status: 500 }
      );
    }
    // =========================================================================
    // END SENDER MATCHING LOGIC
    // =========================================================================

    console.log(`[Reply] Sender resolved: ${fromEmail} (source: ${senderSource}, fromName: ${fromName})`);

    const subject = customSubject ||
      (message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);

    let icsAttachment: { filename: string; content: string; contentType: string } | undefined;
    let icsAlternative: { contentType: string; content: string } | undefined;
    let meetingId: string | undefined;

    if (meetingTime) {
      const startTime = new Date(meetingTime);
      const duration = meetingDuration || 30;
      const title = meetingTitle || `Call with ${lead.firstName} ${lead.lastName}`;

      meetingId = crypto.randomUUID();

      const inviteOptions = {
        meetingId,
        title,
        startTime,
        durationMinutes: duration,
        description: `Meeting scheduled via Peach AI SDR`,
        organizerName: fromName,
        organizerEmail: fromEmail,
        attendeeName: `${lead.firstName} ${lead.lastName}`,
        attendeeEmail: lead.email,
      };

      icsAttachment = createMeetingInviteAttachment(inviteOptions);
      icsAlternative = createCalendarAlternative(inviteOptions);
    }

    const { messageId: sentMessageId, error } = await sendReply({
      from: `${fromName} <${fromEmail}>`,
      to: message.fromEmail,
      subject,
      text: replyBody,
      inReplyTo: message.messageId || undefined,
      icsAttachment,
      icsAlternative,
    });

    if (error) {
      console.error("[Reply] SMTP error:", error);
      return NextResponse.json(
        { error: error || "Failed to send reply" },
        { status: 500 }
      );
    }

    // Update sending domain counter if we're using a tracked domain
    if (fromEmail) {
      const emailDomain = fromEmail.split("@")[1];
      const [domainRecord] = await db
        .select()
        .from(sendingDomains)
        .where(eq(sendingDomains.domain, emailDomain))
        .limit(1);

      if (domainRecord) {
        await db
          .update(sendingDomains)
          .set({ sentToday: (domainRecord.sentToday || 0) + 1 })
          .where(eq(sendingDomains.id, domainRecord.id));
      }
    }

    await db.insert(inboxMessages).values({
      leadId: lead.id,
      sequenceId: message.sequenceId,
      direction: "outbound",
      fromEmail,
      toEmail: message.fromEmail,
      subject,
      body: replyBody,
      threadId: message.threadId,
      inReplyTo: message.messageId,
      messageId: sentMessageId,
      isRead: true,
    });

    await db
      .update(inboxMessages)
      .set({ aiDraftApproved: true })
      .where(eq(inboxMessages.id, id));

    let meetingCreated = false;
    if (meetingTime && meetingId) {
      const startTime = new Date(meetingTime);
      const duration = meetingDuration || 30;
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      const title = meetingTitle || `Call with ${lead.firstName} ${lead.lastName}`;

      let prepDocument = null;
      try {
        prepDocument = await generateMeetingPrep({
          firstName: lead.firstName,
          lastName: lead.lastName,
          jobTitle: lead.jobTitle,
          email: lead.email,
          schoolName: lead.schoolName,
          schoolWebsite: lead.schoolWebsite,
          schoolCountry: lead.schoolCountry,
          curriculum: lead.curriculum as string[],
          annualFeesUsd: lead.annualFeesUsd,
          studentCount: lead.studentCount,
          deviceAccess: lead.deviceAccess,
          researchSummary: lead.researchSummary,
          linkedinUrl: lead.linkedinUrl,
          leadScore: lead.leadScore,
          scoreReasons: lead.scoreReasons as string[],
          leadId: lead.id, // Pass leadId for conversation context
        });
      } catch (prepError) {
        console.error("[Reply] Failed to generate meeting prep:", prepError);
      }

      await db.insert(meetings).values({
        id: meetingId,
        leadId: lead.id,
        scheduledAt: startTime,
        endTime,
        eventName: title,
        status: "scheduled",
        prepDocument,
      });

      await db
        .update(leads)
        .set({
          status: "meeting_booked",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      meetingCreated = true;

      console.log(
        `[Reply] Meeting scheduled for lead ${lead.id} at ${startTime.toISOString()}`
      );
    } else {
      await db
        .update(leads)
        .set({
          status: "replied",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
    }

    if (process.env.NOTION_API_KEY) {
      syncLeadToNotion(lead.id).catch((err) => {
        console.error("Notion sync error:", err);
      });
    }

    return NextResponse.json({
      success: true,
      messageId: sentMessageId,
      meetingCreated,
      meetingId,
    });
  } catch (error) {
    console.error("[Inbox] Error sending reply:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reply" },
      { status: 500 }
    );
  }
}
