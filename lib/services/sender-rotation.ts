/**
 * Sender Rotation & Throttling Service
 *
 * Intelligently selects sending domains and manages throttling.
 * Goals:
 * - Maximize deliverability by rotating across multiple domains
 * - Respect warmup limits
 * - Throttle based on signals (bounces, complaints)
 * - Match signatures to domains when possible
 * - Auto-pause problematic domains
 */

import { db } from "@/lib/db";
import { sendingDomains } from "@/lib/db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import {
  calculateDailyLimit,
  checkShouldPause,
  WarmupScheduleType,
} from "@/lib/services/warmup-manager";

// Time between sends per domain (prevents spam detection)
const MIN_DELAY_MS = 30000; // 30 seconds minimum
const MAX_DELAY_MS = 120000; // 2 minutes maximum

// Cache for domain list (refreshed every 30 seconds)
let domainCache: {
  domains: (typeof sendingDomains.$inferSelect)[];
  fetchedAt: number;
} | null = null;
const DOMAIN_CACHE_TTL = 30_000;

/**
 * Rotation strategies
 */
export type RotationStrategy =
  | "round-robin"       // Simple rotation through available domains
  | "capacity-based"    // Prioritize domains with most remaining capacity
  | "health-based"      // Prioritize healthiest domains
  | "signature-match";  // Match signature in email to domain (with fallback)

export interface SelectDomainOptions {
  signatureName?: string;        // Name to match against domain (e.g., "Kanishk")
  preferredDomainId?: string;    // Force a specific domain if available
  strategy?: RotationStrategy;   // How to select among available domains
  skipPaused?: boolean;          // Skip paused domains (default: true)
}

export interface SelectedDomain {
  domain: typeof sendingDomains.$inferSelect;
  dailyLimit: number;
  remainingCapacity: number;
  recommendedDelayMs: number;
  matchedBy: "signature" | "preferred" | "strategy" | "fallback";
}

/**
 * Get all active domains with their current stats
 */
async function getActiveDomains(
  skipPaused = true
): Promise<(typeof sendingDomains.$inferSelect)[]> {
  // Check cache
  if (domainCache && Date.now() - domainCache.fetchedAt < DOMAIN_CACHE_TTL) {
    const filtered = skipPaused
      ? domainCache.domains.filter((d) => !d.isPaused)
      : domainCache.domains;
    return filtered;
  }

  // Reset daily counters if needed
  const today = new Date().toISOString().split("T")[0];
  await db
    .update(sendingDomains)
    .set({
      sentToday: 0,
      bounceCountToday: 0,
      complaintCountToday: 0,
      lastResetDate: today,
      updatedAt: new Date(),
    })
    .where(
      sql`${sendingDomains.isActive} = true AND (${sendingDomains.lastResetDate} IS NULL OR ${sendingDomains.lastResetDate} != ${today})`
    );

  // Fetch domains
  const domains = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.isActive, true));

  domainCache = { domains, fetchedAt: Date.now() };

  return skipPaused ? domains.filter((d) => !d.isPaused) : domains;
}

/**
 * Calculate recommended delay based on domain signals
 */
function calculateDelay(domain: typeof sendingDomains.$inferSelect): number {
  const baseDelay = domain.currentDelayMs || MIN_DELAY_MS;

  // Increase delay if there have been bounces
  const bounceMultiplier = 1 + (domain.bounceCountToday || 0) * 0.2;

  // Increase delay if there have been complaints
  const complaintMultiplier = 1 + (domain.complaintCountToday || 0) * 0.5;

  // Calculate final delay
  const finalDelay = Math.min(
    MAX_DELAY_MS,
    Math.max(MIN_DELAY_MS, baseDelay * bounceMultiplier * complaintMultiplier)
  );

  return Math.round(finalDelay);
}

/**
 * Check if domain name/email matches a signature
 */
