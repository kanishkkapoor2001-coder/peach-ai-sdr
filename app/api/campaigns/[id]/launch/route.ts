import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  leads,
  campaigns,
  sequenceTemplates,
  touchpointTemplates,
  leadTouchpoints,
} from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

/**
 * POST /api/campaigns/[id]/launch
 *
 * Launch a campaign for selected leads (or all leads if none specified)
 *
 * Request body:
 * - leadIds?: string[] - Optional specific lead IDs to launch (launches all if not provided)
 * - scheduleAt?: string - Optional ISO date to schedule launch (launches immediately if not provided)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const { leadIds, scheduleAt } = body;

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

    // 2. Get the sequence template for this campaign
    const [sequenceTemplate] = await db
      .select()
      .from(sequenceTemplates)
      .where(eq(sequenceTemplates.campaignId, campaignId))
      .limit(1);

    if (!sequenceTemplate) {
      return NextResponse.json(
        { error: "No sequence template found for this campaign. Please create a sequence first." },
        { status: 400 }
      );
    }

    // 3. Get the touchpoint templates (sequence steps)
    const touchpoints = await db
      .select()
      .from(touchpointTemplates)
      .where(eq(touchpointTemplates.sequenceTemplateId, sequenceTemplate.id))
      .orderBy(asc(touchpointTemplates.stepNumber));

    if (touchpoints.length === 0) {
      return NextResponse.json(
        { error: "No sequence steps found. Please add at least one step to the sequence." },
        { status: 400 }
      );
    }

    // 4. Get leads to launch
    let leadsToLaunch;
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      // Get specific leads
      leadsToLaunch = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.campaignId, campaignId),
            inArray(leads.id, leadIds),
            eq(leads.status, "new") // Only launch new leads
          )
        );
    } else {
      // Get all new leads for this campaign
      leadsToLaunch = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.campaignId, campaignId),
            eq(leads.status, "new")
          )
        );
    }

    if (leadsToLaunch.length === 0) {
      return NextResponse.json(
        { error: "No eligible leads to launch. Leads must have 'new' status." },
        { status: 400 }
      );
    }

    // 5. Calculate scheduled dates for each touchpoint
    const baseDate = scheduleAt ? new Date(scheduleAt) : new Date();
    const launchedLeads: string[] = [];
    const touchpointsCreated: number[] = [];

    for (const lead of leadsToLaunch) {
      let cumulativeDelay = 0;

      for (const touchpoint of touchpoints) {
        // Add delay days to get scheduled date
        cumulativeDelay += touchpoint.delayDays || 0;
        const scheduledDate = new Date(baseDate);
        scheduledDate.setDate(scheduledDate.getDate() + cumulativeDelay);

        // Create lead touchpoint record
        await db.insert(leadTouchpoints).values({
          leadId: lead.id,
          touchpointTemplateId: touchpoint.id,
          stepNumber: touchpoint.stepNumber,
          channel: touchpoint.channel,
          status: "pending",
          scheduledAt: scheduledDate,
        });

        touchpointsCreated.push(1);
      }

      // Update lead status to 'emailing' (in active sequence)
      await db
        .update(leads)
        .set({
          status: "emailing",
          updatedAt: new Date()
        })
        .where(eq(leads.id, lead.id));

      launchedLeads.push(lead.id);
    }

    // 6. Update campaign status to active
    await db
      .update(campaigns)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    console.log(`[Campaign Launch] Launched ${launchedLeads.length} leads with ${touchpointsCreated.length} touchpoints for campaign ${campaignId}`);

    // 7. Optionally send immediately scheduled emails
    const { sendNow = false } = body;
    let sendResult = null;

    if (sendNow) {
      try {
        // Call the process endpoint to send emails scheduled for now
        const baseUrl = request.nextUrl.origin;
        const processResponse = await fetch(`${baseUrl}/api/campaigns/${campaignId}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendImmediate: true }),
        });
        sendResult = await processResponse.json();
        console.log(`[Campaign Launch] Immediate send result:`, sendResult);
      } catch (error) {
        console.error("[Campaign Launch] Failed to send immediately:", error);
        sendResult = { error: "Failed to send immediately" };
      }
    }

    return NextResponse.json({
      success: true,
      launchedLeads: launchedLeads.length,
      touchpointsScheduled: touchpointsCreated.length,
      leadIds: launchedLeads,
      message: `Successfully launched ${launchedLeads.length} leads into the sequence`,
      sendResult,
    });
  } catch (error) {
    console.error("[Campaign Launch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to launch campaign" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[id]/launch
 *
 * Get launch status and stats for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // Get campaign
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

    // Get leads counts by status
    const allLeads = await db
      .select({
        id: leads.id,
        status: leads.status,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
      })
      .from(leads)
      .where(eq(leads.campaignId, campaignId));

    const newLeads = allLeads.filter(l => l.status === "new" || l.status === "approved");
    const emailingLeads = allLeads.filter(l => l.status === "emailing" || l.status === "emails_generated");
    const repliedLeads = allLeads.filter(l => l.status === "replied");
    const bookedLeads = allLeads.filter(l => l.status === "meeting_booked");

    return NextResponse.json({
      campaignStatus: campaign.status,
      totalLeads: allLeads.length,
      readyToLaunch: newLeads.length,
      launched: emailingLeads.length + repliedLeads.length + bookedLeads.length,
      replied: repliedLeads.length,
      booked: bookedLeads.length,
      leads: {
        tolaunch: newLeads,
        launched: [...emailingLeads, ...repliedLeads, ...bookedLeads],
      },
    });
  } catch (error) {
    console.error("[Campaign Launch Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get launch status" },
      { status: 500 }
    );
  }
}
