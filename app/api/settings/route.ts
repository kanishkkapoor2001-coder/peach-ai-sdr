import { NextRequest, NextResponse } from "next/server";
import { db, appSettings } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/settings
 *
 * Get all app settings or specific keys
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keys = searchParams.get("keys")?.split(",");

    let settings;
    if (keys && keys.length > 0) {
      settings = await db
        .select()
        .from(appSettings)
        .where(
          // Get settings matching any of the keys
          eq(appSettings.key, keys[0]) // For single key
        );

      // If multiple keys, get all and filter
      if (keys.length > 1) {
        const allSettings = await db.select().from(appSettings);
        settings = allSettings.filter(s => keys.includes(s.key));
      }
    } else {
      settings = await db.select().from(appSettings);
    }

    // Convert to key-value object
    const settingsMap: Record<string, string | null> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("[Settings] Error fetching:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings
 *
 * Save app settings (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return NextResponse.json(
        { error: "Settings object required" },
        { status: 400 }
      );
    }

    const results: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      // Check if setting exists
      const existing = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        // Update
        await db
          .update(appSettings)
          .set({ value, updatedAt: new Date() })
          .where(eq(appSettings.key, key));
      } else {
        // Insert
        await db.insert(appSettings).values({ key, value });
      }

      results.push(key);
    }

    return NextResponse.json({
      success: true,
      saved: results,
    });
  } catch (error) {
    console.error("[Settings] Error saving:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
