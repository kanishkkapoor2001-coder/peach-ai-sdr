import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences, leads } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

/**
 * POST /api/sequences
 *
 * Create a new email sequence manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const [sequence] = await db
      .insert(emailSequences)
      .values({
        leadId: body.leadId,
        status: body.status || "draft",
        primaryAngle: body.primaryAngle,
        secondaryAngle: body.secondaryAngle,
        tertiaryAngle: body.tertiaryAngle,
        email1Subject: body.email1Subject,
        email1Body: body.email1Body,
        email2Subject: body.email2Subject,
        email2Body: body.email2Body,
        email3Subject: body.email3Subject,
        email3Body: body.email3Body,
        email4Subject: body.email4Subject,
        email4Body: body.email4Body,
        email5Subject: body.email5Subject,
        email5Body: body.email5Body,
      })
      .returning();

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error("[Sequences] Error creating:", error);
    return NextResponse.json(
      { error: "Failed to create sequence" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sequences
 *
 * Get all email sequences with their associated leads
 */
export async function GET() {
  const startTime = Date.now();
  try {
    const sequences = await db
      .select({
        id: emailSequences.id,
        leadId: emailSequences.leadId,
        primaryAngle: emailSequences.primaryAngle,
        secondaryAngle: emailSequences.secondaryAngle,
        tertiaryAngle: emailSequences.tertiaryAngle,
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
        status: emailSequences.status,
        currentEmail: emailSequences.currentEmail,
        nextSendAt: emailSequences.nextSendAt,
        createdAt: emailSequences.createdAt,
        // Lead info
        leadFirstName: leads.firstName,
        leadLastName: leads.lastName,
        leadEmail: leads.email,
        leadJobTitle: leads.jobTitle,
        leadSchoolName: leads.schoolName,
      })
      .from(emailSequences)
      .leftJoin(leads, eq(emailSequences.leadId, leads.id))
      .orderBy(desc(emailSequences.createdAt));

    // Transform the flat result into nested structure
    const transformedSequences = sequences.map((seq) => ({
      id: seq.id,
      leadId: seq.leadId,
      primaryAngle: seq.primaryAngle,
      secondaryAngle: seq.secondaryAngle,
      tertiaryAngle: seq.tertiaryAngle,
      email1Subject: seq.email1Subject,
      email1Body: seq.email1Body,
      email2Subject: seq.email2Subject,
      email2Body: seq.email2Body,
      email3Subject: seq.email3Subject,
      email3Body: seq.email3Body,
      email4Subject: seq.email4Subject,
      email4Body: seq.email4Body,
      email5Subject: seq.email5Subject,
      email5Body: seq.email5Body,
      status: seq.status,
      currentEmail: seq.currentEmail,
      nextSendAt: seq.nextSendAt,
      createdAt: seq.createdAt,
      lead: {
        firstName: seq.leadFirstName,
        lastName: seq.leadLastName,
        email: seq.leadEmail,
        jobTitle: seq.leadJobTitle,
        schoolName: seq.leadSchoolName,
      },
    }));

    const duration = Date.now() - startTime;
    console.log(`[API] GET /api/sequences - ${transformedSequences.length} sequences in ${duration}ms`);

    return NextResponse.json({
      sequences: transformedSequences,
      total: transformedSequences.length,
    });
  } catch (error) {
    console.error("[Sequences] Error fetching:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}
