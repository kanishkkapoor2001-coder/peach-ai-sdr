import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, leads, emailSequences } from "@/lib/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

// Helper to handle database errors
function handleDbError(error: unknown) {
  console.error("Database error:", error);

  // Check if it's a database configuration error
  if (error instanceof Error && error.message.includes("Database not configured")) {
    return NextResponse.json(
      {
        error: "Database not configured",
        message: "Please set DATABASE_URL in your .env.local file. Get a free database at https://neon.tech",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "An error occurred" },
    { status: 500 }
  );
}

// GET - List all campaigns with stats (auto-sync lead counts)
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get all campaigns first
    const allCampaigns = await db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt));

    // Get actual lead counts for each campaign in one query
    const leadCounts = await db
      .select({
        campaignId: leads.campaignId,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(sql`${leads.campaignId} IS NOT NULL`)
      .groupBy(leads.campaignId);

    // Create a map of campaignId -> lead count
    const leadCountMap = new Map<string, number>();
    for (const row of leadCounts) {
      if (row.campaignId) {
        leadCountMap.set(row.campaignId, row.count);
      }
    }

    // Update campaigns with mismatched counts (in background, don't wait)
    for (const campaign of allCampaigns) {
      const actualCount = leadCountMap.get(campaign.id) || 0;
      const storedCount = campaign.totalLeads || 0;

      if (actualCount !== storedCount) {
        console.log(`[API] Campaign ${campaign.id} lead count mismatch: stored=${storedCount}, actual=${actualCount}. Auto-fixing.`);
        db.update(campaigns)
          .set({ totalLeads: actualCount })
          .where(eq(campaigns.id, campaign.id))
          .then(() => {})
          .catch((err) => console.error(`Failed to fix count for ${campaign.id}:`, err));
      }
    }

    // Transform to expected format with stats (use actual counts from map)
    const result = allCampaigns.map((campaign) => {
      const actualLeadCount = leadCountMap.get(campaign.id) || 0;
      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        source: campaign.source,
        status: campaign.status,
        totalLeads: actualLeadCount,
        emailsGenerated: campaign.emailsGenerated || 0,
        emailsApproved: campaign.emailsApproved || 0,
        emailsSent: campaign.emailsSent || 0,
        emailsOpened: campaign.emailsOpened || 0,
        replies: campaign.replies || 0,
        positiveReplies: campaign.positiveReplies || 0,
        meetings: campaign.meetings || 0,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        stats: {
          totalLeads: actualLeadCount,
          emailsGenerated: campaign.emailsGenerated || 0,
          emailsApproved: campaign.emailsApproved || 0,
          emailsActive: 0,
          pendingReview: 0,
          highConfidence: 0,
          lowConfidence: 0,
          replies: campaign.replies || 0,
          meetings: campaign.meetings || 0,
        },
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[API] GET /api/campaigns - ${result.length} campaigns in ${duration}ms`);

    return NextResponse.json({ campaigns: result });
  } catch (error) {
    return handleDbError(error);
  }
}

// POST - Create a new campaign (auto-created from CSV/search or manual)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, source, sourceQuery, sequenceType, aiCriteria } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        name,
        description: description || null,
        source: source || "manual",
        sourceQuery: sourceQuery || null,
        status: "draft",
        sequenceType: sequenceType || "ai",
        aiCriteria: aiCriteria || null,
      })
      .returning();

    return NextResponse.json({ campaign });
  } catch (error) {
    return handleDbError(error);
  }
}

// PATCH - Update campaign status or add/remove leads (OPTIMIZED: batch updates)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates, addLeadIds, removeLeadIds } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Update campaign fields
    if (updates) {
      await db
        .update(campaigns)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(campaigns.id, id));
    }

    // Batch add leads to campaign (single query instead of loop)
    if (addLeadIds && addLeadIds.length > 0) {
      await db
        .update(leads)
        .set({ campaignId: id })
        .where(inArray(leads.id, addLeadIds));
    }

    // Batch remove leads from campaign (single query instead of loop)
    if (removeLeadIds && removeLeadIds.length > 0) {
      await db
        .update(leads)
        .set({ campaignId: null })
        .where(inArray(leads.id, removeLeadIds));
    }

    // Update campaign stats
    const [stats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.campaignId, id));

    await db
      .update(campaigns)
      .set({ totalLeads: Number(stats?.count || 0), updatedAt: new Date() })
      .where(eq(campaigns.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error);
  }
}

// DELETE - Delete a campaign
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Remove leads from campaign first
    await db
      .update(leads)
      .set({ campaignId: null })
      .where(eq(leads.campaignId, id));

    // Delete campaign
    await db.delete(campaigns).where(eq(campaigns.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error);
  }
}
