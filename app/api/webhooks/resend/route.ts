import { NextRequest, NextResponse } from "next/server";
import { processReply } from "@/lib/services/reply-processor";
import { syncLeadToNotion } from "@/lib/services/notion-client";

/**
 * POST /api/webhooks/resend
 *
 * Webhook endpoint for Resend inbound emails
 *
 * Resend sends webhooks for:
 * - email.received (inbound emails)
 * - email.delivered
 * - email.bounced
 * - email.complained
 *
 * Docs: https://resend.com/docs/dashboard/webhooks/introduction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[Resend Webhook] Received event:", body.type);

    // Handle different event types
    switch (body.type) {
      case "email.received": {
        // Inbound email received
        const data = body.data;

        const result = await processReply({
          from: data.from,
          to: data.to,
          subject: data.subject,
          body: data.text || data.html || "",
          htmlBody: data.html,
          messageId: data.email_id,
          inReplyTo: data.in_reply_to,
          receivedAt: new Date(data.created_at),
        });

        if (result.success && result.leadId) {
          // Trigger Notion sync in background (don't await)
          syncLeadToNotion(result.leadId).catch((err) => {
            console.error("[Resend Webhook] Notion sync failed:", err);
          });
        }

        return NextResponse.json({
          success: result.success,
          message: result.success
            ? `Processed reply from lead ${result.leadId}`
            : result.error,
        });
      }

      case "email.delivered": {
        // Email was delivered successfully
        console.log("[Resend Webhook] Email delivered:", body.data.email_id);
        return NextResponse.json({ success: true, event: "delivered" });
      }

      case "email.bounced": {
        // Email bounced - should mark email as invalid
        console.log("[Resend Webhook] Email bounced:", body.data);
        // TODO: Update lead.emailVerified = false
        return NextResponse.json({ success: true, event: "bounced" });
      }

      case "email.complained": {
        // Spam complaint - should stop sequence and mark lead
        console.log("[Resend Webhook] Spam complaint:", body.data);
        // TODO: Stop sequence and flag lead
        return NextResponse.json({ success: true, event: "complained" });
      }

      default:
        console.log("[Resend Webhook] Unknown event type:", body.type);
        return NextResponse.json({ success: true, event: "unknown" });
    }
  } catch (error) {
    console.error("[Resend Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/resend
 *
 * Verification endpoint for webhook setup
 */
export async function GET() {
  return NextResponse.json({
    status: "Resend webhook endpoint active",
    timestamp: new Date().toISOString(),
  });
}
