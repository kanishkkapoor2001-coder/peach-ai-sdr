import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, leads, emailSequences } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

// POST - Bulk approve sequences in a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      sequenceIds,      // Specific sequences to approve
      autoApproveOnly,  // Only approve high-confidence (8+)
      approveAll        // Approve all pending
    } = body;

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

    let approved = 0;

    if (sequenceIds && sequenceIds.length > 0) {
      // Approve specific sequences
      for (const seqId of sequenceIds) {
        await db
          .update(emailSequences)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(emailSequences.id, seqId));
        approved++;
      }
    } else if (autoApproveOnly) {
      // Auto-approve only high confidence (8+) sequences
      const result = await db
        .update(emailSequences)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          and(
            eq(emailSequences.status, "pending_review"),
            sql`${emailSequences.confidenceScore} >= 8`,
            sql`${emailSequences.leadId} IN (
              SELECT id FROM leads WHERE campaign_id = ${campaignId}
            )`
          )
        )
        .returning({ id: emailSequences.id });

      approved = result.length;
    } else if (approveAll) {
      // Approve all pending sequences in campaign
      const result = await db
        .update(emailSequences)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          and(
            eq(emailSequences.status, "pending_review"),
            sql`${emailSequences.leadId} IN (
              SELECT id FROM leads WHERE campaign_id = ${campaignId}
            )`
          )
        )
        .returning({ id: emailSequences.id });

      approved = result.length;
    }

    // Update campaign stats
    await db
      .update(campaigns)
      .set({
        emailsApproved: sql`${campaigns.emailsApproved} + ${approved}`,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json({
      message: `Approved ${approved} sequences`,
      approved,
    });
  } catch (error) {
    console.error("Failed to approve sequences:", error);
    return NextResponse.json(
      { error: "Failed to approve sequences" },
      { status: 500 }
    );
  }
}
