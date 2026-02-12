import { NextRequest, NextResponse } from "next/server";
import {
  getAllDomainsWarmupStatus,
  WARMUP_SCHEDULES,
} from "@/lib/services/warmup-manager";

/**
 * GET /api/warmup
 *
 * Get warmup status for all domains
 */
export async function GET() {
  try {
    const domains = await getAllDomainsWarmupStatus();

    // Summary stats
    const summary = {
      totalDomains: domains.length,
      activeDomains: domains.filter((d) => d.isActive && !d.isPaused).length,
      pausedDomains: domains.filter((d) => d.isPaused).length,
      totalDailyCapacity: domains
        .filter((d) => d.isActive && !d.isPaused)
        .reduce((sum, d) => sum + d.dailyLimit, 0),
      totalSentToday: domains.reduce((sum, d) => sum + d.sentToday, 0),
      totalRemainingToday: domains
        .filter((d) => d.isActive && !d.isPaused)
        .reduce((sum, d) => sum + d.remainingToday, 0),
      totalBouncesToday: domains.reduce((sum, d) => sum + d.bounceCountToday, 0),
      totalComplaintsToday: domains.reduce((sum, d) => sum + d.complaintCountToday, 0),
    };

    return NextResponse.json({
      domains,
      summary,
      availableSchedules: Object.keys(WARMUP_SCHEDULES),
    });
  } catch (error) {
    console.error("[API] Warmup status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get warmup status" },
      { status: 500 }
    );
  }
}
