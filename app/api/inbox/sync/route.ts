/**
 * INBOX SYNC ROUTE - LOCKED FUNCTIONALITY
 * =======================================
 *
 * This endpoint syncs emails from IMAP (Gmail, Outlook, etc.)
 * Called by the inbox page's pollForNewEmails() function.
 *
 * IMPORTANT: This is called via POST from /inbox page
 * DO NOT change the response format without updating inbox/page.tsx
 *
 * Expected response format:
 * {
 *   total: number,      // total domains checked
 *   synced: number,     // domains successfully synced
 *   newMessages: number, // new messages found (used by inbox page)
 *   errors: string[]    // any errors (logged but don't block UI)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllInboxes, syncDomainInbox } from "@/lib/services/imap-sync";

/**
 * POST /api/inbox/sync
 *
 * Sync emails from SMTP inboxes (Gmail, Outlook, etc.)
 *
 * Query params:
 * - domainId: sync specific domain only
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");

    if (domainId) {
      // Sync single domain
      const result = await syncDomainInbox(domainId);
      return NextResponse.json(result);
    } else {
      // Sync all SMTP domains
      const result = await syncAllInboxes();
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("[Inbox Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inbox/sync
 *
 * Get sync status
 */
export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "POST to this endpoint to sync SMTP inboxes",
  });
}
