import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendingDomains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getFullDomainHealth } from "@/lib/services/domain-health";

/**
 * GET /api/domains/health-summary
 * Get health summary for all active domains
 *
 * Query params:
 * - refresh=true: Force refresh all domains (slow!)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // Get all active domains
    const domains = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.isActive, true));

    if (domains.length === 0) {
      return NextResponse.json({
        domains: [],
        summary: {
          total: 0,
          excellent: 0,
          good: 0,
          warning: 0,
          critical: 0,
          unchecked: 0,
          averageScore: 0,
        },
      });
    }

    // Check if we need to refresh any domains
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const domainsNeedingRefresh = forceRefresh
      ? domains
      : domains.filter(d => !d.lastHealthCheck || d.lastHealthCheck < oneHourAgo);

    // Refresh domains that need it (in parallel, max 5 at a time)
    if (domainsNeedingRefresh.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < domainsNeedingRefresh.length; i += batchSize) {
        const batch = domainsNeedingRefresh.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (domain) => {
            try {
              const health = await getFullDomainHealth(domain.domain);

              const blacklistMap: Record<string, boolean> = {};
              health.blacklists.forEach(bl => {
                blacklistMap[bl.name] = bl.listed;
              });

              await db
                .update(sendingDomains)
                .set({
                  spfStatus: health.spf.valid ? "valid" : health.spf.record ? "invalid" : "missing",
                  dkimStatus: health.dkim.valid ? "valid" : "missing",
                  dkimSelector: health.dkim.selector || null,
                  dmarcStatus: health.dmarc.valid ? "valid" : "missing",
                  dmarcPolicy: health.dmarc.policy || null,
                  mxStatus: health.mx.valid ? "valid" : "invalid",
                  blacklistStatus: blacklistMap,
                  isBlacklisted: health.isBlacklisted,
                  healthScore: health.score,
                  healthStatus: health.status,
                  lastHealthCheck: new Date(),
                  healthRecommendations: health.recommendations,
                  updatedAt: new Date(),
                })
                .where(eq(sendingDomains.id, domain.id));
            } catch (error) {
              console.error(`[Health] Error checking ${domain.domain}:`, error);
            }
          })
        );
      }
    }

    // Re-fetch domains with updated health data
    const updatedDomains = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.isActive, true));

    // Calculate summary
    const summary = {
      total: updatedDomains.length,
      excellent: 0,
      good: 0,
      warning: 0,
      critical: 0,
      unchecked: 0,
      averageScore: 0,
    };

    let totalScore = 0;
    let scoredCount = 0;

    updatedDomains.forEach(d => {
      if (d.healthStatus === "excellent") summary.excellent++;
      else if (d.healthStatus === "good") summary.good++;
      else if (d.healthStatus === "warning") summary.warning++;
      else if (d.healthStatus === "critical") summary.critical++;
      else summary.unchecked++;

      if (d.healthScore !== null) {
        totalScore += d.healthScore;
        scoredCount++;
      }
    });

    summary.averageScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

    // Format domain data for response
    const domainData = updatedDomains.map(d => ({
      id: d.id,
      domain: d.domain,
      fromEmail: d.fromEmail,
      fromName: d.fromName,
      sendingMethod: d.sendingMethod,
      isActive: d.isActive,
      isPaused: d.isPaused,
      pauseReason: d.pauseReason,
      health: {
        score: d.healthScore,
        status: d.healthStatus,
        lastCheck: d.lastHealthCheck,
        spf: d.spfStatus,
        dkim: d.dkimStatus,
        dmarc: d.dmarcStatus,
        mx: d.mxStatus,
        isBlacklisted: d.isBlacklisted,
        recommendations: d.healthRecommendations || [],
      },
      warmup: {
        startDate: d.warmupStartDate,
        schedule: d.warmupSchedule,
        sentToday: d.sentToday,
        dailyLimit: d.dailyLimit,
      },
      throttling: {
        currentDelayMs: d.currentDelayMs,
        bounceCountToday: d.bounceCountToday,
        complaintCountToday: d.complaintCountToday,
      },
    }));

    return NextResponse.json({
      domains: domainData,
      summary,
      refreshedCount: domainsNeedingRefresh.length,
    });
  } catch (error) {
    console.error("[API] Health summary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get health summary" },
      { status: 500 }
    );
  }
}
