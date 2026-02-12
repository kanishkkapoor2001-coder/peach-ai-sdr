import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, emailSequences, campaigns } from "@/lib/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

/**
 * GET /api/campaigns/[id]/leads
 *
 * Get all leads for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Get all leads for this campaign
    const campaignLeads = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        jobTitle: leads.jobTitle,
        schoolName: leads.schoolName,
        schoolCountry: leads.schoolCountry,
        status: leads.status,
        leadScore: leads.leadScore,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.campaignId, campaignId));

    // Update campaign totalLeads to match actual count
    await db
      .update(campaigns)
      .set({ totalLeads: campaignLeads.length, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    console.log(`[Campaign Leads] Campaign ${campaignId} has ${campaignLeads.length} leads`);

    return NextResponse.json({
      leads: campaignLeads,
      count: campaignLeads.length,
    });
  } catch (error) {
    console.error("[Campaign Leads] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[id]/leads
 *
 * Remove leads from a campaign
 *
 * Request body:
 * - leadIds: string[] - IDs of leads to remove
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json();
    const { leadIds } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "No lead IDs specified. Provide leadIds array." },
        { status: 400 }
      );
    }

    // First, delete associated email sequences
    await db
      .delete(emailSequences)
      .where(inArray(emailSequences.leadId, leadIds));

    // Then delete the leads themselves
    const result = await db
      .delete(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          inArray(leads.id, leadIds)
        )
      )
      .returning({ id: leads.id });

    console.log(`[Remove Leads] Removed ${result.length} leads from campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      removed: result.length,
      ids: result.map(r => r.id),
    });
  } catch (error) {
    console.error("[Remove Leads] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove leads" },
      { status: 500 }
    );
  }
}
