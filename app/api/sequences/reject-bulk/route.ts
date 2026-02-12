import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences } from "@/lib/db";
import { inArray } from "drizzle-orm";

/**
 * POST /api/sequences/reject-bulk
 *
 * Bulk reject multiple sequences (set status to pending_review)
 *
 * Request body:
 * - sequenceIds: string[] - IDs of sequences to reject
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sequenceIds } = body;

    if (!sequenceIds || !Array.isArray(sequenceIds) || sequenceIds.length === 0) {
      return NextResponse.json(
        { error: "No sequences specified. Provide sequenceIds array." },
        { status: 400 }
      );
    }

    // Bulk update all specified sequences to pending_review
    const result = await db
      .update(emailSequences)
      .set({
        status: "pending_review",
        updatedAt: new Date(),
      })
      .where(inArray(emailSequences.id, sequenceIds))
      .returning({ id: emailSequences.id });

    console.log(`[Bulk Reject] Rejected ${result.length} sequences`);

    return NextResponse.json({
      success: true,
      rejected: result.length,
      ids: result.map(r => r.id),
    });
  } catch (error) {
    console.error("[Bulk Reject] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject sequences" },
      { status: 500 }
    );
  }
}
