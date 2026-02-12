/**
 * Smart Lead Scoring System
 *
 * Calculates lead quality scores (0-10) based on:
 * - Role fit (decision-making power)
 * - School fit (budget, tech readiness)
 * - Engagement (email interactions)
 * - Context (relevance signals)
 *
 * Scoring weights are configurable via Settings > Lead Scoring.
 */

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SCORING_WEIGHTS_KEY = "lead_scoring_weights";

// Default scoring weights (can be stored in DB for customization)
export const DEFAULT_SCORING_WEIGHTS = {
  // Role fit
  rolePrincipal: 2.0,
  roleCurriculumHead: 1.5,
  roleITDirector: 1.0,
  roleDepartmentHead: 0.5,

  // School fit
  premiumFees: 1.5, // > $10k/year
  midRangeFees: 1.0, // $5-10k/year
  oneToOneDevices: 1.5,
  sharedDevices: 0.5,
  internationalSchool: 1.0,
  ibCurriculum: 1.0,
  igcseCurriculum: 0.5,

  // Engagement
  positiveReply: 2.0,
  neutralReply: 1.0,
  multipleOpens: 0.5,
  linkClicked: 0.5,

  // Context
  recentNews: 0.5,
  aiPolicyMentioned: 0.5,
};

export type ScoringWeights = typeof DEFAULT_SCORING_WEIGHTS;

export interface LeadData {
  // Role info
  jobTitle: string;

  // School info
  schoolName: string;
  schoolCountry?: string | null;
  schoolRegion?: string | null;
  curriculum?: string[] | null;
  annualFeesUsd?: number | null;
  studentCount?: number | null;
  deviceAccess?: string | null;

  // Engagement
  replySentiment?: "positive" | "neutral" | "negative" | null;
  emailOpens?: number | null;
  linkClicks?: number | null;

  // Context
  researchSummary?: string | null;
}

/**
 * Normalize a job title to identify role type
 */
function normalizeRole(
  jobTitle: string
): "principal" | "curriculum" | "it" | "department" | "other" {
  const title = jobTitle.toLowerCase();

  // Principal/Head level
  if (
    title.includes("principal") ||
    title.includes("head of school") ||
    title.includes("headmaster") ||
    title.includes("headmistress") ||
    title.includes("director") && title.includes("school") ||
    title.includes("ceo") ||
    title.includes("superintendent")
  ) {
    return "principal";
  }

  // Curriculum/Academic leadership
  if (
    title.includes("curriculum") ||
    title.includes("academic") && (title.includes("head") || title.includes("director")) ||
    title.includes("deputy head") ||
    title.includes("vice principal") ||
    title.includes("assistant principal") ||
    title.includes("coordinator") && (title.includes("ib") || title.includes("igcse"))
  ) {
    return "curriculum";
  }

  // IT/Technology
  if (
    title.includes("it ") ||
    title.includes("technology") ||
    title.includes("ict") ||
    title.includes("digital") ||
    title.includes("edtech") ||
    title.includes("e-learning")
  ) {
    return "it";
  }

  // Department heads
  if (
    title.includes("head of") ||
    title.includes("department head") ||
    title.includes("chair")
  ) {
    return "department";
  }

  return "other";
}

/**
 * Check if school appears to be international
 */
function isInternationalSchool(schoolName: string, country?: string | null): boolean {
  const name = schoolName.toLowerCase();
  return (
    name.includes("international") ||
    name.includes("american school") ||
    name.includes("british school") ||
    name.includes("world school") ||
    (country !== null && country !== undefined && !["united states", "usa", "uk", "united kingdom"].includes(country.toLowerCase()))
  );
}

/**
 * Calculate lead score based on available data
 */
export function calculateLeadScore(
  lead: LeadData,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  let score = 0;

  // --- Role Fit ---
  const roleType = normalizeRole(lead.jobTitle);
  switch (roleType) {
    case "principal":
      score += weights.rolePrincipal;
      break;
    case "curriculum":
      score += weights.roleCurriculumHead;
      break;
    case "it":
      score += weights.roleITDirector;
      break;
    case "department":
      score += weights.roleDepartmentHead;
      break;
  }

  // --- School Fit ---

  // Fee level
  if (lead.annualFeesUsd) {
    if (lead.annualFeesUsd > 10000) {
      score += weights.premiumFees;
    } else if (lead.annualFeesUsd >= 5000) {
      score += weights.midRangeFees;
    }
  }

  // Device access
  if (lead.deviceAccess) {
    const device = lead.deviceAccess.toLowerCase();
    if (device.includes("1:1") || device.includes("one-to-one") || device.includes("byod")) {
      score += weights.oneToOneDevices;
    } else if (device.includes("shared") || device.includes("lab")) {
      score += weights.sharedDevices;
    }
  }

  // International school
  if (isInternationalSchool(lead.schoolName, lead.schoolCountry)) {
    score += weights.internationalSchool;
  }

  // Curriculum
  if (lead.curriculum && Array.isArray(lead.curriculum)) {
    const curricula = lead.curriculum.map((c) => c.toLowerCase());
    if (curricula.some((c) => c.includes("ib") || c.includes("international baccalaureate"))) {
      score += weights.ibCurriculum;
    }
    if (curricula.some((c) => c.includes("igcse") || c.includes("cambridge"))) {
      score += weights.igcseCurriculum;
    }
  }

  // --- Engagement ---
  if (lead.replySentiment === "positive") {
    score += weights.positiveReply;
  } else if (lead.replySentiment === "neutral") {
    score += weights.neutralReply;
  }

  if (lead.emailOpens && lead.emailOpens > 3) {
    score += weights.multipleOpens;
  }

  if (lead.linkClicks && lead.linkClicks > 0) {
    score += weights.linkClicked;
  }

  // --- Context ---
  if (lead.researchSummary) {
    const summary = lead.researchSummary.toLowerCase();
    if (
      summary.includes("expansion") ||
      summary.includes("growing") ||
      summary.includes("new campus") ||
      summary.includes("funding")
    ) {
      score += weights.recentNews;
    }
    if (
      summary.includes("ai") ||
      summary.includes("artificial intelligence") ||
      summary.includes("technology initiative") ||
      summary.includes("digital learning")
    ) {
      score += weights.aiPolicyMentioned;
    }
  }

  // Cap at 10 and round to integer for database storage
  return Math.min(10, Math.round(score));
}

