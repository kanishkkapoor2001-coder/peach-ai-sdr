import { NextRequest, NextResponse } from "next/server";
import { db, inboxMessages, leads } from "@/lib/db";
import { eq, desc, and, SQL, sql } from "drizzle-orm";
import { markAsRead, getInboxStats } from "@/lib/services/reply-processor";

/**
 * GET /api/inbox
 *
 * Get inbox messages with optional filters
 *
 * Query params:
 * - filter: "all" | "unread" | "starred"
 * - leadId: filter by specific lead
 * - senderEmail: filter by the email address we sent from (for sender rotation view)
 * - direction: "inbound" | "outbound" | "all" (default: inbound)
 * - limit: max messages to return (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const leadId = searchParams.get("leadId");
    const senderEmail = searchParams.get("senderEmail"); // Filter by our sending email
    const direction = searchParams.get("direction") || "inbound";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Build where conditions
    const conditions: SQL[] = [];

    // Direction filter (for viewing sent emails by sender)
    if (direction === "inbound") {
      conditions.push(eq(inboxMessages.direction, "inbound"));
    } else if (direction === "outbound") {
      conditions.push(eq(inboxMessages.direction, "outbound"));
    }
    // If "all", don't add direction filter

    if (filter === "unread") {
      conditions.push(eq(inboxMessages.isRead, false));
    }

    if (leadId) {
      conditions.push(eq(inboxMessages.leadId, leadId));
    }

    // Filter by sender email (our sending email address)
    // This finds messages where we sent from this email (outbound) or received replies to this email (inbound toEmail)
    if (senderEmail) {
      // For viewing a specific inbox: show all messages related to this sender email
      // - Outbound: fromEmail matches
      // - Inbound: toEmail matches (they replied to us)
      conditions.push(
        sql`(${inboxMessages.fromEmail} = ${senderEmail} OR ${inboxMessages.toEmail} = ${senderEmail})`
      );
    }

    // Execute query
    const messages = await db
      .select({
        message: inboxMessages,
        lead: leads,
      })
      .from(inboxMessages)
      .innerJoin(leads, eq(inboxMessages.leadId, leads.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inboxMessages.receivedAt))
      .limit(limit);

    // Get stats
    const stats = await getInboxStats();

    return NextResponse.json({
      messages: messages.map(({ message, lead }) => ({
        ...message,
        lead: {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          schoolName: lead.schoolName,
          jobTitle: lead.jobTitle,
        },
      })),
      stats,
    });
  } catch (error) {
    console.error("[Inbox] Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inbox
 *
 * Update message (mark read, assign, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, markRead, assignTo } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID required" },
        { status: 400 }
      );
    }

    if (markRead) {
      await markAsRead(messageId);
    }

    if (assignTo !== undefined) {
      await db
        .update(inboxMessages)
        .set({ assignedTo: assignTo })
        .where(eq(inboxMessages.id, messageId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Inbox] Error updating message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}