function matchesSignature(
  domain: typeof sendingDomains.$inferSelect,
  signatureName: string
): boolean {
  const nameLower = signatureName.toLowerCase();
  return (
    domain.fromName?.toLowerCase().includes(nameLower) ||
    domain.fromEmail?.toLowerCase().includes(nameLower) ||
    false
  );
}

/**
 * Select the best domain for sending
 */
export async function selectSendingDomain(
  options: SelectDomainOptions = {}
): Promise<SelectedDomain | null> {
  const {
    signatureName,
    preferredDomainId,
    strategy = "capacity-based",
    skipPaused = true,
  } = options;

  const domains = await getActiveDomains(skipPaused);

  if (domains.length === 0) {
    console.log("[Rotation] No active domains available");
    return null;
  }

  // Build domain stats
  const domainsWithStats = domains.map((domain) => {
    const schedule = (domain.warmupSchedule as WarmupScheduleType) || "standard";
    const dailyLimit = calculateDailyLimit(
      domain.warmupStartDate || new Date(),
      schedule,
      domain.dailyLimit,
      domain.healthScore
    );
    const remainingCapacity = Math.max(0, dailyLimit - (domain.sentToday || 0));
    const recommendedDelayMs = calculateDelay(domain);
    const pauseReason = checkShouldPause(
      domain.bounceCountToday || 0,
      domain.complaintCountToday || 0,
      domain.sentToday || 0
    );

    return {
      domain,
      dailyLimit,
      remainingCapacity,
      recommendedDelayMs,
      shouldPause: !!pauseReason,
      pauseReason,
      matchesSignature: signatureName
        ? matchesSignature(domain, signatureName)
        : false,
    };
  });

  // Filter out domains that should be paused or have no capacity
  const availableDomains = domainsWithStats.filter(
    (d) => d.remainingCapacity > 0 && !d.shouldPause
  );

  if (availableDomains.length === 0) {
    console.log("[Rotation] All domains at capacity or paused");
    return null;
  }

  // Try to match by signature first
  if (signatureName) {
    const signatureMatch = availableDomains.find((d) => d.matchesSignature);
    if (signatureMatch) {
      console.log(
        `[Rotation] Selected ${signatureMatch.domain.domain} by signature match`
      );
      return {
        ...signatureMatch,
        matchedBy: "signature",
      };
    }
  }

  // Try preferred domain
  if (preferredDomainId) {
    const preferred = availableDomains.find(
      (d) => d.domain.id === preferredDomainId
    );
    if (preferred) {
      console.log(
        `[Rotation] Selected ${preferred.domain.domain} by preference`
      );
      return {
        ...preferred,
        matchedBy: "preferred",
      };
    }
  }

  // Apply strategy
  let selected: typeof availableDomains[0] | undefined;

  switch (strategy) {
    case "round-robin":
      // Select domain with lowest sent count today (simple rotation)
      selected = availableDomains.sort(
        (a, b) => (a.domain.sentToday || 0) - (b.domain.sentToday || 0)
      )[0];
      break;

    case "health-based":
      // Prioritize domains with highest health score
      selected = availableDomains.sort(
        (a, b) => (b.domain.healthScore || 0) - (a.domain.healthScore || 0)
      )[0];
      break;

    case "capacity-based":
    default:
      // Prioritize domains with most remaining capacity
      selected = availableDomains.sort(
        (a, b) => b.remainingCapacity - a.remainingCapacity
      )[0];
      break;
  }

  if (selected) {
    console.log(
      `[Rotation] Selected ${selected.domain.domain} by ${strategy} strategy`
    );
    return {
      ...selected,
      matchedBy: "strategy",
    };
  }

  // Fallback to first available
  const fallback = availableDomains[0];
  if (fallback) {
    console.log(`[Rotation] Selected ${fallback.domain.domain} as fallback`);
    return {
      ...fallback,
      matchedBy: "fallback",
    };
  }

  return null;
}

