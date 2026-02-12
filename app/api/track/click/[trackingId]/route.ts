import { NextRequest, NextResponse } from "next/server";
import { recordClickEvent } from "@/lib/services/email-tracking";

/**
 * GET /api/track/click/[trackingId]?url=...
 *
 * Records the click and redirects to the original URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  // Validate URL
  if (!targetUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Decode the URL
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch {
    decodedUrl = targetUrl;
  }

  // Ensure it's a valid URL
  try {
    new URL(decodedUrl);
  } catch {
    // If not a valid absolute URL, redirect to homepage
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Extract metadata from request
  const userAgent = request.headers.get("user-agent") || undefined;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || undefined;

  // Get geo info from Vercel headers if available
  const country = request.headers.get("x-vercel-ip-country") || undefined;
  const city = request.headers.get("x-vercel-ip-city") || undefined;

  // Record the click event (non-blocking)
  recordClickEvent(trackingId, decodedUrl, {
    userAgent,
    ipAddress,
    country,
    city,
  }).catch(console.error);

  // Redirect to the target URL
  return NextResponse.redirect(decodedUrl, {
    status: 302, // Temporary redirect
    headers: {
      // Security headers
      "Referrer-Policy": "no-referrer",
    },
  });
}
