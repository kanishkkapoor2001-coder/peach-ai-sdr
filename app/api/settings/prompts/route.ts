import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Store custom prompts in a JSON file (could also use database)
const PROMPTS_FILE = join(process.cwd(), "data", "custom-prompts.json");

interface CustomPrompts {
  skill?: string;
  overview?: string;
  angles?: string;
  updatedAt?: string;
}

/**
 * GET /api/settings/prompts
 * Get custom prompts (returns empty if using defaults)
 */
export async function GET() {
  try {
    if (!existsSync(PROMPTS_FILE)) {
      return NextResponse.json({ prompts: {} });
    }

    const data = await readFile(PROMPTS_FILE, "utf-8");
    const prompts = JSON.parse(data) as CustomPrompts;

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("[Settings] Error reading prompts:", error);
    return NextResponse.json({ prompts: {} });
  }
}

/**
 * POST /api/settings/prompts
 * Save custom prompts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skill, overview, angles } = body;

    // Ensure data directory exists
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    const prompts: CustomPrompts = {
      skill: skill || undefined,
      overview: overview || undefined,
      angles: angles || undefined,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Settings] Error saving prompts:", error);
    return NextResponse.json(
      { error: "Failed to save prompts" },
      { status: 500 }
    );
  }
}
