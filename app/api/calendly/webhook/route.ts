import { NextRequest, NextResponse } from "next/server";
import { db, leads, meetings } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  BookingWebhookPayload,
  parseBookingWebhook,
} from "@/lib/services/calendly-client";
import { generateMeetingPrep } from "@/lib/ai/meeting-prep";
import { syncLeadToNotion } from "@/lib/services/notion-client";

/**
 * POST /api/calendly/webhook
 * Handle Calendly booking webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as BookingWebhookPayload;

    console.log(`[Calendly Webhook] Received event: ${payload.event}`);

    const booking = parseBookingWebhook(payload);

    // Find the lead by email
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, booking.email));

    if (!lead) {
      console.log(`[Calendly Webhook] Lead not found for email: ${booking.email}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true, leadFound: false });
    }

    if (booking.type === "booked") {
      // Generate meeting prep
      console.log(`[Calendly Webhook] Generating meeting prep for lead: ${lead.id}`);

      const prep = await generateMeetingPrep({
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
        leadScore: lead.leadScore,
        scoreReasons: lead.scoreReasons as string[],
      });

      // Save meeting to database
      await db.insert(meetings).values({
        leadId: lead.id,
        scheduledAt: booking.startTime,
        endTime: booking.endTime,
        eventName: booking.eventName,
        meetingUrl: booking.meetingUrl,
        status: "scheduled",
        prepDocument: prep,
        calendlyEventUri: payload.payload.event.uri,
        calendlyInviteeUri: payload.payload.invitee.uri,
      });

      // Update lead status
      await db
        .update(leads)
        .set({
          status: "meeting_booked",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      // Sync to Notion if connected
      if (process.env.NOTION_API_KEY) {
        await syncLeadToNotion(lead.id).catch((err) => {
          console.error("[Calendly Webhook] Notion sync error:", err);
        });
      }

      console.log(
        `[Calendly Webhook] Meeting scheduled for lead ${lead.id} at ${booking.startTime}`
      );

      return NextResponse.json({
        received: true,
        leadFound: true,
        meetingCreated: true,
        prepGenerated: true,
      });
    } else if (booking.type === "canceled") {
      // Update meeting status
      await db
        .update(meetings)
        .set({
          status: "canceled",
          updatedAt: new Date(),
        })
        .where(eq(meetings.leadId, lead.id));

      // Update lead status (revert to replied since they did respond)
      await db
        .update(leads)
        .set({
          status: "replied",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      console.log(`[Calendly Webhook] Meeting canceled for lead ${lead.id}`);

      return NextResponse.json({
        received: true,
        leadFound: true,
        meetingCanceled: true,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Calendly Webhook] Error:", error);
    // Always return 200 to prevent Calendly from retrying
    return NextResponse.json({
      received: true,
      error: error instanceof Error ? error.message : "Processing error",
    });
  }
}
