import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET /api/sequences/[id] - Get a single sequence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sequence = await db
      .select()
      .from(emailSequences)
      .where(eq(emailSequences.id, id))
      .limit(1);

    if (!sequence.length) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json({ sequence: sequence[0] });
  } catch (error) {
    console.error("Error fetching sequence:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

// PATCH /api/sequences/[id] - Update a sequence
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Filter only allowed fields
    const allowedFields = [
      "email1Subject", "email1Body", "email1Approved",
      "email2Subject", "email2Body", "email2Approved",
      "email3Subject", "email3Body", "email3Approved",
      "email4Subject", "email4Body", "email4Approved",
      "email5Subject", "email5Body", "email5Approved",
      "primaryAngle", "secondaryAngle", "tertiaryAngle",
      "status",
    ];

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
      .update(emailSequences)
      .set(updates)
      .where(eq(emailSequences.id, id));

    // Fetch updated sequence
    const updated = await db
      .select()
      .from(emailSequences)
      .where(eq(emailSequences.id, id))
      .limit(1);

    return NextResponse.json({ sequence: updated[0] });
  } catch (error) {
    console.error("Error updating sequence:", error);
    return NextResponse.json(
      { error: "Failed to update sequence" },
      { status: 500 }
    );
  }
}

// DELETE /api/sequences/[id] - Delete a sequence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.delete(emailSequences).where(eq(emailSequences.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sequence:", error);
    return NextResponse.json(
      { error: "Failed to delete sequence" },
      { status: 500 }
    );
  }
}
