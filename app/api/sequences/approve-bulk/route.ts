import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences } from "@/lib/db";
import { eq, inArray, or } from "drizzle-orm";

/**
 * POST /api/sequences/approve-bulk
 *
 * Bulk approve multiple sequences
 *
 * Request body:
 * - sequenceIds: string[] - IDs of sequences to approve (optional, if not provided approves all pending)
 * - approveAll: boolean - If true, approves all pending_review and draft sequences
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sequenceIds, approveAll } = body;

    let idsToApprove: string[] = [];

    if (approveAll) {
      // Get all sequences that are pending review or draft
      const pendingSequences = await db
        .select({ id: emailSequences.id })
        .from(emailSequences)
        .where(
          or(
            eq(emailSequences.status, "pending_review"),
            eq(emailSequences.status, "draft")
          )
        );

      idsToApprove = pendingSequences.map(s => s.id);
    } else if (sequenceIds && Array.isArray(sequenceIds) && sequenceIds.length > 0) {
      idsToApprove = sequenceIds;
    } else {
      return NextResponse.json(
        { error: "No sequences specified. Provide sequenceIds array or set approveAll: true" },
        { status: 400 }
      );
    }

    if (idsToApprove.length === 0) {
      return NextResponse.json({
        success: true,
        approved: 0,
        message: "No sequences to approve",
      });
    }

    // Bulk update all specified sequences to approved
    const result = await db
      .update(emailSequences)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(inArray(emailSequences.id, idsToApprove))
      .returning({ id: emailSequences.id });

    console.log(`[Bulk Approve] Approved ${result.length} sequences`);

    return NextResponse.json({
      success: true,
      approved: result.length,
      ids: result.map(r => r.id),
    });
  } catch (error) {
    console.error("[Bulk Approve] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve sequences" },
      { status: 500 }
    );
  }
}
