import { NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * GET /api/domains/check-resend
 *
 * Check if Resend API key is configured and list verified domains
 */
export async function GET() {
  const key = process.env.RESEND_API_KEY;

  // Valid Resend keys start with "re_" and are at least 20 chars
  const configured = !!(
    key &&
    key.startsWith("re_") &&
    key.length > 20 &&
    key !== "re_..." &&
    !key.includes("your_") &&
    !key.includes("placeholder")
  );

  if (!configured) {
    return NextResponse.json({
      configured: false,
      hint: "Add RESEND_API_KEY=re_xxx to .env.local (get it from resend.com)"
    });
  }

  // Try to list domains from Resend
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.domains.list();

    if (error) {
      return NextResponse.json({
        configured: true,
        error: error.message,
        domains: []
      });
    }

    return NextResponse.json({
      configured: true,
      domains: data?.data?.map((d: any) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        region: d.region,
        createdAt: d.created_at
      })) || [],
      hint: data?.data?.length === 0
        ? "No domains verified. Go to resend.com/domains to add and verify your domain."
        : undefined
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      error: error instanceof Error ? error.message : "Failed to check domains",
      domains: []
    });
  }
}
