import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadTouchpoints, emailEvents, campaigns } from "@/lib/db/schema";
import { eq, sql, and, isNotNull, desc, count } from "drizzle-orm";

/**
 * GET /api/track/stats
 *
 * Get email tracking statistics.
 * Query params:
 * - campaignId: Filter by campaign
 * - period: "24h", "7d", "30d", "all" (default: "7d")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const period = searchParams.get("period") || "7d";

    // Calculate date filter
    let dateFilter: Date | null = null;
    switch (period) {
      case "24h":
        dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        dateFilter = null;
    }

    // Build conditions
    const conditions = [];
    if (dateFilter) {
      conditions.push(sql`${leadTouchpoints.sentAt} >= ${dateFilter.toISOString()}`);
    }
    if (campaignId) {
      conditions.push(eq(leadTouchpoints.leadId, campaignId)); // Would need to join with leads table
    }

    // Get overall stats
    const touchpointsQuery = db
      .select({
        total: count(),
        sent: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.sentAt} IS NOT NULL THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.deliveredAt} IS NOT NULL THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.openedAt} IS NOT NULL THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.clickedAt} IS NOT NULL THEN 1 END)`,
        replied: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.repliedAt} IS NOT NULL THEN 1 END)`,
        bounced: sql<number>`COUNT(CASE WHEN ${leadTouchpoints.status} = 'bounced' THEN 1 END)`,
        totalOpens: sql<number>`SUM(COALESCE(${leadTouchpoints.openCount}, 0))`,
        totalClicks: sql<number>`SUM(COALESCE(${leadTouchpoints.clickCount}, 0))`,
      })
      .from(leadTouchpoints)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [stats] = await touchpointsQuery;

    // Calculate rates
    const base = stats.delivered || stats.sent || 1;
    const openRate = Math.round(((stats.opened || 0) / base) * 100);
    const clickRate = Math.round(((stats.clicked || 0) / base) * 100);
    const replyRate = Math.round(((stats.replied || 0) / base) * 100);
    const bounceRate = Math.round(((stats.bounced || 0) / (stats.sent || 1)) * 100);
    const clickToOpenRate = stats.opened
      ? Math.round(((stats.clicked || 0) / stats.opened) * 100)
      : 0;

    // Get recent events
    const recentEvents = await db
      .select({
        id: emailEvents.id,
        eventType: emailEvents.eventType,
        occurredAt: emailEvents.occurredAt,
        clickedUrl: emailEvents.clickedUrl,
        country: emailEvents.country,
        city: emailEvents.city,
      })
      .from(emailEvents)
      .orderBy(desc(emailEvents.occurredAt))
      .limit(20);

    // Get hourly open/click distribution (last 24 hours)
    const hourlyDistribution = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${emailEvents.occurredAt})`,
        opens: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicks: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(sql`${emailEvents.occurredAt} >= NOW() - INTERVAL '24 hours'`)
      .groupBy(sql`EXTRACT(HOUR FROM ${emailEvents.occurredAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${emailEvents.occurredAt})`);

    // Get top clicked URLs
    const topUrls = await db
      .select({
        url: emailEvents.clickedUrl,
        clicks: count(),
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "clicked"),
          isNotNull(emailEvents.clickedUrl),
          dateFilter ? sql`${emailEvents.occurredAt} >= ${dateFilter.toISOString()}` : undefined
        )
      )
      .groupBy(emailEvents.clickedUrl)
      .orderBy(desc(count()))
      .limit(10);

    return NextResponse.json({
      period,
      stats: {
        ...stats,
        openRate,
        clickRate,
        replyRate,
        bounceRate,
        clickToOpenRate,
      },
      recentEvents,
      hourlyDistribution,
      topUrls,
    });
  } catch (error) {
    console.error("[API] Tracking stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
