import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, leads, emailSequences } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// PATCH - Update campaign details (name, description, status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Filter only allowed fields
    const allowedFields = ["name", "description", "status", "senderRotation", "preferredDomainIds"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Add updatedAt
    updates.updatedAt = new Date();

    await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id));

    // Fetch updated campaign
    const [updated] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    console.error("Failed to update campaign:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// GET - Get single campaign with all leads and their sequences (OPTIMIZED: single query with LEFT JOIN)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id } = await params;

    // Get campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id));

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // OPTIMIZED: Single query with LEFT JOIN to get leads + sequences together
    const leadsWithSequencesRaw = await db
      .select({
        // Lead fields
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        emailVerified: leads.emailVerified,
        jobTitle: leads.jobTitle,
        schoolName: leads.schoolName,
        schoolCountry: leads.schoolCountry,
        leadScore: leads.leadScore,
        status: leads.status,
        researchSummary: leads.researchSummary,
        createdAt: leads.createdAt,
        // Sequence fields (will be null if no sequence exists)
        sequenceId: emailSequences.id,
        sequenceStatus: emailSequences.status,
        currentEmail: emailSequences.currentEmail,
        confidenceScore: emailSequences.confidenceScore,
        confidenceReason: emailSequences.confidenceReason,
        email1Subject: emailSequences.email1Subject,
        email1Body: emailSequences.email1Body,
        email2Subject: emailSequences.email2Subject,
        email2Body: emailSequences.email2Body,
        email3Subject: emailSequences.email3Subject,
        email3Body: emailSequences.email3Body,
        email4Subject: emailSequences.email4Subject,
        email4Body: emailSequences.email4Body,
        email5Subject: emailSequences.email5Subject,
        email5Body: emailSequences.email5Body,
        primaryAngle: emailSequences.primaryAngle,
        secondaryAngle: emailSequences.secondaryAngle,
        tertiaryAngle: emailSequences.tertiaryAngle,
      })
      .from(leads)
      .leftJoin(emailSequences, eq(emailSequences.leadId, leads.id))
      .where(eq(leads.campaignId, id));

    // Transform to expected format
    const leadsWithSequences = leadsWithSequencesRaw.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      emailVerified: row.emailVerified,
      jobTitle: row.jobTitle,
      schoolName: row.schoolName,
      schoolCountry: row.schoolCountry,
      leadScore: row.leadScore,
      status: row.status,
      researchSummary: row.researchSummary,
      createdAt: row.createdAt,
      sequence: row.sequenceId
        ? {
            id: row.sequenceId,
            status: row.sequenceStatus,
            currentEmail: row.currentEmail,
            confidenceScore: row.confidenceScore,
            confidenceReason: row.confidenceReason,
            email1Subject: row.email1Subject,
            email1Body: row.email1Body,
            email2Subject: row.email2Subject,
            email2Body: row.email2Body,
            email3Subject: row.email3Subject,
            email3Body: row.email3Body,
            email4Subject: row.email4Subject,
            email4Body: row.email4Body,
            email5Subject: row.email5Subject,
            email5Body: row.email5Body,
            primaryAngle: row.primaryAngle,
            secondaryAngle: row.secondaryAngle,
            tertiaryAngle: row.tertiaryAngle,
          }
        : null,
    }));

    // Calculate summary stats (in-memory, fast since we already have the data)
    const stats = {
      totalLeads: leadsWithSequences.length,
      noSequence: leadsWithSequences.filter((l) => !l.sequence).length,
      pendingReview: leadsWithSequences.filter(
        (l) => l.sequence?.status === "pending_review"
      ).length,
      approved: leadsWithSequences.filter(
        (l) => l.sequence?.status === "approved"
      ).length,
      active: leadsWithSequences.filter(
        (l) => l.sequence?.status === "active"
      ).length,
      highConfidence: leadsWithSequences.filter(
        (l) => l.sequence && (l.sequence.confidenceScore || 0) >= 8
      ).length,
      needsReview: leadsWithSequences.filter(
        (l) =>
          l.sequence &&
          (l.sequence.confidenceScore || 0) < 8 &&
          l.sequence.status === "pending_review"
      ).length,
      autoApprovable: leadsWithSequences.filter(
        (l) =>
          l.sequence &&
          (l.sequence.confidenceScore || 0) >= 8 &&
          l.sequence.status === "pending_review"
      ).length,
      replied: leadsWithSequences.filter((l) => l.status === "replied").length,
      meetingBooked: leadsWithSequences.filter(
        (l) => l.status === "meeting_booked"
      ).length,
    };

    const duration = Date.now() - startTime;
    console.log(
      `[API] GET /api/campaigns/${id} - ${leadsWithSequences.length} leads in ${duration}ms`
    );

    return NextResponse.json({
      campaign,
      leads: leadsWithSequences,
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch campaign:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}
