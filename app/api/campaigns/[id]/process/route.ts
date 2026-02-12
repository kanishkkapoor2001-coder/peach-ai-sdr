import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  leads,
  campaigns,
  touchpointTemplates,
  leadTouchpoints,
  sendingDomains,
} from "@/lib/db/schema";
import { eq, and, lte, asc, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/services/email-sender";

/**
 * Personalize email content by replacing placeholders with lead data
 */
function personalizeContent(content: string, lead: {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  schoolName: string;
  schoolCountry?: string | null;
}): string {
  if (!content) return content;

  return content
    .replace(/\{\{firstName\}\}/g, lead.firstName || "")
    .replace(/\{\{lastName\}\}/g, lead.lastName || "")
    .replace(/\{\{email\}\}/g, lead.email || "")
    .replace(/\{\{jobTitle\}\}/g, lead.jobTitle || "")
    .replace(/\{\{schoolName\}\}/g, lead.schoolName || "")
    .replace(/\{\{schoolCountry\}\}/g, lead.schoolCountry || "");
}

/**
 * POST /api/campaigns/[id]/process
 *
 * Process and send pending touchpoints for the campaign
 * This should be called periodically (e.g., by a cron job) or when launching immediately
 *
 * Request body:
 * - sendImmediate?: boolean - If true, send touchpoints scheduled for now or earlier
 * - maxEmails?: number - Maximum emails to send in this batch (default 50)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const { sendImmediate = true, maxEmails = 50 } = body;

    console.log(`[Campaign Process] Starting for campaign ${campaignId}`);

    // 1. Get the campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // 2. Check for active sending domains
    const activeDomains = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.isActive, true));

    if (activeDomains.length === 0) {
      return NextResponse.json(
        { error: "No sending domain configured. Go to Settings → Domains to add one." },
        { status: 400 }
      );
    }

    // 3. Get pending touchpoints that are due to be sent
    const now = new Date();
    const pendingTouchpoints = await db
      .select({
        touchpointId: leadTouchpoints.id,
        leadId: leadTouchpoints.leadId,
        touchpointTemplateId: leadTouchpoints.touchpointTemplateId,
        scheduledAt: leadTouchpoints.scheduledAt,
        // Lead data
        leadFirstName: leads.firstName,
        leadLastName: leads.lastName,
        leadEmail: leads.email,
        leadJobTitle: leads.jobTitle,
        leadSchoolName: leads.schoolName,
        leadSchoolCountry: leads.schoolCountry,
        // Touchpoint template data
        templateSubject: touchpointTemplates.subject,
        templateBody: touchpointTemplates.body,
        templateChannel: touchpointTemplates.channel,
        templateStepNumber: touchpointTemplates.stepNumber,
      })
      .from(leadTouchpoints)
      .innerJoin(leads, eq(leadTouchpoints.leadId, leads.id))
      .innerJoin(touchpointTemplates, eq(leadTouchpoints.touchpointTemplateId, touchpointTemplates.id))
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leadTouchpoints.status, "pending"),
          sendImmediate ? lte(leadTouchpoints.scheduledAt, now) : undefined
        )
      )
      .orderBy(asc(leadTouchpoints.scheduledAt))
      .limit(maxEmails);

    console.log(`[Campaign Process] Found ${pendingTouchpoints.length} pending touchpoints`);

    if (pendingTouchpoints.length === 0) {
      return NextResponse.json({
        message: "No pending touchpoints to process",
        sent: 0,
        failed: 0,
      });
    }

    // 4. Process and send each touchpoint
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const tp of pendingTouchpoints) {
      try {
        // Only process email channel for now
        if (tp.templateChannel !== "email") {
          console.log(`[Campaign Process] Skipping non-email channel: ${tp.templateChannel}`);
          continue;
        }

        // Validate email content
        if (!tp.templateSubject || !tp.templateBody) {
          const errMsg = `${tp.leadFirstName}: No email content (subject or body missing)`;
          console.error(`[Campaign Process] ${errMsg}`);
          errors.push(errMsg);
          failed++;

          // Mark as failed
          await db
            .update(leadTouchpoints)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(leadTouchpoints.id, tp.touchpointId));

          continue;
        }

        // Validate recipient email
        if (!tp.leadEmail || tp.leadEmail.includes("@placeholder.local")) {
          const errMsg = `${tp.leadFirstName}: Invalid or missing email address`;
          console.error(`[Campaign Process] ${errMsg}`);
          errors.push(errMsg);
          failed++;

          await db
            .update(leadTouchpoints)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(leadTouchpoints.id, tp.touchpointId));

          continue;
        }

        // Personalize content
        const subject = personalizeContent(tp.templateSubject, {
          firstName: tp.leadFirstName,
          lastName: tp.leadLastName,
          email: tp.leadEmail,
          jobTitle: tp.leadJobTitle,
          schoolName: tp.leadSchoolName,
          schoolCountry: tp.leadSchoolCountry,
        });

        const body = personalizeContent(tp.templateBody, {
          firstName: tp.leadFirstName,
          lastName: tp.leadLastName,
          email: tp.leadEmail,
          jobTitle: tp.leadJobTitle,
          schoolName: tp.leadSchoolName,
          schoolCountry: tp.leadSchoolCountry,
        });

        console.log(`[Campaign Process] Sending step ${tp.templateStepNumber} to ${tp.leadEmail}`);

        // Send the email
        const result = await sendEmail({
          to: tp.leadEmail,
          subject,
          body,
          leadId: tp.leadId,
          sequenceId: tp.touchpointId, // Using touchpoint ID as sequence ID
          emailNumber: tp.templateStepNumber || 1,
        });

        if (!result.success) {
          const errMsg = `${tp.leadFirstName}: ${result.error || "Send failed"}`;
          console.error(`[Campaign Process] Failed: ${errMsg}`);
          errors.push(errMsg);
          failed++;

          await db
            .update(leadTouchpoints)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(leadTouchpoints.id, tp.touchpointId));

          continue;
        }

        console.log(`[Campaign Process] ✓ Sent to ${tp.leadEmail} via ${result.domain}`);

        // Update touchpoint status to sent
        await db
          .update(leadTouchpoints)
          .set({
            status: "sent",
            sentAt: new Date(),
            trackingId: result.messageId, // Store in trackingId as messageId isn't available
            updatedAt: new Date(),
          })
          .where(eq(leadTouchpoints.id, tp.touchpointId));

        // Update lead status to emailing if this is their first email
        if (tp.templateStepNumber === 1) {
          await db
            .update(leads)
            .set({ status: "emailing", updatedAt: new Date() })
            .where(eq(leads.id, tp.leadId));
        }

        sent++;
      } catch (error) {
        failed++;
        const errMsg = `${tp.leadFirstName}: ${error instanceof Error ? error.message : "Send failed"}`;
        errors.push(errMsg);
        console.error(`[Campaign Process] Exception sending to ${tp.leadEmail}:`, error);

        await db
          .update(leadTouchpoints)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(leadTouchpoints.id, tp.touchpointId));
      }
    }

    // 5. Update campaign stats
    if (sent > 0) {
      await db
        .update(campaigns)
        .set({
          emailsSent: sql`COALESCE(${campaigns.emailsSent}, 0) + ${sent}`,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    }

    const resultMessage = sent > 0
      ? `Sent ${sent} email${sent !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`
      : `Failed to send ${failed} email${failed !== 1 ? "s" : ""}`;

    console.log(`[Campaign Process] Complete: ${resultMessage}`);

    return NextResponse.json({
      message: resultMessage,
      sent,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("[Campaign Process] Fatal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process campaign" },
      { status: 500 }
    );
  }
}
