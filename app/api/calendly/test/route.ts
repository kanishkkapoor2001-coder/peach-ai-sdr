import { NextResponse } from "next/server";
import { testCalendlyConnection } from "@/lib/services/calendly-client";

/**
 * GET /api/calendly/test
 *
 * Test Calendly connection and return status
 */
export async function GET() {
  try {
    const result = await testCalendlyConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Calendly Test] Error:", error);
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Test failed",
    });
  }
}
