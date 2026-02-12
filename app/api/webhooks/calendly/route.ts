import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, meetings, meetingPreps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseBookingWebhook, BookingWebhookPayload } from "@/lib/services/calendly-client";
import { generateMeetingPrep, MeetingPrepInput } from "@/lib/ai/meeting-prep";

/**
 * POST /api/webhooks/calendly
 *
 * Webhook endpoint for Calendly booking events
 *
 * Calendly sends webhooks for:
 * - invitee.created (meeting booked)
 * - invitee.canceled (meeting canceled)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as BookingWebhookPayload;

    console.log("[Calendly Webhook] Received event:", payload.event);

    // Parse the webhook payload
    const booking = parseBookingWebhook(payload);

    console.log(
      `[Calendly Webhook] ${booking.type} - ${booking.email} - ${booking.eventName}`
    );

    // Find lead by email
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, booking.email.toLowerCase()))
      .limit(1);

    if (!lead) {
      console.log(`[Calendly Webhook] No lead found for email: ${booking.email}`);
      // Still return success - Calendly expects 2xx response
      return NextResponse.json({
        success: true,
        message: "No matching lead found",
      });
    }

    if (booking.type === "booked") {
      // Create meeting record
      const [meeting] = await db
        .insert(meetings)
        .values({
          leadId: lead.id,
          status: "scheduled",
          scheduledAt: booking.startTime,
          endTime: booking.endTime,
          meetingUrl: booking.meetingUrl,
          eventName: booking.eventName,
          notes: booking.answers
            ? `Form responses:\n${booking.answers
                .map((a) => `${a.question}: ${a.answer}`)
                .join("\n")}`
            : undefined,
        })
        .returning();

      console.log(`[Calendly Webhook] Created meeting ${meeting.id} for lead ${lead.id}`);

      // Update lead status to meeting_booked
      await db
        .update(leads)
        .set({
          status: "meeting_booked",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      // Generate meeting prep in background
      generateMeetingPrepAsync(lead, meeting.id).catch((err) => {
        console.error("[Calendly Webhook] Failed to generate meeting prep:", err);
      });

      return NextResponse.json({
        success: true,
        type: "booked",
        leadId: lead.id,
        meetingId: meeting.id,
        message: `Meeting scheduled for ${lead.firstName} ${lead.lastName}`,
      });
    } else if (booking.type === "canceled") {
      // Find and update meeting status
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.leadId, lead.id))
        .limit(1);

      if (existingMeeting) {
        await db
          .update(meetings)
          .set({
            status: "canceled",
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, existingMeeting.id));

        console.log(`[Calendly Webhook] Canceled meeting ${existingMeeting.id}`);
      }

      // Update lead status back to replied (they were interested but canceled)
      await db
        .update(leads)
        .set({
          status: "replied",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      return NextResponse.json({
        success: true,
        type: "canceled",
        leadId: lead.id,
        message: `Meeting canceled for ${lead.firstName} ${lead.lastName}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed",
    });
  } catch (error) {
    console.error("[Calendly Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Generate meeting prep asynchronously
 */
async function generateMeetingPrepAsync(
  lead: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    jobTitle: string;
    schoolName: string;
    schoolCountry: string | null;
    schoolType: string | null;
    curriculum: string[] | null;
    annualFeesUsd: number | null;
    researchSummary: string | null;
  },
  meetingId: string
) {
  try {
    const prepInput: MeetingPrepInput = {
      firstName: lead.firstName,
      lastName: lead.lastName || "",
      jobTitle: lead.jobTitle,
      email: lead.email,
      schoolName: lead.schoolName,
      schoolCountry: lead.schoolCountry,
      curriculum: lead.curriculum,
      annualFeesUsd: lead.annualFeesUsd,
      researchSummary: lead.researchSummary,
      leadId: lead.id,
    };

    const prep = await generateMeetingPrep(prepInput);

    // Store the prep using actual schema fields
    await db.insert(meetingPreps).values({
      leadId: lead.id,
      rundown: prep.prospectSummary,
      talkingPoints: prep.talkingPoints,
      questionsToAsk: prep.discoveryQuestions,
      potentialObjections: prep.objections,
    });

    console.log(`[Calendly Webhook] Generated meeting prep for meeting ${meetingId}`);
  } catch (error) {
    console.error("[Calendly Webhook] Failed to generate prep:", error);
    throw error;
  }
}

/**
 * GET /api/webhooks/calendly
 *
 * Verification endpoint for webhook setup
 */
export async function GET() {
  return NextResponse.json({
    status: "Calendly webhook endpoint active",
    timestamp: new Date().toISOString(),
  });
}
