import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendingDomains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getFullDomainHealth,
  getQuickDomainHealth,
  type DomainHealthReport,
} from "@/lib/services/domain-health";

/**
 * GET /api/domains/[id]/health
 * Get health report for a specific domain
 *
 * Query params:
 * - quick=true: Only check DNS, skip blacklists (faster)
 * - refresh=true: Force refresh even if recently checked
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const quick = searchParams.get("quick") === "true";
    const forceRefresh = searchParams.get("refresh") === "true";

    // Get domain from database
    const [domain] = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.id, id))
      .limit(1);

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 }
      );
    }

    // Check if we have a recent health check (within 1 hour) and not forcing refresh
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (
      !forceRefresh &&
      domain.lastHealthCheck &&
      domain.lastHealthCheck > oneHourAgo &&
      domain.healthScore !== null
    ) {
      // Return cached health data
      return NextResponse.json({
        domain: domain.domain,
        cached: true,
        checkedAt: domain.lastHealthCheck,
        score: domain.healthScore,
        status: domain.healthStatus,
        spf: { valid: domain.spfStatus === "valid" },
        dkim: { valid: domain.dkimStatus === "valid", selector: domain.dkimSelector },
        dmarc: { valid: domain.dmarcStatus === "valid", policy: domain.dmarcPolicy },
        mx: { valid: domain.mxStatus === "valid" },
        isBlacklisted: domain.isBlacklisted,
        blacklists: domain.blacklistStatus,
        recommendations: domain.healthRecommendations || [],
      });
    }

    // Perform health check
    let healthData: any;

    if (quick) {
      const quickHealth = await getQuickDomainHealth(domain.domain);
      healthData = {
        domain: domain.domain,
        cached: false,
        checkedAt: new Date(),
        score: quickHealth.score,
        status: quickHealth.score >= 90 ? "excellent" : quickHealth.score >= 70 ? "good" : quickHealth.score >= 50 ? "warning" : "critical",
        spf: { valid: quickHealth.spfValid },
        dkim: { valid: quickHealth.dkimValid },
        dmarc: { valid: quickHealth.dmarcValid },
        mx: { valid: quickHealth.mxValid },
        isBlacklisted: null, // Not checked in quick mode
        blacklists: null,
        recommendations: [],
      };
    } else {
      const fullHealth = await getFullDomainHealth(domain.domain);
      healthData = {
        domain: domain.domain,
        cached: false,
        checkedAt: fullHealth.checkedAt,
        score: fullHealth.score,
        status: fullHealth.status,
        spf: fullHealth.spf,
        dkim: fullHealth.dkim,
        dmarc: fullHealth.dmarc,
        mx: fullHealth.mx,
        isBlacklisted: fullHealth.isBlacklisted,
        blacklists: fullHealth.blacklists,
        recommendations: fullHealth.recommendations,
      };

      // Update database with health data
      const blacklistMap: Record<string, boolean> = {};
      fullHealth.blacklists.forEach(bl => {
        blacklistMap[bl.name] = bl.listed;
      });

      await db
        .update(sendingDomains)
        .set({
          spfStatus: fullHealth.spf.valid ? "valid" : fullHealth.spf.record ? "invalid" : "missing",
          dkimStatus: fullHealth.dkim.valid ? "valid" : "missing",
          dkimSelector: fullHealth.dkim.selector || null,
          dmarcStatus: fullHealth.dmarc.valid ? "valid" : "missing",
          dmarcPolicy: fullHealth.dmarc.policy || null,
          mxStatus: fullHealth.mx.valid ? "valid" : "invalid",
          blacklistStatus: blacklistMap,
          isBlacklisted: fullHealth.isBlacklisted,
          healthScore: fullHealth.score,
          healthStatus: fullHealth.status,
          lastHealthCheck: new Date(),
          healthRecommendations: fullHealth.recommendations,
          updatedAt: new Date(),
        })
        .where(eq(sendingDomains.id, id));
    }

    return NextResponse.json(healthData);
  } catch (error) {
    console.error("[API] Domain health check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health check failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/[id]/health
 * Force a fresh health check and update database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get domain from database
    const [domain] = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.id, id))
      .limit(1);

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 }
      );
    }

    // Perform full health check
    const fullHealth = await getFullDomainHealth(domain.domain);

    // Update database
    const blacklistMap: Record<string, boolean> = {};
    fullHealth.blacklists.forEach(bl => {
      blacklistMap[bl.name] = bl.listed;
    });

    await db
      .update(sendingDomains)
      .set({
        spfStatus: fullHealth.spf.valid ? "valid" : fullHealth.spf.record ? "invalid" : "missing",
        dkimStatus: fullHealth.dkim.valid ? "valid" : "missing",
        dkimSelector: fullHealth.dkim.selector || null,
        dmarcStatus: fullHealth.dmarc.valid ? "valid" : "missing",
        dmarcPolicy: fullHealth.dmarc.policy || null,
        mxStatus: fullHealth.mx.valid ? "valid" : "invalid",
        blacklistStatus: blacklistMap,
        isBlacklisted: fullHealth.isBlacklisted,
        healthScore: fullHealth.score,
        healthStatus: fullHealth.status,
        lastHealthCheck: new Date(),
        healthRecommendations: fullHealth.recommendations,
        updatedAt: new Date(),
      })
      .where(eq(sendingDomains.id, id));

    return NextResponse.json({
      success: true,
      domainId: id,
      domainName: domain.domain,
      checkedAt: fullHealth.checkedAt,
      score: fullHealth.score,
      status: fullHealth.status,
      spf: fullHealth.spf,
      dkim: fullHealth.dkim,
      dmarc: fullHealth.dmarc,
      mx: fullHealth.mx,
      isBlacklisted: fullHealth.isBlacklisted,
      blacklists: fullHealth.blacklists,
      recommendations: fullHealth.recommendations,
    });
  } catch (error) {
    console.error("[API] Domain health check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health check failed" },
      { status: 500 }
    );
  }
}
