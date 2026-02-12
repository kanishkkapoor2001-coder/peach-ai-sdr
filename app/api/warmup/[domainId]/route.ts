import { NextRequest, NextResponse } from "next/server";
import {
  updateWarmupSchedule,
  resumeDomain,
  WarmupScheduleType,
  WARMUP_SCHEDULES,
} from "@/lib/services/warmup-manager";

/**
 * PATCH /api/warmup/[domainId]
 *
 * Update warmup settings for a domain
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const body = await request.json();
    const { schedule, customLimit, action } = body;

    // Handle resume action
    if (action === "resume") {
      const success = await resumeDomain(domainId);
      if (!success) {
        return NextResponse.json(
          { error: "Domain not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Domain resumed",
      });
    }

    // Validate schedule
    if (schedule && !Object.keys(WARMUP_SCHEDULES).includes(schedule)) {
      return NextResponse.json(
        { error: "Invalid warmup schedule" },
        { status: 400 }
      );
    }

    // Update schedule
    if (schedule) {
      const success = await updateWarmupSchedule(
        domainId,
        schedule as WarmupScheduleType,
        customLimit
      );

      if (!success) {
        return NextResponse.json(
          { error: "Domain not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Warmup schedule updated to ${schedule}`,
        schedule,
        customLimit: schedule === "custom" ? customLimit : undefined,
      });
    }

    return NextResponse.json(
      { error: "No action specified" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Warmup update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update warmup" },
      { status: 500 }
    );
  }
}
