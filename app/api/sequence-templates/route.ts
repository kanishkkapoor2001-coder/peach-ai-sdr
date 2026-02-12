import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sequenceTemplates, touchpointTemplates, campaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// Helper to handle database errors
function handleDbError(error: unknown) {
  console.error("Database error:", error);

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

// GET - List all sequence templates (optionally by campaign)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get("campaignId");

    let query = db
      .select()
      .from(sequenceTemplates)
      .orderBy(desc(sequenceTemplates.createdAt));

    const templates = campaignId
      ? await db
          .select()
          .from(sequenceTemplates)
          .where(eq(sequenceTemplates.campaignId, campaignId))
          .orderBy(desc(sequenceTemplates.createdAt))
      : await query;

    // Get touchpoints for each template
    const templatesWithTouchpoints = await Promise.all(
      templates.map(async (template) => {
        const touchpoints = await db
          .select()
          .from(touchpointTemplates)
          .where(eq(touchpointTemplates.sequenceTemplateId, template.id))
          .orderBy(touchpointTemplates.stepNumber);

        return {
          ...template,
          touchpoints,
        };
      })
    );

    return NextResponse.json({ templates: templatesWithTouchpoints });
  } catch (error) {
    return handleDbError(error);
  }
}

// POST - Create a new sequence template with touchpoints
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, name, description, generationType, aiReasoning, touchpoints } = body;

    if (!campaignId || !name) {
      return NextResponse.json(
        { error: "Campaign ID and name are required" },
        { status: 400 }
      );
    }

    // Verify campaign exists
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

    // Create sequence template
    const [template] = await db
      .insert(sequenceTemplates)
      .values({
        campaignId,
        name,
        description: description || null,
        generationType: generationType || "manual",
        aiReasoning: aiReasoning || null,
        isActive: true,
      })
      .returning();

    // Create touchpoint templates if provided
    if (touchpoints && Array.isArray(touchpoints) && touchpoints.length > 0) {
      const touchpointValues = touchpoints.map((tp: any, index: number) => ({
        sequenceTemplateId: template.id,
        stepNumber: index + 1,
        channel: tp.channel || "email",
        delayDays: tp.delayDays || 0,
        preferredTimeOfDay: tp.preferredTimeOfDay || null,
        subject: tp.subject || null,
        body: tp.body || null,
        talkingPoints: tp.talkingPoints || [],
        personalizationNotes: tp.personalizationNotes || null,
      }));

      await db.insert(touchpointTemplates).values(touchpointValues);
    }

    // Fetch the complete template with touchpoints
    const createdTouchpoints = await db
      .select()
      .from(touchpointTemplates)
      .where(eq(touchpointTemplates.sequenceTemplateId, template.id))
      .orderBy(touchpointTemplates.stepNumber);

    return NextResponse.json({
      template: {
        ...template,
        touchpoints: createdTouchpoints,
      },
    });
  } catch (error) {
    return handleDbError(error);
  }
}

// PATCH - Update a sequence template
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates, touchpoints } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Update template fields
    if (updates) {
      await db
        .update(sequenceTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(sequenceTemplates.id, id));
    }

    // Replace touchpoints if provided
    if (touchpoints && Array.isArray(touchpoints)) {
      // Delete existing touchpoints
      await db
        .delete(touchpointTemplates)
        .where(eq(touchpointTemplates.sequenceTemplateId, id));

      // Insert new touchpoints
      if (touchpoints.length > 0) {
        const touchpointValues = touchpoints.map((tp: any, index: number) => ({
          sequenceTemplateId: id,
          stepNumber: index + 1,
          channel: tp.channel || "email",
          delayDays: tp.delayDays || 0,
          preferredTimeOfDay: tp.preferredTimeOfDay || null,
          subject: tp.subject || null,
          body: tp.body || null,
          talkingPoints: tp.talkingPoints || [],
          personalizationNotes: tp.personalizationNotes || null,
        }));

        await db.insert(touchpointTemplates).values(touchpointValues);
      }
    }

    // Fetch updated template
    const [template] = await db
      .select()
      .from(sequenceTemplates)
      .where(eq(sequenceTemplates.id, id));

    const updatedTouchpoints = await db
      .select()
      .from(touchpointTemplates)
      .where(eq(touchpointTemplates.sequenceTemplateId, id))
      .orderBy(touchpointTemplates.stepNumber);

    return NextResponse.json({
      template: {
        ...template,
        touchpoints: updatedTouchpoints,
      },
    });
  } catch (error) {
    return handleDbError(error);
  }
}

// DELETE - Delete a sequence template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Delete touchpoints first (cascade should handle this, but being explicit)
    await db
      .delete(touchpointTemplates)
      .where(eq(touchpointTemplates.sequenceTemplateId, id));

    // Delete template
    await db.delete(sequenceTemplates).where(eq(sequenceTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDbError(error);
  }
}
