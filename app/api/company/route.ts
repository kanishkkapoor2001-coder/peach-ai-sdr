import { NextRequest, NextResponse } from "next/server";
import { db, companyContext } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/company
 *
 * Get the active company context
 */
export async function GET() {
  try {
    const companies = await db
      .select()
      .from(companyContext)
      .where(eq(companyContext.isActive, true))
      .limit(1);

    if (companies.length === 0) {
      return NextResponse.json({ company: null });
    }

    return NextResponse.json({ company: companies[0] });
  } catch (error) {
    console.error("[Company Context] Error fetching:", error);
    return NextResponse.json(
      { error: "Failed to fetch company context" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/company
 *
 * Create or update company context
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      companyName,
      companyWebsite,
      companyDescription,
      industry,
      valuePropositions,
      targetMarkets,
      painPoints,
      differentiators,
      emailTone,
      senderName,
      senderTitle,
      signatureBlock,
    } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Deactivate any existing company contexts
    await db
      .update(companyContext)
      .set({ isActive: false })
      .where(eq(companyContext.isActive, true));

    // Create new company context
    const [newCompany] = await db
      .insert(companyContext)
      .values({
        companyName,
        companyWebsite: companyWebsite || null,
        companyDescription: companyDescription || null,
        industry: industry || null,
        valuePropositions: valuePropositions || [],
        targetMarkets: targetMarkets || [],
        painPoints: painPoints || [],
        differentiators: differentiators || [],
        emailTone: emailTone || "professional",
        senderName: senderName || null,
        senderTitle: senderTitle || null,
        signatureBlock: signatureBlock || null,
        isActive: true,
      })
      .returning();

    console.log(`[Company Context] Created company: ${companyName}`);

    return NextResponse.json({
      success: true,
      company: newCompany,
    });
  } catch (error) {
    console.error("[Company Context] Error creating:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create company context" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/company
 *
 * Update existing company context
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const [updated] = await db
      .update(companyContext)
      .set({
        ...cleanUpdates,
        updatedAt: new Date(),
      })
      .where(eq(companyContext.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      company: updated,
    });
  } catch (error) {
    console.error("[Company Context] Error updating:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update company context" },
      { status: 500 }
    );
  }
}
