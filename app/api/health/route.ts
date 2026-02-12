import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * GET /api/health
 * Health check endpoint for monitoring and pre-demo verification
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; message?: string }> = {};
  let allOk = true;

  // 1. Database connection check
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok" };
  } catch (error) {
    checks.database = { status: "error", message: error instanceof Error ? error.message : "Connection failed" };
    allOk = false;
  }

  // 2. Notion API check
  try {
    if (process.env.NOTION_API_KEY) {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
        },
      });
      if (res.ok) {
        checks.notion = { status: "ok" };
      } else {
        checks.notion = { status: "error", message: "Invalid API key or permissions" };
        allOk = false;
      }
    } else {
      checks.notion = { status: "error", message: "NOTION_API_KEY not configured" };
      allOk = false;
    }
  } catch (error) {
    checks.notion = { status: "error", message: "Failed to connect to Notion" };
    allOk = false;
  }

  // 3. Anthropic API check (for AI generation)
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey !== "your_anthropic_api_key_here") {
      checks.anthropic = { status: "ok" };
    } else {
      checks.anthropic = { status: "error", message: "ANTHROPIC_API_KEY not configured (needed for AI email generation)" };
      // Don't fail overall health - AI generation is optional for some demo flows
    }
  } catch (error) {
    checks.anthropic = { status: "error", message: "API check failed" };
  }

  // 4. Resend API check (for email sending)
  try {
    if (process.env.RESEND_API_KEY) {
      checks.resend = { status: "ok" };
    } else {
      checks.resend = { status: "error", message: "RESEND_API_KEY not configured" };
      // Not critical for demo - don't set allOk to false
    }
  } catch (error) {
    checks.resend = { status: "error", message: "API check failed" };
  }

  // 5. Calendly check (optional)
  if (process.env.CALENDLY_API_KEY) {
    checks.calendly = { status: "ok" };
  } else {
    checks.calendly = { status: "error", message: "CALENDLY_API_KEY not configured (optional)" };
  }

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
    version: "1.0.0",
  }, {
    status: allOk ? 200 : 503,
  });
}
