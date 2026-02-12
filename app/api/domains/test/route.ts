import { NextRequest, NextResponse } from "next/server";
import { testSmtpConnection } from "@/lib/services/email-sender";

/**
 * POST /api/domains/test?id=...
 *
 * Test SMTP connection for a domain
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Domain ID required" },
        { status: 400 }
      );
    }

    const result = await testSmtpConnection(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Domains Test] Error:", error);
    return NextResponse.json(
      { success: false, error: "Test failed" },
      { status: 500 }
    );
  }
}