/**
 * Record a send and update domain stats
 */
export async function recordSend(
  domainId: string
): Promise<{ success: boolean; newSentCount: number }> {
  const result = await db
    .update(sendingDomains)
    .set({
      sentToday: sql`${sendingDomains.sentToday} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId))
    .returning({ sentToday: sendingDomains.sentToday });

  // Invalidate cache
  domainCache = null;

  return {
    success: result.length > 0,
    newSentCount: result[0]?.sentToday || 0,
  };
}

/**
 * Increase throttle delay for a domain (after bounce/complaint)
 */
export async function increaseThrottle(
  domainId: string,
  reason: "bounce" | "complaint"
): Promise<void> {
  const [domain] = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.id, domainId))
    .limit(1);

  if (!domain) return;

  const currentDelay = domain.currentDelayMs || MIN_DELAY_MS;
  const multiplier = reason === "complaint" ? 2 : 1.5;
  const newDelay = Math.min(MAX_DELAY_MS, Math.round(currentDelay * multiplier));

  await db
    .update(sendingDomains)
    .set({
      currentDelayMs: newDelay,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId));

  console.log(
    `[Rotation] Increased throttle for ${domain.domain}: ${currentDelay}ms -> ${newDelay}ms (${reason})`
  );

  // Invalidate cache
  domainCache = null;
}

/**
 * Gradually decrease throttle delay (call daily or when metrics improve)
 */
export async function decreaseThrottle(domainId: string): Promise<void> {
  const [domain] = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.id, domainId))
    .limit(1);

  if (!domain) return;

  const currentDelay = domain.currentDelayMs || MIN_DELAY_MS;
  if (currentDelay <= MIN_DELAY_MS) return; // Already at minimum

  const newDelay = Math.max(MIN_DELAY_MS, Math.round(currentDelay * 0.8));

  await db
    .update(sendingDomains)
    .set({
      currentDelayMs: newDelay,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId));

  console.log(
    `[Rotation] Decreased throttle for ${domain.domain}: ${currentDelay}ms -> ${newDelay}ms`
  );

  // Invalidate cache
  domainCache = null;
}

/**
 * Get rotation stats for all domains
 */
export async function getRotationStats() {
  const domains = await getActiveDomains(false); // Include paused

  const stats = domains.map((domain) => {
    const schedule = (domain.warmupSchedule as WarmupScheduleType) || "standard";
    const dailyLimit = calculateDailyLimit(
      domain.warmupStartDate || new Date(),
      schedule,
      domain.dailyLimit,
      domain.healthScore
    );

    return {
      id: domain.id,
      domain: domain.domain,
      fromEmail: domain.fromEmail,
      fromName: domain.fromName,
      isActive: domain.isActive,
      isPaused: domain.isPaused,
      pauseReason: domain.pauseReason,
      sentToday: domain.sentToday || 0,
      dailyLimit,
      remainingCapacity: Math.max(0, dailyLimit - (domain.sentToday || 0)),
      healthScore: domain.healthScore,
      currentDelayMs: domain.currentDelayMs || MIN_DELAY_MS,
      bounceCountToday: domain.bounceCountToday || 0,
      complaintCountToday: domain.complaintCountToday || 0,
    };
  });

  const summary = {
    totalDomains: stats.length,
    activeDomains: stats.filter((d) => d.isActive && !d.isPaused).length,
    pausedDomains: stats.filter((d) => d.isPaused).length,
    totalCapacity: stats
      .filter((d) => d.isActive && !d.isPaused)
      .reduce((sum, d) => sum + d.dailyLimit, 0),
    totalRemaining: stats
      .filter((d) => d.isActive && !d.isPaused)
      .reduce((sum, d) => sum + d.remainingCapacity, 0),
    totalSentToday: stats.reduce((sum, d) => sum + d.sentToday, 0),
  };

  return { domains: stats, summary };
}