/**
 * Generate human-readable reasons for the score
 */
export function generateScoreReasons(
  lead: LeadData,
  score: number,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): string[] {
  const reasons: string[] = [];

  // Role reasons
  const roleType = normalizeRole(lead.jobTitle);
  switch (roleType) {
    case "principal":
      reasons.push("Key decision maker (Principal/Head level)");
      break;
    case "curriculum":
      reasons.push("Curriculum leader with influence on edtech adoption");
      break;
    case "it":
      reasons.push("Technology director - directly handles tech purchases");
      break;
    case "department":
      reasons.push("Department head - can champion within their area");
      break;
  }

  // School fit reasons
  if (lead.annualFeesUsd && lead.annualFeesUsd > 10000) {
    reasons.push("Premium school with strong budget for edtech");
  } else if (lead.annualFeesUsd && lead.annualFeesUsd >= 5000) {
    reasons.push("Mid-range fees indicate reasonable tech budget");
  }

  if (lead.deviceAccess) {
    const device = lead.deviceAccess.toLowerCase();
    if (device.includes("1:1") || device.includes("one-to-one") || device.includes("byod")) {
      reasons.push("1:1 device program - students ready for digital tools");
    }
  }

  if (isInternationalSchool(lead.schoolName, lead.schoolCountry)) {
    reasons.push("International school - typically tech-forward");
  }

  if (lead.curriculum && Array.isArray(lead.curriculum)) {
    const curricula = lead.curriculum.map((c) => c.toLowerCase());
    if (curricula.some((c) => c.includes("ib"))) {
      reasons.push("IB curriculum aligns well with inquiry-based learning tools");
    }
    if (curricula.some((c) => c.includes("igcse"))) {
      reasons.push("Cambridge/IGCSE curriculum - often open to digital resources");
    }
  }

  // Engagement reasons
  if (lead.replySentiment === "positive") {
    reasons.push("Positive reply sentiment - actively interested");
  } else if (lead.replySentiment === "neutral") {
    reasons.push("Engaged with outreach - replied to email");
  }

  if (lead.emailOpens && lead.emailOpens > 3) {
    reasons.push("Multiple email opens - showing continued interest");
  }

  if (lead.linkClicks && lead.linkClicks > 0) {
    reasons.push("Clicked links in emails - actively exploring");
  }

  // Context reasons
  if (lead.researchSummary) {
    const summary = lead.researchSummary.toLowerCase();
    if (
      summary.includes("expansion") ||
      summary.includes("growing") ||
      summary.includes("new campus")
    ) {
      reasons.push("School is expanding - good timing for new tools");
    }
    if (summary.includes("ai") || summary.includes("technology initiative")) {
      reasons.push("School has AI/tech initiatives - aligned interest");
    }
  }

  // Add score summary
  if (score >= 8) {
    reasons.unshift("High-priority lead");
  } else if (score >= 6) {
    reasons.unshift("Good-fit lead");
  } else if (score >= 4) {
    reasons.unshift("Moderate-fit lead");
  }

  return reasons.slice(0, 5); // Return top 5 reasons
}

/**
 * Get a score label for display
 */
export function getScoreLabel(score: number): {
  label: string;
  color: "red" | "yellow" | "green";
} {
  if (score >= 8) {
    return { label: "Hot", color: "green" };
  } else if (score >= 6) {
    return { label: "Warm", color: "yellow" };
  } else if (score >= 4) {
    return { label: "Cool", color: "yellow" };
  } else {
    return { label: "Cold", color: "red" };
  }
}

/**
 * Fetch scoring weights from database, or return defaults if not set
 */
export async function getScoringWeights(): Promise<ScoringWeights> {
  try {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, SCORING_WEIGHTS_KEY))
      .limit(1);

    if (setting?.value) {
      return JSON.parse(setting.value) as ScoringWeights;
    }
  } catch (error) {
    console.error("[Lead Scorer] Failed to fetch weights from DB:", error);
  }

  return DEFAULT_SCORING_WEIGHTS;
}

/**
 * Calculate lead score with weights from database
 */
export async function calculateLeadScoreWithDBWeights(lead: LeadData): Promise<number> {
  const weights = await getScoringWeights();
  return calculateLeadScore(lead, weights);
}

/**
 * Generate score reasons with weights from database
 */
export async function generateScoreReasonsWithDBWeights(
  lead: LeadData,
  score: number
): Promise<string[]> {
  const weights = await getScoringWeights();
  return generateScoreReasons(lead, score, weights);
}
