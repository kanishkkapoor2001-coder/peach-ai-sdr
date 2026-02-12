import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface UsageCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  accountType: string;
  message?: string;
}

/**
 * Check if a workspace can make an AI call
 * Returns whether the call is allowed and usage info
 */
export async function checkUsage(workspaceId: string): Promise<UsageCheckResult> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      accountType: "unknown",
      message: "Workspace not found",
    };
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const accountType = workspace.accountType || "sample";
  const limit = workspace.usageLimitPerDay || 10;

  // Reset count if it's a new day
  if (workspace.usageResetDate !== today) {
    await db
      .update(workspaces)
      .set({
        usageCountToday: 0,
        usageResetDate: today,
      })
      .where(eq(workspaces.id, workspaceId));

    return {
      allowed: true,
      currentUsage: 0,
      limit,
      accountType,
    };
  }

  const currentUsage = workspace.usageCountToday || 0;

  // Full accounts have much higher limits (essentially unlimited)
  if (accountType === "full") {
    return {
      allowed: true,
      currentUsage,
      limit,
      accountType,
    };
  }

  // Sample accounts check against limit
  if (currentUsage >= limit) {
    return {
      allowed: false,
      currentUsage,
      limit,
      accountType,
      message: `Daily usage limit reached (${currentUsage}/${limit}). Upgrade to full access for unlimited usage.`,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    accountType,
  };
}

/**
 * Increment usage count for a workspace
 * Call this after a successful AI API call
 */
export async function incrementUsage(workspaceId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  // If new day, reset then increment
  if (workspace.usageResetDate !== today) {
    await db
      .update(workspaces)
      .set({
        usageCountToday: 1,
        usageResetDate: today,
      })
      .where(eq(workspaces.id, workspaceId));
  } else {
    // Same day, just increment
    await db
      .update(workspaces)
      .set({
        usageCountToday: (workspace.usageCountToday || 0) + 1,
      })
      .where(eq(workspaces.id, workspaceId));
  }
}

/**
 * Get usage stats for a workspace
 */
export async function getUsageStats(workspaceId: string) {
  const [workspace] = await db
    .select({
      accountType: workspaces.accountType,
      usageLimitPerDay: workspaces.usageLimitPerDay,
      usageCountToday: workspaces.usageCountToday,
      usageResetDate: workspaces.usageResetDate,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];
  const isNewDay = workspace.usageResetDate !== today;

  return {
    accountType: workspace.accountType || "sample",
    limit: workspace.usageLimitPerDay || 10,
    used: isNewDay ? 0 : (workspace.usageCountToday || 0),
    remaining: isNewDay
      ? (workspace.usageLimitPerDay || 10)
      : Math.max(0, (workspace.usageLimitPerDay || 10) - (workspace.usageCountToday || 0)),
    isUnlimited: workspace.accountType === "full",
  };
}
