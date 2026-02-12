import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, emailSequences, leadTouchpoints, meetings, inboxMessages, emailEvents } from "@/lib/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

/**
 * GET /api/dashboard/stats
 *
 * Returns comprehensive dashboard statistics including:
 * - Lead counts by status
 * - Email stats
 * - Recent activity (real data)
 * - Pipeline data
 */
export async function GET() {
  try {
    // Get date for "last 7 days" filter
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get lead counts
    const allLeads = await db.select().from(leads);
    const leadsByStatus: Record<string, number> = {};
    for (const lead of allLeads) {
      const status = lead.status || "new";
      leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
    }

    // Get email sequences and touchpoints stats
    const allSequences = await db.select().from(emailSequences);
    const allTouchpoints = await db.select().from(leadTouchpoints);

    // Count sent, opened, clicked
    let sentCount = 0;
    let openedCount = 0;
    let clickedCount = 0;
    let repliedCount = 0;

    for (const tp of allTouchpoints) {
      if (tp.sentAt) sentCount++;
      if (tp.openedAt) openedCount++;
      if (tp.clickedAt) clickedCount++;
      if (tp.repliedAt) repliedCount++;
    }

    // Get meetings count
    const allMeetings = await db.select().from(meetings);
    const meetingsCount = allMeetings.length;

    // Get recent activity - combine multiple sources
    const recentActivity: {
      id: string;
      type: "email_sent" | "reply" | "meeting" | "open" | "click";
      leadName: string;
      leadEmail?: string;
      time: Date;
    }[] = [];

    // Get recent sent emails (from touchpoints)
    const recentSent = await db
      .select({
        id: leadTouchpoints.id,
        sentAt: leadTouchpoints.sentAt,
        leadId: leadTouchpoints.leadId,
      })
      .from(leadTouchpoints)
      .where(sql`${leadTouchpoints.sentAt} IS NOT NULL`)
      .orderBy(desc(leadTouchpoints.sentAt))
      .limit(10);

    // Get recent opens
    const recentOpens = await db
      .select({
        id: leadTouchpoints.id,
        openedAt: leadTouchpoints.openedAt,
        leadId: leadTouchpoints.leadId,
      })
      .from(leadTouchpoints)
      .where(sql`${leadTouchpoints.openedAt} IS NOT NULL`)
      .orderBy(desc(leadTouchpoints.openedAt))
      .limit(10);

    // Get recent replies from inbox
    const recentReplies = await db
      .select({
        id: inboxMessages.id,
        receivedAt: inboxMessages.receivedAt,
        fromEmail: inboxMessages.fromEmail,
        leadId: inboxMessages.leadId,
      })
      .from(inboxMessages)
      .where(eq(inboxMessages.direction, "inbound"))
      .orderBy(desc(inboxMessages.receivedAt))
      .limit(10);

    // Get recent meetings
    const recentMeetings = await db
      .select({
        id: meetings.id,
        scheduledAt: meetings.scheduledAt,
        leadId: meetings.leadId,
      })
      .from(meetings)
      .orderBy(desc(meetings.scheduledAt))
      .limit(10);

    // Create lead lookup map
    const leadMap: Record<string, { firstName: string; lastName: string; email: string }> = {};
    for (const lead of allLeads) {
      leadMap[lead.id] = {
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        email: lead.email,
      };
    }

    // Build activity list
    for (const item of recentSent) {
      const lead = leadMap[item.leadId || ""];
      if (lead && item.sentAt) {
        recentActivity.push({
          id: `sent-${item.id}`,
          type: "email_sent",
          leadName: `${lead.firstName} ${lead.lastName}`.trim() || lead.email,
          leadEmail: lead.email,
          time: item.sentAt,
        });
      }
    }

    for (const item of recentOpens) {
      const lead = leadMap[item.leadId || ""];
      if (lead && item.openedAt) {
        recentActivity.push({
          id: `open-${item.id}`,
          type: "open",
          leadName: `${lead.firstName} ${lead.lastName}`.trim() || lead.email,
          leadEmail: lead.email,
          time: item.openedAt,
        });
      }
    }

    for (const item of recentReplies) {
      if (item.receivedAt) {
        const lead = item.leadId ? leadMap[item.leadId] : null;
        recentActivity.push({
          id: `reply-${item.id}`,
          type: "reply",
          leadName: lead?.firstName || item.fromEmail || "Unknown",
          leadEmail: item.fromEmail || undefined,
          time: item.receivedAt,
        });
      }
    }

    for (const item of recentMeetings) {
      const lead = leadMap[item.leadId];
      if (lead && item.scheduledAt) {
        recentActivity.push({
          id: `meeting-${item.id}`,
          type: "meeting",
          leadName: `${lead.firstName} ${lead.lastName}`.trim() || lead.email,
          leadEmail: lead.email,
          time: item.scheduledAt,
        });
      }
    }

    // Sort by time descending and take top 10
    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const topActivity = recentActivity.slice(0, 10);

    // Format time as relative
    const formatRelativeTime = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - new Date(date).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      return new Date(date).toLocaleDateString();
    };

    const formattedActivity = topActivity.map((a) => ({
      id: a.id,
      type: a.type,
      leadName: a.leadName,
      time: formatRelativeTime(a.time),
    }));

    // Build pipeline data from lead statuses
    const pipelineData = [
      { stage: "New", count: leadsByStatus["new"] || 0, color: "#8b5cf6" },
      { stage: "Approved", count: leadsByStatus["approved"] || 0, color: "#6366f1" },
      { stage: "Emailing", count: (leadsByStatus["emailing"] || 0) + (leadsByStatus["emails_generated"] || 0), color: "#3b82f6" },
      { stage: "Replied", count: leadsByStatus["replied"] || 0, color: "#10b981" },
      { stage: "Meeting", count: leadsByStatus["meeting_booked"] || 0, color: "#f59e0b" },
    ];

    // Calculate rates
    const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
    const clickRate = sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0;
    const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;

    return NextResponse.json({
      stats: {
        leads: { total: allLeads.length, change: 0 },
        emailsSent: { total: sentCount, change: 0 },
        replies: { total: repliedCount, change: 0 },
        meetings: { total: meetingsCount, change: 0 },
        openRate,
        clickRate,
        replyRate,
      },
      pipeline: pipelineData,
      recentActivity: formattedActivity,
    });
  } catch (error) {
    console.error("[Dashboard Stats] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
