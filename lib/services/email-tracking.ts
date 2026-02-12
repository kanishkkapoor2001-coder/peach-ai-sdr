/**
 * Email Tracking Service
 *
 * Handles open tracking (via pixel) and click tracking (via link rewriting).
 * All tracking is done server-side with no external dependencies (FREE).
 *
 * Features:
 * - 1x1 transparent pixel for open tracking
 * - Link rewriting for click tracking
 * - Event logging with metadata (user agent, IP, geo)
 * - Deduplication within time windows
 * - Support for tracking disabling per campaign/lead
 */

import { db } from "@/lib/db";
import { leadTouchpoints, emailEvents } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import crypto from "crypto";

// Base URL for tracking (use environment variable or default)
const getTrackingBaseUrl = () => {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
};

/**
 * Generate a unique tracking ID for a touchpoint
 */
export function generateTrackingId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Get the tracking pixel URL for an email
 */
export function getTrackingPixelUrl(trackingId: string): string {
  const baseUrl = getTrackingBaseUrl();
  return `${baseUrl}/api/track/open/${trackingId}.gif`;
}

/**
 * Wrap a URL for click tracking
 * Returns the click tracking URL that will redirect to the original
 */
export function getClickTrackingUrl(trackingId: string, originalUrl: string): string {
  const baseUrl = getTrackingBaseUrl();
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/api/track/click/${trackingId}?url=${encodedUrl}`;
}

/**
 * Generate the tracking pixel HTML to inject into emails
 */
export function getTrackingPixelHtml(trackingId: string): string {
  const pixelUrl = getTrackingPixelUrl(trackingId);
  return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
}

/**
 * Rewrite all links in HTML content to use click tracking
 */
export function rewriteLinksForTracking(html: string, trackingId: string): string {
  // Match href="..." or href='...' patterns
  const linkRegex = /href=["']([^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    // Skip mailto:, tel:, and # links
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
      return match;
    }

    // Skip if already a tracking URL
    if (url.includes("/api/track/")) {
      return match;
    }

    // Skip unsubscribe links (important for deliverability)
    if (url.toLowerCase().includes("unsubscribe")) {
      return match;
    }

    const trackedUrl = getClickTrackingUrl(trackingId, url);
    return `href="${trackedUrl}"`;
  });
}

/**
 * Process the email body to add tracking
 * Returns the modified HTML with pixel and tracked links
 */
export function addTrackingToEmail(
  html: string,
  trackingId: string,
  options: {
    trackOpens?: boolean;
    trackClicks?: boolean;
  } = {}
): string {
  const { trackOpens = true, trackClicks = true } = options;

  let trackedHtml = html;

  // Rewrite links for click tracking
  if (trackClicks) {
    trackedHtml = rewriteLinksForTracking(trackedHtml, trackingId);
  }

  // Add tracking pixel
  if (trackOpens) {
    const pixel = getTrackingPixelHtml(trackingId);

    // Try to insert before closing body tag
    if (trackedHtml.includes("</body>")) {
      trackedHtml = trackedHtml.replace("</body>", `${pixel}</body>`);
    } else {
      // Otherwise append at the end
      trackedHtml = trackedHtml + pixel;
    }
  }

  return trackedHtml;
}

/**
 * Record an email open event
 */
export async function recordOpenEvent(
  trackingId: string,
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
  } = {}
): Promise<{ success: boolean; firstOpen: boolean }> {
  try {
    // Find the touchpoint by tracking ID
    const [touchpoint] = await db
      .select()
      .from(leadTouchpoints)
      .where(eq(leadTouchpoints.trackingId, trackingId))
      .limit(1);

    if (!touchpoint) {
      console.log(`[Tracking] No touchpoint found for tracking ID: ${trackingId}`);
      return { success: false, firstOpen: false };
    }

    const isFirstOpen = touchpoint.openedAt === null;

    // Check for duplicate opens within 30 seconds (email clients often load images multiple times)
    const recentEvents = await db
      .select()
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.touchpointId, touchpoint.id),
          eq(emailEvents.eventType, "opened"),
          sql`occurred_at > NOW() - INTERVAL '30 seconds'`
        )
      )
      .limit(1);

    if (recentEvents.length > 0) {
      // Skip duplicate
      return { success: true, firstOpen: false };
    }

    // Record the event
    await db.insert(emailEvents).values({
      id: crypto.randomUUID(),
      touchpointId: touchpoint.id,
      eventType: "opened",
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      country: metadata.country,
      city: metadata.city,
      occurredAt: new Date(),
    });

    // Update the touchpoint
    await db
      .update(leadTouchpoints)
      .set({
        openedAt: touchpoint.openedAt || new Date(), // Only set if not already set
        openCount: sql`COALESCE(open_count, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(leadTouchpoints.id, touchpoint.id));

    console.log(`[Tracking] Open recorded for touchpoint ${touchpoint.id} (first: ${isFirstOpen})`);
    return { success: true, firstOpen: isFirstOpen };
  } catch (error) {
    console.error("[Tracking] Error recording open:", error);
    return { success: false, firstOpen: false };
  }
}

/**
 * Record an email click event
 */
