import { NextRequest, NextResponse } from "next/server";
import { db, inboxMessages, sendingDomains } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";

/**
 * GET /api/inbox/senders
 *
 * Get a list of distinct sender email addresses that have been used
 * Useful for filtering inbox by sender
 *
 * Returns:
 * - senders: Array of { email, name, domain, messageCount, lastUsed }
 */
export async function GET(request: NextRequest) {
  try {
    // Get unique sending emails from outbound messages
    const sentEmails = await db
      .select({
        email: inboxMessages.fromEmail,
        messageCount: sql<number>`COUNT(*)::int`,
        lastUsed: sql<Date | null>`MAX(${inboxMessages.receivedAt})`,
      })
      .from(inboxMessages)
      .where(eq(inboxMessages.direction, "outbound"))
      .groupBy(inboxMessages.fromEmail)
      .orderBy(desc(sql`MAX(${inboxMessages.receivedAt})`));

    // Get all sending domains for matching names
    const domains = await db.select().from(sendingDomains);
    const domainMap = new Map(domains.map((d) => [d.fromEmail, d]));

    // Build response with domain info
    const senders = sentEmails.map((sent) => {
      const domain = domainMap.get(sent.email);
      return {
        email: sent.email,
        name: domain?.fromName || sent.email.split("@")[0],
        domain: sent.email.split("@")[1],
        isActive: domain?.isActive ?? false,
        messageCount: sent.messageCount,
        lastUsed: sent.lastUsed,
      };
    });

    // Also include configured domains that haven't sent yet
    for (const domain of domains) {
      if (!senders.find((s) => s.email === domain.fromEmail)) {
        senders.push({
          email: domain.fromEmail,
          name: domain.fromName,
          domain: domain.domain,
          isActive: domain.isActive ?? true,
          messageCount: 0,
          lastUsed: null,
        });
      }
    }

    return NextResponse.json({
      senders,
      total: senders.length,
    });
  } catch (error) {
    console.error("[Inbox Senders] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch senders" },
      { status: 500 }
    );
  }
}
