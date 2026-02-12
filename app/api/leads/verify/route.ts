import { NextRequest, NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq, inArray, and, isNull, or, like } from "drizzle-orm";
import { verifyEmails, getVerificationStats } from "@/lib/services/email-verify";

/**
 * POST /api/leads/verify
 *
 * Verify emails for selected leads
 *
 * Request body:
 * {
 *   leadIds?: string[]  // Specific leads to verify (optional)
 *   verifyAll?: boolean // Verify all unverified leads
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadIds, verifyAll } = body;

    // Get leads to verify
    let leadsToVerify;

    if (verifyAll) {
      // Get all leads that haven't been verified and have real emails
      leadsToVerify = await db
        .select({ id: leads.id, email: leads.email })
        .from(leads)
        .where(
          and(
            eq(leads.emailVerified, false),
            // Exclude placeholder emails
            or(
              isNull(leads.email),
              // Not a placeholder email
              like(leads.email, "%@%.%")
            )
          )
        );

      // Filter out placeholder emails
      leadsToVerify = leadsToVerify.filter(
        (l) => l.email && !l.email.includes("@placeholder")
      );
    } else if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      leadsToVerify = await db
        .select({ id: leads.id, email: leads.email })
        .from(leads)
        .where(inArray(leads.id, leadIds));

      // Filter out placeholder emails
      leadsToVerify = leadsToVerify.filter(
        (l) => l.email && !l.email.includes("@placeholder")
      );
    } else {
      return NextResponse.json(
        { error: "Provide leadIds array or set verifyAll: true" },
        { status: 400 }
      );
    }

    if (leadsToVerify.length === 0) {
      return NextResponse.json({
        message: "No leads to verify",
        verified: 0,
        stats: {
          total: 0,
          valid: 0,
          invalid: 0,
          disposable: 0,
          noMxRecord: 0,
          syntaxErrors: 0,
        },
      });
    }

    // Extract emails
    const emails = leadsToVerify.map((l) => l.email).filter(Boolean) as string[];

    console.log(`[Email Verify] Verifying ${emails.length} emails...`);

    // Verify all emails
    const results = await verifyEmails(emails);

    // Create map of email -> result
    const resultMap = new Map(results.map((r) => [r.email, r]));

    // Update leads in database
    const updates = await Promise.all(
      leadsToVerify.map(async (lead) => {
        if (!lead.email) return null;

        const result = resultMap.get(lead.email.toLowerCase());
        if (!result) return null;

        await db
          .update(leads)
          .set({
            emailVerified: result.isValid,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        return {
          id: lead.id,
          email: lead.email,
          isValid: result.isValid,
          reason: result.reason,
        };
      })
    );

    const validUpdates = updates.filter(Boolean);
    const stats = getVerificationStats(results);

    console.log(
      `[Email Verify] Complete: ${stats.valid} valid, ${stats.invalid} invalid`
    );

    return NextResponse.json({
      message: `Verified ${validUpdates.length} emails`,
      verified: validUpdates.length,
      stats,
      results: validUpdates,
    });
  } catch (error) {
    console.error("[Email Verify] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/verify/stats
 *
 * Get verification stats for all leads
 */
export async function GET() {
  try {
    const allLeads = await db
      .select({
        email: leads.email,
        emailVerified: leads.emailVerified,
      })
      .from(leads);

    const total = allLeads.length;
    const withEmail = allLeads.filter(
      (l) => l.email && !l.email.includes("@placeholder")
    ).length;
    const verified = allLeads.filter((l) => l.emailVerified).length;
    const unverified = withEmail - verified;
    const noEmail = total - withEmail;

    return NextResponse.json({
      total,
      withEmail,
      verified,
      unverified,
      noEmail,
    });
  } catch (error) {
    console.error("[Email Verify Stats] Error:", error);

    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