export async function recordClickEvent(
  trackingId: string,
  clickedUrl: string,
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    city?: string;
  } = {}
): Promise<{ success: boolean; firstClick: boolean }> {
  try {
    // Find the touchpoint by tracking ID
    const [touchpoint] = await db
      .select()
      .from(leadTouchpoints)
      .where(eq(leadTouchpoints.trackingId, trackingId))
      .limit(1);

    if (!touchpoint) {
      console.log(`[Tracking] No touchpoint found for tracking ID: ${trackingId}`);
      return { success: false, firstClick: false };
    }

    const isFirstClick = touchpoint.clickedAt === null;

    // Record the event (don't deduplicate clicks - each click is valuable)
    await db.insert(emailEvents).values({
      id: crypto.randomUUID(),
      touchpointId: touchpoint.id,
      eventType: "clicked",
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      country: metadata.country,
      city: metadata.city,
      clickedUrl,
      occurredAt: new Date(),
    });

    // Update the touchpoint
    const currentLinks = (touchpoint.clickedLinks as string[]) || [];
    const updatedLinks = currentLinks.includes(clickedUrl)
      ? currentLinks
      : [...currentLinks, clickedUrl];

    await db
      .update(leadTouchpoints)
      .set({
        clickedAt: touchpoint.clickedAt || new Date(), // Only set if not already set
        clickCount: sql`COALESCE(click_count, 0) + 1`,
        clickedLinks: updatedLinks,
        updatedAt: new Date(),
      })
      .where(eq(leadTouchpoints.id, touchpoint.id));

    console.log(`[Tracking] Click recorded for touchpoint ${touchpoint.id}: ${clickedUrl}`);
    return { success: true, firstClick: isFirstClick };
  } catch (error) {
    console.error("[Tracking] Error recording click:", error);
    return { success: false, firstClick: false };
  }
}

/**
 * Record a bounce event (called from webhook handlers)
 */
export async function recordBounceEvent(
  touchpointId: string,
  bounceType: "soft" | "hard",
  bounceReason: string
): Promise<boolean> {
  try {
    await db.insert(emailEvents).values({
      id: crypto.randomUUID(),
      touchpointId,
      eventType: "bounced",
      bounceType,
      bounceReason,
      occurredAt: new Date(),
    });

    // Update touchpoint status
    await db
      .update(leadTouchpoints)
      .set({
        status: "bounced",
        errorMessage: `${bounceType} bounce: ${bounceReason}`,
        updatedAt: new Date(),
      })
      .where(eq(leadTouchpoints.id, touchpointId));

    return true;
  } catch (error) {
    console.error("[Tracking] Error recording bounce:", error);
    return false;
  }
}

/**
 * Record a complaint (spam report) event
 */
export async function recordComplaintEvent(
  touchpointId: string,
  feedbackType?: string
): Promise<boolean> {
  try {
    await db.insert(emailEvents).values({
      id: crypto.randomUUID(),
      touchpointId,
      eventType: "complained",
      bounceReason: feedbackType || "spam_complaint",
      occurredAt: new Date(),
    });

    // Update touchpoint status
    await db
      .update(leadTouchpoints)
      .set({
        status: "complained",
        errorMessage: "Marked as spam by recipient",
        updatedAt: new Date(),
      })
      .where(eq(leadTouchpoints.id, touchpointId));

    return true;
  } catch (error) {
    console.error("[Tracking] Error recording complaint:", error);
    return false;
  }
}

/**
 * Get tracking stats for a touchpoint
 */
export async function getTouchpointStats(touchpointId: string) {
  const events = await db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.touchpointId, touchpointId))
    .orderBy(emailEvents.occurredAt);

  const stats = {
    opens: events.filter(e => e.eventType === "opened").length,
    clicks: events.filter(e => e.eventType === "clicked").length,
    bounced: events.some(e => e.eventType === "bounced"),
    complained: events.some(e => e.eventType === "complained"),
    clickedUrls: [...new Set(events.filter(e => e.eventType === "clicked").map(e => e.clickedUrl))],
    firstOpenAt: events.find(e => e.eventType === "opened")?.occurredAt,
    firstClickAt: events.find(e => e.eventType === "clicked")?.occurredAt,
    events,
  };

  return stats;
}

/**
 * Get aggregate tracking stats for a campaign or sequence
 */
export async function getAggregateStats(touchpointIds: string[]) {
  if (touchpointIds.length === 0) {
    return {
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      openRate: 0,
      clickRate: 0,
      clickToOpenRate: 0,
    };
  }

  const touchpoints = await db
    .select()
    .from(leadTouchpoints)
    .where(sql`id = ANY(${touchpointIds})`);

  const totalSent = touchpoints.filter(t => t.sentAt !== null).length;
  const delivered = touchpoints.filter(t => t.deliveredAt !== null).length;
  const opened = touchpoints.filter(t => t.openedAt !== null).length;
  const clicked = touchpoints.filter(t => t.clickedAt !== null).length;
  const bounced = touchpoints.filter(t => t.status === "bounced").length;
  const complained = touchpoints.filter(t => t.status === "complained").length;

  const base = delivered > 0 ? delivered : totalSent;

  return {
    totalSent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    openRate: base > 0 ? Math.round((opened / base) * 100) : 0,
    clickRate: base > 0 ? Math.round((clicked / base) * 100) : 0,
    clickToOpenRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
  };
}

// 1x1 transparent GIF (as Buffer)
export const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
