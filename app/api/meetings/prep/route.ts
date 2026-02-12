import { NextRequest, NextResponse } from "next/server";
import { db, leads, meetings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateMeetingPrep, MeetingPrep } from "@/lib/ai/meeting-prep";

/**
 * GET /api/meetings/prep?leadId=xxx
 * Get or generate meeting prep for a lead
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    // Check for existing meeting with prep
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.leadId, leadId))
      .orderBy(meetings.scheduledAt);

    if (meeting?.prepDocument) {
      return NextResponse.json({
        prep: meeting.prepDocument as MeetingPrep,
        meetingId: meeting.id,
        scheduledAt: meeting.scheduledAt,
        source: "existing",
      });
    }

    // No existing prep, check if lead exists
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Generate new prep with person-specific context
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
      linkedinUrl: lead.linkedinUrl,
      leadScore: lead.leadScore,
      scoreReasons: lead.scoreReasons as string[],
      leadId: lead.id, // For conversation history analysis
    });

    return NextResponse.json({
      prep,
      leadId: lead.id,
      source: "generated",
    });
  } catch (error) {
    console.error("[API] Meeting prep error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get prep" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meetings/prep
 * Generate and save meeting prep for a scheduled meeting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, leadId, regenerate = false } = body;

    if (!meetingId && !leadId) {
      return NextResponse.json(
        { error: "meetingId or leadId is required" },
        { status: 400 }
      );
    }

    let meeting;
    let lead;

    if (meetingId) {
      // Get meeting and its lead
      [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));

      if (!meeting) {
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 404 }
        );
      }

      // Return existing if not regenerating
      if (meeting.prepDocument && !regenerate) {
        return NextResponse.json({
          prep: meeting.prepDocument as MeetingPrep,
          meetingId: meeting.id,
          source: "existing",
        });
      }

      [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, meeting.leadId));
    } else {
      // Get lead directly
      [lead] = await db.select().from(leads).where(eq(leads.id, leadId));

      // Check for existing meeting
      [meeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.leadId, leadId))
        .orderBy(meetings.scheduledAt);
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Generate prep with person-specific context
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
      linkedinUrl: lead.linkedinUrl,
      leadScore: lead.leadScore,
      scoreReasons: lead.scoreReasons as string[],
      leadId: lead.id, // For conversation history analysis
    });

    // Save to meeting if exists
    if (meeting) {
      await db
        .update(meetings)
        .set({
          prepDocument: prep,
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, meeting.id));

      return NextResponse.json({
        prep,
        meetingId: meeting.id,
        source: "regenerated",
      });
    }

    return NextResponse.json({
      prep,
      leadId: lead.id,
      source: "generated",
    });
  } catch (error) {
    console.error("[API] Meeting prep error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate prep",
      },
      { status: 500 }
    );
  }
}
