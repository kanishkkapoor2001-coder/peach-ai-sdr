import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getUsageStats } from "@/lib/services/usage-tracker";

// GET /api/usage - Get current usage stats for the workspace
export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const stats = await getUsageStats(workspaceId);

    if (!stats) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    );
  }
}
