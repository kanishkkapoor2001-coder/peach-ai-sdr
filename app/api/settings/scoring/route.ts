import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SCORING_WEIGHTS, ScoringWeights } from "@/lib/services/lead-scorer";

const SCORING_WEIGHTS_KEY = "lead_scoring_weights";

/**
 * GET /api/settings/scoring
 *
 * Get current lead scoring weights
 */
export async function GET() {
  try {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SCORING_WEIGHTS_KEY))
      .limit(1);

    if (setting?.value) {
      const weights = JSON.parse(setting.value) as ScoringWeights;
      return NextResponse.json({
        weights,
        isDefault: false,
      });
    }

    // Return default weights if none configured
    return NextResponse.json({
      weights: DEFAULT_SCORING_WEIGHTS,
      isDefault: true,
    });
  } catch (error) {
    console.error("[Scoring Settings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/scoring
 *
 * Update lead scoring weights
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { weights } = body;

    if (!weights || typeof weights !== "object") {
      return NextResponse.json(
        { error: "Invalid weights object" },
        { status: 400 }
      );
    }

    // Validate all weight values are numbers
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== "number" || value < 0 || value > 10) {
        return NextResponse.json(
          { error: `Invalid weight value for ${key}: must be a number between 0 and 10` },
          { status: 400 }
        );
      }
    }

    // Check if setting exists
    const [existing] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SCORING_WEIGHTS_KEY))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(appSettings)
        .set({
          value: JSON.stringify(weights),
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, SCORING_WEIGHTS_KEY));
    } else {
      // Create new
      await db.insert(appSettings).values({
        key: SCORING_WEIGHTS_KEY,
        value: JSON.stringify(weights),
      });
    }

    return NextResponse.json({
      success: true,
      weights,
      message: "Scoring weights updated successfully",
    });
  } catch (error) {
    console.error("[Scoring Settings] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update scoring settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/scoring/reset
 *
 * Reset scoring weights to defaults
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "reset") {
      // Delete custom weights to reset to defaults
      await db
        .delete(appSettings)
        .where(eq(appSettings.key, SCORING_WEIGHTS_KEY));

      return NextResponse.json({
        success: true,
        weights: DEFAULT_SCORING_WEIGHTS,
        message: "Scoring weights reset to defaults",
      });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Scoring Settings] POST error:", error);
    return NextResponse.json(
      { error: "Failed to reset scoring settings" },
      { status: 500 }
    );
  }
}
