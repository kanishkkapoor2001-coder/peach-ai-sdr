import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { touchpointTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH - Update a sequence step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await request.json();

    // Filter only allowed fields
    const allowedFields = [
      "stepNumber",
      "channel",
      "delayDays",
      "subject",
      "body",
      "preferredTimeOfDay",
      "personalizationNotes",
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

    const [updatedStep] = await db
      .update(touchpointTemplates)
      .set(updates)
      .where(eq(touchpointTemplates.id, stepId))
      .returning();

    if (!updatedStep) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ step: updatedStep });
  } catch (error) {
    console.error("Error updating step:", error);
    return NextResponse.json(
      { error: "Failed to update step" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a sequence step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;

    const [deletedStep] = await db
      .delete(touchpointTemplates)
      .where(eq(touchpointTemplates.id, stepId))
      .returning();

    if (!deletedStep) {
      return NextResponse.json(
        { error: "Step not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: deletedStep });
  } catch (error) {
    console.error("Error deleting step:", error);
    return NextResponse.json(
      { error: "Failed to delete step" },
      { status: 500 }
    );
  }
}
