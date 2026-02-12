/**
 * IMAP Sync Service
 *
 * Fetches incoming emails from Gmail/Outlook via IMAP
 * Used for domains sending via SMTP (not Resend)
 */

import Imap from "imap-simple";
import { simpleParser } from "mailparser";
import { db, sendingDomains, inboxMessages, leads } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { processReply } from "./reply-processor";

// IMAP presets for common providers
export const IMAP_PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: "imap.gmail.com", port: 993 },
  outlook: { host: "outlook.office365.com", port: 993 },
  zoho: { host: "imap.zoho.com", port: 993 },
};

interface SyncResult {
  success: boolean;
  newMessages: number;
  errors: string[];
}

/**
 * Sync emails for a single domain
 */
export async function syncDomainInbox(domainId: string): Promise<SyncResult> {
  const result: SyncResult = { success: false, newMessages: 0, errors: [] };

  try {
    // Get domain config
    const [domain] = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.id, domainId));

    if (!domain) {
      result.errors.push("Domain not found");
      return result;
    }

    if (!domain.smtpPassword) {
      result.errors.push("No password configured");
      return result;
    }

    // Determine IMAP host
    let imapHost = domain.imapHost;
    let imapPort = domain.imapPort || 993;

    if (!imapHost) {
      // Try to infer from SMTP host
      if (domain.smtpHost?.includes("gmail")) {
        imapHost = IMAP_PRESETS.gmail.host;
        imapPort = IMAP_PRESETS.gmail.port;
      } else if (domain.smtpHost?.includes("office365") || domain.smtpHost?.includes("outlook")) {
        imapHost = IMAP_PRESETS.outlook.host;
        imapPort = IMAP_PRESETS.outlook.port;
      } else if (domain.smtpHost?.includes("zoho")) {
        imapHost = IMAP_PRESETS.zoho.host;
        imapPort = IMAP_PRESETS.zoho.port;
      } else {
        result.errors.push("Cannot determine IMAP host. Please configure manually.");
        return result;
      }
    }

    console.log(`[IMAP Sync] Connecting to ${imapHost}:${imapPort} for ${domain.fromEmail}`);

    // Connect to IMAP
    const connection = await Imap.connect({
      imap: {
        user: domain.smtpUser || domain.fromEmail,
        password: domain.smtpPassword,
        host: imapHost,
        port: imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      },
    });

    // Open INBOX
    await connection.openBox("INBOX");

    // Search for recent emails (last 24 hours or since last sync)
    const since = domain.lastImapSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceStr = since.toISOString().split("T")[0];

    const searchCriteria = ["UNSEEN", ["SINCE", sinceStr]];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT", ""],
      markSeen: false,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`[IMAP Sync] Found ${messages.length} unread messages for ${domain.fromEmail}`);

    for (const message of messages) {
      try {
        // Get the full email
        const allParts = message.parts.find((p) => p.which === "");
        if (!allParts) continue;

        // Parse the email
        const parsed = await simpleParser(allParts.body);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fromValue = parsed.from?.value as any;
        const fromAddress = Array.isArray(fromValue)
          ? fromValue[0]?.address
          : fromValue?.address;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toValue = parsed.to as any;
        const toAddress = Array.isArray(toValue)
          ? toValue[0]?.value?.[0]?.address
          : toValue?.value?.[0]?.address;

        if (!fromAddress) continue;

        // Skip if it's from us (outbound email in sent folder somehow)
        if (fromAddress.toLowerCase() === domain.fromEmail.toLowerCase()) {
          continue;
        }

        // Check if we already have this message
        const messageId = parsed.messageId;
        if (messageId) {
          const [existing] = await db
            .select()
            .from(inboxMessages)
            .where(eq(inboxMessages.messageId, messageId));

          if (existing) {
            continue; // Already processed
          }
        }

        // Process as a reply
        const processResult = await processReply({
          from: fromAddress,
          to: toAddress || domain.fromEmail,
          subject: parsed.subject || "(No Subject)",
          body: parsed.text || "",
          htmlBody: parsed.html || undefined,
          messageId: messageId || undefined,
          inReplyTo: parsed.inReplyTo || undefined,
          receivedAt: parsed.date || new Date(),
        });

        if (processResult.success) {
          result.newMessages++;

          // Mark as seen in IMAP
          await connection.addFlags(message.attributes.uid, ["\\Seen"]);
        }
      } catch (msgError) {
        console.error("[IMAP Sync] Error processing message:", msgError);
        result.errors.push(`Failed to process message: ${msgError}`);
      }
    }

    // Update last sync time
    await db
      .update(sendingDomains)
      .set({ lastImapSync: new Date() })
      .where(eq(sendingDomains.id, domainId));

    // Close connection
    connection.end();

    result.success = true;
    console.log(`[IMAP Sync] Completed for ${domain.fromEmail}: ${result.newMessages} new messages`);

    return result;
  } catch (error) {
    console.error("[IMAP Sync] Error:", error);
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
    return result;
  }
}

/**
 * Sync all SMTP domains
 */
export async function syncAllInboxes(): Promise<{
  total: number;
  synced: number;
  newMessages: number;
  errors: string[];
}> {
  const results = { total: 0, synced: 0, newMessages: 0, errors: [] as string[] };

  // Get all SMTP domains
  const domains = await db
    .select()
    .from(sendingDomains)
    .where(
      and(
        eq(sendingDomains.sendingMethod, "smtp"),
        eq(sendingDomains.isActive, true)
      )
    );

  results.total = domains.length;

  for (const domain of domains) {
    const syncResult = await syncDomainInbox(domain.id);
    if (syncResult.success) {
      results.synced++;
      results.newMessages += syncResult.newMessages;
    }
    results.errors.push(...syncResult.errors);
  }

  return results;
}
