import { NextRequest, NextResponse } from "next/server";
import { db, emailSequences, leads } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail, scheduleNextEmail } from "@/lib/services/email-sender";

/**
 * POST /api/emails/send
 *
 * Send emails for approved sequences
 *
 * Request body:
 * {
 *   sequenceIds: string[]  // Sequences to send
 *   emailNumber?: number   // Which email to send (1-5), defaults to next in sequence
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sequenceIds, emailNumber } = body;

    if (!sequenceIds || !Array.isArray(sequenceIds) || sequenceIds.length === 0) {
      return NextResponse.json(
        { error: "No sequence IDs provided" },
        { status: 400 }
      );
    }

    // Get sequences with lead data
    const sequences = await db
      .select({
        sequence: emailSequences,
        lead: leads,
      })
      .from(emailSequences)
      .innerJoin(leads, eq(emailSequences.leadId, leads.id))
      .where(inArray(emailSequences.id, sequenceIds));

    if (sequences.length === 0) {
      return NextResponse.json(
        { error: "No sequences found" },
        { status: 404 }
      );
    }

    const results: Array<{
      sequenceId: string;
      leadEmail: string;
      success: boolean;
      error?: string;
      messageId?: string;
      nextSendDate?: string;
    }> = [];

    for (const { sequence, lead } of sequences) {
      // Determine which email to send
      const targetEmail = emailNumber || (sequence.currentEmail || 0) + 1;

      if (targetEmail > 5) {
        results.push({
          sequenceId: sequence.id,
          leadEmail: lead.email,
          success: false,
          error: "Sequence already complete",
        });
        continue;
      }

      // Check if lead has a real email
      if (!lead.email || lead.email.includes("@placeholder")) {
        results.push({
          sequenceId: sequence.id,
          leadEmail: lead.email,
          success: false,
          error: "Lead has no valid email address",
        });
        continue;
      }

      // Get email content
      const subjectKey = `email${targetEmail}Subject` as keyof typeof sequence;
      const bodyKey = `email${targetEmail}Body` as keyof typeof sequence;

      const subject = sequence[subjectKey] as string;
      const emailBody = sequence[bodyKey] as string;

      if (!subject || !emailBody) {
        results.push({
          sequenceId: sequence.id,
          leadEmail: lead.email,
          success: false,
          error: `Email ${targetEmail} content not found`,
        });
        continue;
      }

      // Send the email
      const sendResult = await sendEmail({
        to: lead.email,
        subject,
        body: emailBody,
        leadId: lead.id,
        sequenceId: sequence.id,
        emailNumber: targetEmail,
      });

      if (sendResult.success) {
        // Update sequence status to active
        await db
          .update(emailSequences)
          .set({
            status: "active",
            currentEmail: targetEmail,
            updatedAt: new Date(),
          })
          .where(eq(emailSequences.id, sequence.id));

        // Update lead status
        await db
          .update(leads)
          .set({
            status: "emailing",
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        // Schedule next email
        const nextSendDate = await scheduleNextEmail(sequence.id);

        results.push({
          sequenceId: sequence.id,
          leadEmail: lead.email,
          success: true,
          messageId: sendResult.messageId,
          nextSendDate: nextSendDate?.toISOString(),
        });
      } else {
        results.push({
          sequenceId: sequence.id,
          leadEmail: lead.email,
          success: false,
          error: sendResult.error,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${successful} emails (${failed} failed)`,
      results,
    });
  } catch (error) {
    console.error("[Email Send] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send emails" },
      { status: 500 }
    );
  }
}
