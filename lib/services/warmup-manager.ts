/**
 * Warmup Manager Service
 *
 * Manages email warmup schedules for sending domains.
 * Supports multiple warmup schedules and automatic adjustment based on signals.
 *
 * Warmup Philosophy:
 * - Start slow and ramp up gradually
 * - Monitor bounce/complaint rates
 * - Auto-pause on problems
 * - Health score affects daily limits
 */

import { db } from "@/lib/db";
import { sendingDomains } from "@/lib/db/schema";
import { eq, sql, and, lt, isNull, or } from "drizzle-orm";

// Warmup schedules with different ramp-up speeds
export const WARMUP_SCHEDULES = {
  // Standard 4-week warmup (conservative)
  standard: [
    { days: 0, limit: 5 },
    { days: 3, limit: 10 },
    { days: 7, limit: 20 },
    { days: 14, limit: 35 },
    { days: 21, limit: 50 },
    { days: 28, limit: 75 },
    { days: 35, limit: 100 },
  ],
  // Aggressive 2-week warmup (for warmed domains)
  aggressive: [
    { days: 0, limit: 10 },
    { days: 3, limit: 25 },
    { days: 7, limit: 50 },
    { days: 10, limit: 75 },
    { days: 14, limit: 100 },
    { days: 21, limit: 150 },
  ],
  // Slow 6-week warmup (for brand new domains)
  slow: [
    { days: 0, limit: 2 },
    { days: 5, limit: 5 },
    { days: 10, limit: 10 },
    { days: 15, limit: 15 },
    { days: 20, limit: 25 },
    { days: 30, limit: 40 },
    { days: 40, limit: 60 },
    { days: 50, limit: 80 },
    { days: 60, limit: 100 },
  ],
  // Already warmed (start high)
  warmed: [
    { days: 0, limit: 50 },
    { days: 7, limit: 75 },
    { days: 14, limit: 100 },
    { days: 21, limit: 150 },
  ],
  // Custom (uses daily_limit field directly)
  custom: [],
} as const;

export type WarmupScheduleType = keyof typeof WARMUP_SCHEDULES;

/**
 * Calculate the daily send limit for a domain based on warmup schedule
 */
export function calculateDailyLimit(
  warmupStartDate: Date,
  schedule: WarmupScheduleType = "standard",
  customLimit?: number | null,
  healthScore?: number | null
): number {
  // For custom schedule, use the custom limit
  if (schedule === "custom" && customLimit) {
    return adjustForHealth(customLimit, healthScore);
  }

  const tiers = WARMUP_SCHEDULES[schedule] || WARMUP_SCHEDULES.standard;
  const daysSinceWarmup = Math.floor(
    (Date.now() - warmupStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Find the appropriate tier
  let limit: number = tiers[0]?.limit || 5;
  for (const tier of tiers) {
    if (daysSinceWarmup >= tier.days) {
      limit = tier.limit;
    }
  }

  return adjustForHealth(limit, healthScore);
}

/**
 * Adjust daily limit based on domain health score
 * - Excellent (90-100): No adjustment
 * - Good (70-89): 90% of limit
 * - Warning (50-69): 75% of limit
 * - Critical (0-49): 50% of limit
 */
function adjustForHealth(baseLimit: number, healthScore?: number | null): number {
  if (!healthScore) return baseLimit;

  let multiplier = 1;
  if (healthScore >= 90) {
    multiplier = 1;
  } else if (healthScore >= 70) {
    multiplier = 0.9;
  } else if (healthScore >= 50) {
    multiplier = 0.75;
  } else {
    multiplier = 0.5;
  }

  return Math.max(1, Math.floor(baseLimit * multiplier));
}

/**
 * Get warmup progress for a domain
 */
export function getWarmupProgress(
  warmupStartDate: Date,
  schedule: WarmupScheduleType = "standard"
): {
  daysSinceStart: number;
  currentTier: number;
  currentLimit: number;
  nextTier?: { days: number; limit: number };
  daysToNextTier?: number;
  percentComplete: number;
} {
  const tiers = WARMUP_SCHEDULES[schedule] || WARMUP_SCHEDULES.standard;
  const daysSinceStart = Math.floor(
    (Date.now() - warmupStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Find current tier
  let currentTierIndex = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (daysSinceStart >= tiers[i].days) {
      currentTierIndex = i;
    }
  }

  const currentTier = tiers[currentTierIndex];
  const nextTier = tiers[currentTierIndex + 1];

  // Calculate percent complete (based on reaching max tier)
  const maxTier = tiers[tiers.length - 1];
  const percentComplete = Math.min(100, Math.round((daysSinceStart / maxTier.days) * 100));

  return {
    daysSinceStart,
    currentTier: currentTierIndex + 1,
    currentLimit: currentTier.limit,
    nextTier: nextTier ? { days: nextTier.days, limit: nextTier.limit } : undefined,
    daysToNextTier: nextTier ? nextTier.days - daysSinceStart : undefined,
    percentComplete,
  };
}

/**
 * Check if domain should be paused based on bounce/complaint rates
 * Returns pause reason if should pause, null if OK
 */
export function checkShouldPause(
  bounceCountToday: number,
  complaintCountToday: number,
  sentToday: number
): string | null {
  if (sentToday < 5) return null; // Need minimum sends to evaluate

  const bounceRate = (bounceCountToday / sentToday) * 100;
  const complaintRate = (complaintCountToday / sentToday) * 100;

  // Hard pause thresholds
  if (complaintCountToday >= 2) {
    return `High complaint count (${complaintCountToday} complaints)`;
  }
  if (complaintRate >= 0.1) {
    return `High complaint rate (${complaintRate.toFixed(2)}%)`;
  }
  if (bounceRate >= 5) {
    return `High bounce rate (${bounceRate.toFixed(1)}%)`;
  }
  if (bounceCountToday >= 10) {
    return `High bounce count (${bounceCountToday} bounces)`;
  }

  return null;
}

/**
 * Record a bounce for a domain
 */
export async function recordBounce(domainId: string): Promise<{ paused: boolean; reason?: string }> {
  // Get current domain stats
  const [domain] = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.id, domainId))
    .limit(1);

  if (!domain) {
    return { paused: false };
  }

  const newBounceCount = (domain.bounceCountToday || 0) + 1;

  // Check if we should pause
  const pauseReason = checkShouldPause(
    newBounceCount,
    domain.complaintCountToday || 0,
    domain.sentToday || 0
  );

  // Update domain
  await db
    .update(sendingDomains)
    .set({
      bounceCountToday: newBounceCount,
      lastBounceAt: new Date(),
      isPaused: !!pauseReason,
      pauseReason: pauseReason || undefined,
      pausedAt: pauseReason ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId));

  if (pauseReason) {
    console.log(`[Warmup] Domain ${domain.domain} paused: ${pauseReason}`);
  }

  return { paused: !!pauseReason, reason: pauseReason || undefined };
}

/**
 * Record a complaint for a domain
 */
export async function recordComplaint(domainId: string): Promise<{ paused: boolean; reason?: string }> {
  // Get current domain stats
  const [domain] = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.id, domainId))
    .limit(1);

  if (!domain) {
    return { paused: false };
  }

  const newComplaintCount = (domain.complaintCountToday || 0) + 1;

  // Check if we should pause
  const pauseReason = checkShouldPause(
    domain.bounceCountToday || 0,
    newComplaintCount,
    domain.sentToday || 0
  );

  // Update domain
  await db
    .update(sendingDomains)
    .set({
      complaintCountToday: newComplaintCount,
      isPaused: !!pauseReason,
      pauseReason: pauseReason || undefined,
      pausedAt: pauseReason ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId));

  if (pauseReason) {
    console.log(`[Warmup] Domain ${domain.domain} paused: ${pauseReason}`);
  }

  return { paused: !!pauseReason, reason: pauseReason || undefined };
}

