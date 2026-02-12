import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sequenceTemplates, touchpointTemplates, campaigns } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

// GET - Get sequence steps for a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;

    // First, get or create the sequence template for this campaign
    let [sequenceTemplate] = await db
      .select()
      .from(sequenceTemplates)
      .where(eq(sequenceTemplates.campaignId, campaignId))
      .limit(1);

    // If no sequence template exists, return empty steps
    if (!sequenceTemplate) {
      return NextResponse.json({ steps: [], sequenceTemplate: null });
    }

    // Get all touchpoint templates for this sequence, ordered by step number
    const steps = await db
      .select({
        id: touchpointTemplates.id,
        stepNumber: touchpointTemplates.stepNumber,
        channel: touchpointTemplates.channel,
        delayDays: touchpointTemplates.delayDays,
        subject: touchpointTemplates.subject,
        body: touchpointTemplates.body,
        preferredTimeOfDay: touchpointTemplates.preferredTimeOfDay,
        personalizationNotes: touchpointTemplates.personalizationNotes,
        createdAt: touchpointTemplates.createdAt,
      })
      .from(touchpointTemplates)
      .where(eq(touchpointTemplates.sequenceTemplateId, sequenceTemplate.id))
      .orderBy(asc(touchpointTemplates.stepNumber));

    return NextResponse.json({
      steps,
      sequenceTemplate: {
        id: sequenceTemplate.id,
        name: sequenceTemplate.name,
        generationType: sequenceTemplate.generationType,
      },
    });
  } catch (error) {
    console.error("Error fetching sequence:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

// POST - Add a new step to the sequence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json();

    // Get or create the sequence template
    let [sequenceTemplate] = await db
      .select()
      .from(sequenceTemplates)
      .where(eq(sequenceTemplates.campaignId, campaignId))
      .limit(1);

    if (!sequenceTemplate) {
      // Create a new sequence template
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

      [sequenceTemplate] = await db
        .insert(sequenceTemplates)
        .values({
          campaignId,
          name: `${campaign.name} Sequence`,
          generationType: "manual",
        })
        .returning();
    }

    // Create the new touchpoint
    const [newStep] = await db
      .insert(touchpointTemplates)
      .values({
        sequenceTemplateId: sequenceTemplate.id,
        stepNumber: body.stepNumber || 1,
        channel: body.channel || "email",
        delayDays: body.delayDays || 0,
        subject: body.subject || null,
        body: body.body || null,
        preferredTimeOfDay: body.preferredTimeOfDay || null,
        personalizationNotes: body.personalizationNotes || null,
      })
      .returning();

    return NextResponse.json({ step: newStep });
  } catch (error) {
    console.error("Error adding step:", error);
    return NextResponse.json(
      { error: "Failed to add step" },
      { status: 500 }
    );
  }
}
