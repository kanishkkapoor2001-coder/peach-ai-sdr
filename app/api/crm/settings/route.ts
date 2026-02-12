import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/crm/settings
 *
 * Get CRM settings (creates default if not exists)
 */
export async function GET() {
  try {
    let [settings] = await db.select().from(crmSettings).limit(1);

    // Create default settings if none exist
    if (!settings) {
      [settings] = await db
        .insert(crmSettings)
        .values({
          crmMode: "builtin",
          visibleColumns: [
            "firstName", "lastName", "email", "companyName", "jobTitle",
            "stage", "leadScore", "lastContactedAt", "totalReplies"
          ],
          customFieldDefinitions: [],
          autoAddOnReply: true,
          autoAddOnMeeting: true,
          defaultStage: "lead",
        })
        .returning();
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[CRM Settings] Get error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/settings
 *
 * Update CRM settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Get existing settings
    let [settings] = await db.select().from(crmSettings).limit(1);

    if (!settings) {
      // Create with provided values
      [settings] = await db
        .insert(crmSettings)
        .values({
          ...body,
        })
        .returning();
    } else {
      // Update existing
      [settings] = await db
        .update(crmSettings)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(crmSettings.id, settings.id))
        .returning();
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[CRM Settings] Update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
