import { NextRequest, NextResponse } from "next/server";
import { markAsRead } from "@/lib/services/reply-processor";

/**
 * POST /api/inbox/[id]/read
 * Mark a message as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await markAsRead(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Inbox] Error marking as read:", error);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
