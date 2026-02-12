import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { meetings, meetingPreps, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateMeetingPrep, MeetingPrepInput } from "@/lib/ai/meeting-prep";

/**
 * GET /api/meetings/[id]/prep
 *
 * Get meeting prep for a specific meeting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;

    // Get meeting first to get leadId
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Get existing prep by leadId
    const [prep] = await db
      .select()
      .from(meetingPreps)
      .where(eq(meetingPreps.leadId, meeting.leadId))
      .limit(1);

    if (prep) {
      return NextResponse.json({ prep, source: "cached" });
    }

    return NextResponse.json(
      { error: "No meeting prep found. Use POST to generate." },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Meeting Prep] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting prep" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meetings/[id]/prep
 *
 * Generate meeting prep for a specific meeting
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { regenerate = false } = body;

    // Get meeting
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Check for existing prep if not regenerating
    if (!regenerate) {
      const [existingPrep] = await db
        .select()
        .from(meetingPreps)
        .where(eq(meetingPreps.leadId, meeting.leadId))
        .limit(1);

      if (existingPrep) {
        return NextResponse.json({ prep: existingPrep, source: "cached" });
      }
    }

    // Get lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, meeting.leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found for this meeting" },
        { status: 404 }
      );
    }

    // Generate prep
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

    // Delete existing prep if regenerating
    if (regenerate) {
      await db
        .delete(meetingPreps)
        .where(eq(meetingPreps.leadId, meeting.leadId));
    }

    // Store the prep - using only fields that exist in the schema
    const [savedPrep] = await db
      .insert(meetingPreps)
      .values({
        leadId: lead.id,
        rundown: prep.prospectSummary,
        talkingPoints: prep.talkingPoints,
        questionsToAsk: prep.discoveryQuestions,
        potentialObjections: prep.objections,
        calendlyEventUri: meeting.calendlyEventUri,
        meetingScheduledAt: meeting.scheduledAt,
      })
      .returning();

    return NextResponse.json({
      prep: {
        ...savedPrep,
        // Map to expected frontend format
        prospectSummary: savedPrep.rundown,
        discoveryQuestions: savedPrep.questionsToAsk,
        objections: savedPrep.potentialObjections,
      },
      source: "generated",
    });
  } catch (error) {
    console.error("[Meeting Prep] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate meeting prep" },
      { status: 500 }
    );
  }
}