/**
 * Resume a paused domain
 */
export async function resumeDomain(domainId: string): Promise<boolean> {
  const result = await db
    .update(sendingDomains)
    .set({
      isPaused: false,
      pauseReason: null,
      pausedAt: null,
      // Reset today's counters on resume to give it a fresh start
      bounceCountToday: 0,
      complaintCountToday: 0,
      updatedAt: new Date(),
    })
    .where(eq(sendingDomains.id, domainId));

  return (result as any).rowCount > 0;
}

/**
 * Reset daily counters for all domains
 * Should be called at midnight or start of day
 */
export async function resetDailyCounters(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const result = await db
    .update(sendingDomains)
    .set({
      sentToday: 0,
      bounceCountToday: 0,
      complaintCountToday: 0,
      lastResetDate: today,
      updatedAt: new Date(),
    })
    .where(
      or(
        isNull(sendingDomains.lastResetDate),
        sql`${sendingDomains.lastResetDate} != ${today}`
      )
    );

  return (result as any).rowCount || 0;
}

/**
 * Get comprehensive warmup status for all domains
 */
export async function getAllDomainsWarmupStatus() {
  // Reset daily counters if needed
  await resetDailyCounters();

  const domains = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.isActive, true));

  return domains.map((domain) => {
    const schedule = (domain.warmupSchedule as WarmupScheduleType) || "standard";
    const warmupStartDate = domain.warmupStartDate || new Date();

    const dailyLimit = calculateDailyLimit(
      warmupStartDate,
      schedule,
      domain.dailyLimit,
      domain.healthScore
    );

    const progress = getWarmupProgress(warmupStartDate, schedule);

    const pauseReason = checkShouldPause(
      domain.bounceCountToday || 0,
      domain.complaintCountToday || 0,
      domain.sentToday || 0
    );

    return {
      id: domain.id,
      domain: domain.domain,
      fromEmail: domain.fromEmail,
      fromName: domain.fromName,
      // Warmup info
      schedule,
      warmupStartDate,
      progress,
      // Limits
      dailyLimit,
      sentToday: domain.sentToday || 0,
      remainingToday: Math.max(0, dailyLimit - (domain.sentToday || 0)),
      // Health
      healthScore: domain.healthScore,
      healthStatus: domain.healthStatus,
      // Status
      isActive: domain.isActive,
      isPaused: domain.isPaused || !!pauseReason,
      pauseReason: domain.pauseReason || pauseReason,
      // Today's signals
      bounceCountToday: domain.bounceCountToday || 0,
      complaintCountToday: domain.complaintCountToday || 0,
    };
  });
}

/**
 * Update warmup schedule for a domain
 */
export async function updateWarmupSchedule(
  domainId: string,
  schedule: WarmupScheduleType,
  customLimit?: number
): Promise<boolean> {
  const updateData: Record<string, any> = {
    warmupSchedule: schedule,
    updatedAt: new Date(),
  };

  if (schedule === "custom" && customLimit) {
    updateData.dailyLimit = customLimit;
  }

  const result = await db
    .update(sendingDomains)
    .set(updateData)
    .where(eq(sendingDomains.id, domainId));

  return (result as any).rowCount > 0;
}
