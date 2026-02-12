/**
 * Reply Processor Service
 *
 * Handles incoming email replies:
 * - Matches reply to lead
 * - Stops active sequence
 * - Generates AI draft reply
 * - Updates lead status
 * - Syncs to Notion CRM automatically
 */

import { db, leads, emailSequences, inboxMessages, leadTouchpoints } from "@/lib/db";
import { eq, or, and } from "drizzle-orm";
import { generateDraftReply } from "@/lib/ai/draft-reply";
import { syncLeadToNotion } from "./notion-client";
import { detectMeetingReadiness, hasObviousBookingSignals } from "@/lib/ai/meeting-readiness";
import { getSchedulingUrl } from "./calendly-client";

export interface IncomingEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  threadId?: string;
  receivedAt?: Date;
}

export interface ProcessedReply {
  success: boolean;
  leadId?: string;
  sequenceId?: string;
  inboxMessageId?: string;
  aiDraftGenerated?: boolean;
  notionSynced?: boolean;
  meetingReadiness?: {
    isReady: boolean;
    confidence: number;
    scenario: string;
  };
  error?: string;
}

/**
 * Extract email address from "Name <email>" format
 */
function extractEmail(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : fromField.toLowerCase();
}

/**
 * Process an incoming email reply
 */
export async function processReply(email: IncomingEmail): Promise<ProcessedReply> {
  try {
    const senderEmail = extractEmail(email.from);

    console.log(`[Reply Processor] Processing reply from: ${senderEmail}`);

    // Find lead by email
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, senderEmail));

    if (!lead) {
      console.log(`[Reply Processor] No lead found for: ${senderEmail}`);
      return {
        success: false,
        error: `No lead found for email: ${senderEmail}`,
      };
    }

    // Find active sequence for this lead
    const [sequence] = await db
      .select()
      .from(emailSequences)
      .where(eq(emailSequences.leadId, lead.id));

    // Stop the sequence if it exists and is active
    if (sequence && sequence.status === "active") {
      await db
        .update(emailSequences)
        .set({
          status: "stopped",
          stopReason: "Lead replied",
          updatedAt: new Date(),
        })
        .where(eq(emailSequences.id, sequence.id));

      console.log(`[Reply Processor] Stopped sequence ${sequence.id}`);
    }

    // Also stop any pending touchpoints for this lead (new campaign system)
    const stoppedTouchpoints = await db
      .update(leadTouchpoints)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leadTouchpoints.leadId, lead.id),
          eq(leadTouchpoints.status, "pending")
        )
      )
      .returning({ id: leadTouchpoints.id });

    if (stoppedTouchpoints.length > 0) {
      console.log(`[Reply Processor] Cancelled ${stoppedTouchpoints.length} pending touchpoints for lead ${lead.id}`);
    }

    // Mark the most recent sent touchpoint as "replied"
    const [repliedTouchpoint] = await db
      .update(leadTouchpoints)
      .set({
        status: "replied",
        repliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leadTouchpoints.leadId, lead.id),
          eq(leadTouchpoints.status, "sent")
        )
      )
      .returning({ id: leadTouchpoints.id });

    if (repliedTouchpoint) {
      console.log(`[Reply Processor] Marked touchpoint ${repliedTouchpoint.id} as replied`);
    }

    // Update lead status to replied
    await db
      .update(leads)
      .set({
        status: "replied",
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    // Generate AI draft reply
    let aiDraft: string | undefined;
    let aiDraftGenerated = false;
    let meetingReadinessResult: { isReady: boolean; confidence: number; scenario: string } | undefined;

    try {
      // Get conversation history
      const previousMessages = await db
        .select()
        .from(inboxMessages)
        .where(eq(inboxMessages.leadId, lead.id));

      const conversationHistory = previousMessages.map((m) => ({
        direction: m.direction as "inbound" | "outbound",
        subject: m.subject || "",
        body: m.body,
        date: m.receivedAt || m.createdAt || new Date(),
      }));

      // Check for meeting readiness (quick check first)
      let calendlyUrl: string | undefined;
      if (hasObviousBookingSignals(email.body)) {
        console.log("[Reply Processor] Obvious booking signals detected, checking meeting readiness...");

        // Full conversation with new message
        const fullConversation = [
          ...conversationHistory,
          { direction: "inbound" as const, body: email.body, subject: email.subject },
        ];

        try {
          const readiness = await detectMeetingReadiness(fullConversation);
          meetingReadinessResult = {
            isReady: readiness.isReady,
            confidence: readiness.confidence,
            scenario: readiness.scenario,
          };

          if (readiness.isReady && readiness.confidence >= 0.7) {
            console.log(`[Reply Processor] Lead is ready to book! Scenario: ${readiness.scenario}, Confidence: ${readiness.confidence}`);

            // Try to get Calendly URL
            try {
              calendlyUrl = await getSchedulingUrl();
              console.log("[Reply Processor] Retrieved Calendly URL for draft reply");
            } catch (calendlyError) {
              console.log("[Reply Processor] Calendly not configured, skipping link");
            }
          }
        } catch (readinessError) {
          console.error("[Reply Processor] Meeting readiness check failed:", readinessError);
        }
      }

      aiDraft = await generateDraftReply({
        lead,
        incomingMessage: email.body,
        previousMessages: conversationHistory,
        calendlyUrl, // Pass Calendly URL if lead is ready to book
      });
      aiDraftGenerated = true;
    } catch (error) {
      console.error("[Reply Processor] Failed to generate AI draft:", error);
    }

    // Save the incoming message to inbox
    const [inboxMessage] = await db
      .insert(inboxMessages)
      .values({
        leadId: lead.id,
        sequenceId: sequence?.id,
        direction: "inbound",
        fromEmail: senderEmail,
        toEmail: email.to,
        subject: email.subject,
        body: email.body,
        htmlBody: email.htmlBody,
        messageId: email.messageId,
        inReplyTo: email.inReplyTo,
        threadId: email.threadId,
        aiDraftReply: aiDraft,
        isRead: false,
        receivedAt: email.receivedAt || new Date(),
      })
      .returning();

    console.log(
      `[Reply Processor] Created inbox message ${inboxMessage.id} for lead ${lead.id}`
    );

    // Sync to Notion CRM automatically when reply is received
    let notionSynced = false;
    try {
      const notionResult = await syncLeadToNotion(lead.id);
      notionSynced = notionResult.success;
      if (notionResult.success) {
        console.log(`[Reply Processor] Synced lead ${lead.id} to Notion CRM`);
      } else {
        console.log(`[Reply Processor] Notion sync skipped or failed: ${notionResult.error}`);
      }
    } catch (error) {
      console.error("[Reply Processor] Failed to sync to Notion:", error);
    }

    return {
      success: true,
      leadId: lead.id,
      sequenceId: sequence?.id,
      inboxMessageId: inboxMessage.id,
      aiDraftGenerated,
      notionSynced,
      meetingReadiness: meetingReadinessResult,
    };
  } catch (error) {
    console.error("[Reply Processor] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a message as read
 */
export async function markAsRead(
  messageId: string,
  userId?: string
): Promise<void> {
  const [message] = await db
    .select()
    .from(inboxMessages)
    .where(eq(inboxMessages.id, messageId));

  if (!message) return;

  const readBy = (message.readBy as string[]) || [];
  if (userId && !readBy.includes(userId)) {
    readBy.push(userId);
  }

  await db
    .update(inboxMessages)
    .set({
      isRead: true,
      readBy,
    })
    .where(eq(inboxMessages.id, messageId));
}

/**
 * Get inbox stats
 */
export async function getInboxStats(): Promise<{
  total: number;
  unread: number;
  withDraft: number;
}> {
  const messages = await db
    .select({
      isRead: inboxMessages.isRead,
      aiDraftReply: inboxMessages.aiDraftReply,
      direction: inboxMessages.direction,
    })
    .from(inboxMessages)
    .where(eq(inboxMessages.direction, "inbound"));

  return {
    total: messages.length,
    unread: messages.filter((m) => !m.isRead).length,
    withDraft: messages.filter((m) => m.aiDraftReply).length,
  };
}
