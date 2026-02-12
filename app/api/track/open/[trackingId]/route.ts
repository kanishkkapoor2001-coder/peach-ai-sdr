import { NextRequest, NextResponse } from "next/server";
import { recordOpenEvent, TRANSPARENT_GIF } from "@/lib/services/email-tracking";

/**
 * GET /api/track/open/[trackingId].gif
 *
 * Returns a 1x1 transparent GIF and records the email open.
 * The .gif extension is stripped and handled.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId: rawTrackingId } = await params;

  // Strip .gif extension if present
  const trackingId = rawTrackingId.replace(/\.gif$/i, "");

  // Extract metadata from request
  const userAgent = request.headers.get("user-agent") || undefined;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || undefined;

  // Get geo info from Vercel headers if available
  const country = request.headers.get("x-vercel-ip-country") || undefined;
  const city = request.headers.get("x-vercel-ip-city") || undefined;

  // Record the open event (non-blocking)
  recordOpenEvent(trackingId, {
    userAgent,
    ipAddress,
    country,
    city,
  }).catch(console.error);

  // Return the transparent GIF
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      // Prevent caching to ensure we track each open
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

// Handle HEAD requests (some email clients do this)
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
    },
  });
}
