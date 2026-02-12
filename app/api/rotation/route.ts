import { NextResponse } from "next/server";
import { getRotationStats } from "@/lib/services/sender-rotation";

/**
 * GET /api/rotation
 *
 * Get sender rotation stats and domain capacity
 */
export async function GET() {
  try {
    const stats = await getRotationStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Rotation stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
