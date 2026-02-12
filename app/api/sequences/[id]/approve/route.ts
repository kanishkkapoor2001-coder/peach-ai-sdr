import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * POST /api/sequences/[id]/approve
 *
 * Approve a sequence for sending
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [updated] = await db
      .update(emailSequences)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(emailSequences.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Sequence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sequence: updated,
    });
  } catch (error) {
    console.error("[Sequence Approve] Error:", error);
    return NextResponse.json(
      { error: "Failed to approve sequence" },
      { status: 500 }
    );
  }
}
