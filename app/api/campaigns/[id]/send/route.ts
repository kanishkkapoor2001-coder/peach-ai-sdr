import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, leads, emailSequences, sendingDomains } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendEmail, scheduleNextEmail } from "@/lib/services/email-sender";

// POST - Send emails for approved sequences in campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    console.log(`[Campaign Send] Starting send for campaign ${campaignId}`);

    // Get campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check for active sending domains
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

    // Log which domains are available
    console.log(`[Campaign Send] Found ${activeDomains.length} active domain(s):`);
    for (const d of activeDomains) {
      console.log(`  - ${d.fromEmail} (${d.sendingMethod || 'resend'}) ${d.smtpHost ? `via ${d.smtpHost}` : ''}`);
    }

    // Get approved sequences in this campaign with full lead data
    const approvedSequences = await db
      .select({
        sequenceId: emailSequences.id,
        leadId: leads.id,
        email: leads.email,
        firstName: leads.firstName,
        lastName: leads.lastName,
        jobTitle: leads.jobTitle,
        schoolName: leads.schoolName,
        schoolCountry: leads.schoolCountry,
        schoolRegion: leads.schoolRegion,
        phone: leads.phone,
        linkedinUrl: leads.linkedinUrl,
        curriculum: leads.curriculum,
        annualFeesUsd: leads.annualFeesUsd,
        studentCount: leads.studentCount,
        deviceAccess: leads.deviceAccess,
        schoolType: leads.schoolType,
        schoolWebsite: leads.schoolWebsite,
        subject: emailSequences.email1Subject,
        body: emailSequences.email1Body,
        currentEmail: emailSequences.currentEmail,
      })
      .from(emailSequences)
      .innerJoin(leads, eq(emailSequences.leadId, leads.id))
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(emailSequences.status, "approved")
        )
      );

    console.log(`[Campaign Send] Found ${approvedSequences.length} approved sequences`);

    if (approvedSequences.length === 0) {
      return NextResponse.json({
        message: "No approved sequences to send",
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const seq of approvedSequences) {
      try {
        // Validate email content
        if (!seq.subject || !seq.body) {
          const errMsg = `${seq.firstName || 'Unknown'}: No email content (subject or body missing)`;
          console.error(`[Campaign Send] ${errMsg}`);
          errors.push(errMsg);
          failed++;
          continue;
        }

        // Validate recipient email
        if (!seq.email || seq.email.includes('@placeholder.local')) {
          const errMsg = `${seq.firstName || 'Unknown'}: Invalid or missing email address`;
          console.error(`[Campaign Send] ${errMsg}`);
          errors.push(errMsg);
          failed++;
          continue;
        }

        console.log(`[Campaign Send] Sending to ${seq.email} (${seq.firstName} ${seq.lastName})`);

        // Use the unified sendEmail function which handles:
        // - SMTP sending
        // - Domain rotation
        // - Warmup limits
        const result = await sendEmail({
          to: seq.email,
          subject: seq.subject,
          body: seq.body,
          leadId: seq.leadId,
          sequenceId: seq.sequenceId,
          emailNumber: 1,
        });

        if (!result.success) {
          const errMsg = `${seq.firstName}: ${result.error || 'Send failed'}`;
          console.error(`[Campaign Send] Failed: ${errMsg}`);
          errors.push(errMsg);
          failed++;
          continue;
        }

        console.log(`[Campaign Send] ✓ Sent to ${seq.email} via ${result.domain}, messageId: ${result.messageId}`);

        // Update sequence to active - ONLY after successful send
        await db
          .update(emailSequences)
          .set({
            status: "active",
            email1SentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailSequences.id, seq.sequenceId));

        // Update lead status
        await db
          .update(leads)
          .set({ status: "emailing", updatedAt: new Date() })
          .where(eq(leads.id, seq.leadId));

        // Schedule next email in sequence
        await scheduleNextEmail(seq.sequenceId);

        sent++;
      } catch (error) {
        failed++;
        const errMsg = `${seq.firstName || 'Unknown'}: ${error instanceof Error ? error.message : "Send failed"}`;
        errors.push(errMsg);
        console.error(`[Campaign Send] Exception sending to ${seq.email}:`, error);
      }
    }

    // Update campaign status and stats
    await db
      .update(campaigns)
      .set({
        status: sent > 0 ? "active" : campaign.status,
        startedAt: campaign.startedAt || (sent > 0 ? new Date() : null),
        emailsSent: sql`COALESCE(${campaigns.emailsSent}, 0) + ${sent}`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    const resultMessage = sent > 0
      ? `Sent ${sent} email${sent !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ""}`
      : `Failed to send ${failed} email${failed !== 1 ? 's' : ''}`;

    console.log(`[Campaign Send] Complete: ${resultMessage}`);

    return NextResponse.json({
      message: resultMessage,
      sent,
      failed,
      errors: errors.slice(0, 10), // Return first 10 errors for debugging
    });
  } catch (error) {
    console.error("[Campaign Send] Fatal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send emails" },
      { status: 500 }
    );
  }
}
