import { NextRequest, NextResponse } from "next/server";
import { db, sendingDomains, type NewSendingDomain } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getDomainStats } from "@/lib/services/email-sender";

/**
 * GET /api/domains
 *
 * List all sending domains with stats
 */
export async function GET() {
  try {
    const stats = await getDomainStats();
    return NextResponse.json({ domains: stats });
  } catch (error) {
    console.error("[Domains] Error fetching:", error);
    return NextResponse.json(
      { error: "Failed to fetch domains" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains
 *
 * Create a new sending domain
 *
 * VALIDATION:
 * - SMTP domains MUST have smtpHost and smtpPassword
 * - Resend domains require valid RESEND_API_KEY in env
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { domain, fromEmail, fromName, warmupStartDate, isActive, sendingMethod, smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } = body;

    if (!domain || !fromEmail || !fromName) {
      return NextResponse.json(
        { error: "domain, fromEmail, and fromName are required" },
        { status: 400 }
      );
    }

    // Validate SMTP configuration if using SMTP method
    const method = sendingMethod || "resend";
    if (method === "smtp") {
      if (!smtpHost) {
        return NextResponse.json(
          { error: "SMTP host is required for SMTP sending method" },
          { status: 400 }
        );
      }
      if (!smtpPassword) {
        return NextResponse.json(
          { error: "SMTP password (App Password) is required for SMTP sending method. For Gmail, get one at myaccount.google.com/apppasswords" },
          { status: 400 }
        );
      }
    }

    // Validate Resend configuration if using Resend method
    if (method === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey || !apiKey.startsWith("re_") || apiKey.length < 20) {
        return NextResponse.json(
          { error: "RESEND_API_KEY is not configured. Add it to your .env.local file. Get one free at resend.com" },
          { status: 400 }
        );
      }
    }

    // Check if domain already exists
    const existing = await db
      .select()
      .from(sendingDomains)
      .where(eq(sendingDomains.domain, domain));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Domain already exists" },
        { status: 409 }
      );
    }

    const newDomain: NewSendingDomain = {
      domain,
      fromEmail,
      fromName,
      sendingMethod: method,
      smtpHost: smtpHost || null,
      smtpPort: smtpPort || 587,
      smtpUser: smtpUser || fromEmail,
      smtpPassword: smtpPassword || null,
      smtpSecure: smtpSecure || false,
      warmupStartDate: warmupStartDate ? new Date(warmupStartDate) : new Date(),
      isActive: isActive ?? true,
      sentToday: 0,
      lastResetDate: new Date().toISOString().split("T")[0],
    };

    const [created] = await db
      .insert(sendingDomains)
      .values(newDomain)
      .returning();

    console.log(`[Domains] Created domain ${domain} with method ${method}`);

    return NextResponse.json({ domain: created }, { status: 201 });
  } catch (error) {
    console.error("[Domains] Error creating:", error);
    return NextResponse.json(
      { error: "Failed to create domain" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/domains
 *
 * Update a sending domain
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Domain ID required" },
        { status: 400 }
      );
    }

    // Handle date conversion
    if (updates.warmupStartDate) {
      updates.warmupStartDate = new Date(updates.warmupStartDate);
    }

    const [updated] = await db
      .update(sendingDomains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sendingDomains.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ domain: updated });
  } catch (error) {
    console.error("[Domains] Error updating:", error);
    return NextResponse.json(
      { error: "Failed to update domain" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains
 *
 * Delete a sending domain
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Domain ID required" },
        { status: 400 }
      );
    }

    await db.delete(sendingDomains).where(eq(sendingDomains.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Domains] Error deleting:", error);
    return NextResponse.json(
      { error: "Failed to delete domain" },
      { status: 500 }
    );
  }
}
