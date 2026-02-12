import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmActivities, crmContacts, meetings } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";

/**
 * GET /api/meetings/insights
 *
 * Get meeting insights with filtering
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sentiment = searchParams.get("sentiment");
  const hasInterest = searchParams.get("hasInterest");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    // Get meeting activities from CRM
    const conditions = [eq(crmActivities.activityType, "meeting_completed")];

    if (dateFrom) {
      conditions.push(gte(crmActivities.occurredAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(crmActivities.occurredAt, new Date(dateTo)));
    }

    const activities = await db
      .select({
        activity: crmActivities,
        contact: crmContacts,
      })
      .from(crmActivities)
      .leftJoin(crmContacts, eq(crmActivities.contactId, crmContacts.id))
      .where(and(...conditions))
      .orderBy(desc(crmActivities.occurredAt))
      .limit(limit);

    // Process and filter results
    let insights = activities.map(({ activity, contact }) => {
      const metadata = activity.metadata as Record<string, unknown> || {};
      return {
        id: activity.id,
        meetingTitle: activity.subject,
        summary: activity.body,
        occurredAt: activity.occurredAt,
        contact: contact ? {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email,
          company: contact.companyName,
          stage: contact.stage,
        } : null,
        sentiment: metadata.sentiment as string || "unknown",
        hasInterest: metadata.hasInterest as boolean || false,
        duration: metadata.duration as number || 0,
        actionItemsCount: metadata.actionItems as number || 0,
        keyInsights: metadata.keyInsights as string[] || [],
        nextSteps: metadata.nextSteps as string[] || [],
        attendees: metadata.attendees as Array<{ name: string; email: string }> || [],
        recordingUrl: metadata.recordingUrl as string || null,
        transcript: metadata.transcript as Array<{ speaker: string; text: string }> || [],
      };
    });

    // Apply additional filters
    if (sentiment && sentiment !== "all") {
      insights = insights.filter(i => i.sentiment === sentiment);
    }
    if (hasInterest === "true") {
      insights = insights.filter(i => i.hasInterest);
    }
    if (search) {
      const query = search.toLowerCase();
      insights = insights.filter(i =>
        i.meetingTitle?.toLowerCase().includes(query) ||
        i.summary?.toLowerCase().includes(query) ||
        i.contact?.name.toLowerCase().includes(query) ||
        i.contact?.company?.toLowerCase().includes(query)
      );
    }

    // Calculate stats
    const stats = {
      total: insights.length,
      positive: insights.filter(i => i.sentiment === "positive").length,
      neutral: insights.filter(i => i.sentiment === "neutral").length,
      negative: insights.filter(i => i.sentiment === "negative").length,
      withInterest: insights.filter(i => i.hasInterest).length,
      avgDuration: Math.round(insights.reduce((acc, i) => acc + i.duration, 0) / (insights.length || 1) / 60),
      totalActionItems: insights.reduce((acc, i) => acc + i.actionItemsCount, 0),
    };

    return NextResponse.json({ insights, stats });
  } catch (error) {
    console.error("[Meeting Insights] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
