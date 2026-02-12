import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

import { SKILL_PROMPT } from "./skill";
import { PEACH_OVERVIEW } from "./peach-overview";
import { VALUE_PROPOSITIONS } from "./value-propositions";
import { EMAIL_PRINCIPLES } from "./email-principles";
import type { CompanyContext } from "@/lib/db/schema";

interface CustomPrompts {
  skill?: string;
  overview?: string;
  angles?: string;
}

const PROMPTS_FILE = join(process.cwd(), "data", "custom-prompts.json");

let cachedPrompts: CustomPrompts | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

let cachedCompany: CompanyContext | null = null;
let companyCacheTime = 0;

async function loadCustomPrompts(): Promise<CustomPrompts> {
  if (cachedPrompts && Date.now() - cacheTime < CACHE_TTL) {
    return cachedPrompts;
  }

  try {
    if (!existsSync(PROMPTS_FILE)) {
      cachedPrompts = {};
      cacheTime = Date.now();
      return {};
    }

    const data = await readFile(PROMPTS_FILE, "utf-8");
    cachedPrompts = JSON.parse(data) as CustomPrompts;
    cacheTime = Date.now();
    return cachedPrompts;
  } catch (error) {
    console.error("[Prompts] Error loading custom prompts:", error);
    return {};
  }
}

async function getCompanyContext(): Promise<CompanyContext | null> {
  if (cachedCompany && Date.now() - companyCacheTime < CACHE_TTL) {
    return cachedCompany;
  }

  try {
    const { db, companyContext } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");

    const companies = await db
      .select()
      .from(companyContext)
      .where(eq(companyContext.isActive, true))
      .limit(1);

    cachedCompany = companies[0] || null;
    companyCacheTime = Date.now();
    return cachedCompany;
  } catch (error) {
    console.error("[Prompts] Error loading company context:", error);
    return null;
  }
}

function generateProductOverview(company: CompanyContext): string {
  const valueProps = company.valuePropositions || [];
  const painPoints = company.painPoints || [];
  const differentiators = company.differentiators || [];

  let overview = `# ${company.companyName} Overview\n\n`;

  if (company.companyDescription) {
    overview += `## What We Do\n${company.companyDescription}\n\n`;
  }

  if (valueProps.length > 0) {
    overview += `## Key Value Propositions\n`;
    valueProps.forEach((vp, i) => {
      overview += `### ${i + 1}. ${vp.title}\n`;
      overview += `${vp.description}\n`;
      if (vp.targetAudience) {
        overview += `*Best for: ${vp.targetAudience}*\n`;
      }
      overview += `\n`;
    });
  }

  if (painPoints.length > 0) {
    overview += `## Pain Points We Solve\n`;
    painPoints.forEach((pp) => {
      overview += `- ${pp}\n`;
    });
    overview += `\n`;
  }

  if (differentiators.length > 0) {
    overview += `## What Makes Us Different\n`;
    differentiators.forEach((d) => {
      overview += `- ${d}\n`;
    });
    overview += `\n`;
  }

  if (company.aiInsights?.idealCustomerProfile) {
    overview += `## Ideal Customer\n${company.aiInsights.idealCustomerProfile}\n\n`;
  }

  return overview;
}

function generateValuePropositions(company: CompanyContext): string {
  const valueProps = company.valuePropositions || [];

  if (valueProps.length === 0) {
    return `# Value Proposition Angles

## Generic Best Practice Angles

### 1. Problem Awareness (High Value)
Lead with a specific problem the prospect likely faces based on their role and industry.
Focus on the pain point before presenting any solution.

### 2. ROI/Efficiency (High Value)
Highlight time savings, cost reduction, or productivity improvements.
Use concrete numbers when possible.

### 3. Competitive Advantage (Medium Value)
Show how the solution helps them stay ahead or differentiate.
Reference industry trends or competitor activity.

### 4. Risk Reduction (Medium Value)
Address compliance, security, or operational risks.
Show how the solution mitigates specific concerns.

### 5. Social Proof (Medium Value)
Leverage case studies, testimonials, or industry adoption.
Make it relevant to their specific context.

When selecting angles, prioritize based on:
1. Relevance to the prospect's specific role and challenges
2. Match to their organization's strategic priorities
3. Evidence of interest or pain points from research`;
  }

  let angles = `# Value Proposition Angles for ${company.companyName}\n\n`;

  const highPriority = valueProps.slice(0, Math.ceil(valueProps.length / 2));
  const mediumPriority = valueProps.slice(Math.ceil(valueProps.length / 2));

  angles += `## High Value Angles\n\n`;
  highPriority.forEach((vp, i) => {
    angles += `### ${i + 1}. ${vp.title}\n`;
    angles += `${vp.description}\n`;
    if (vp.targetAudience) {
      angles += `**Best For:** ${vp.targetAudience}\n`;
    }
    angles += `\n`;
  });

  if (mediumPriority.length > 0) {
    angles += `## Medium Value Angles\n\n`;
    mediumPriority.forEach((vp, i) => {
      angles += `### ${highPriority.length + i + 1}. ${vp.title}\n`;
      angles += `${vp.description}\n`;
      if (vp.targetAudience) {
        angles += `**Best For:** ${vp.targetAudience}\n`;
      }
      angles += `\n`;
    });
  }

  angles += `## Angle Selection Guidelines

When selecting angles for a prospect:
1. Match the angle to their role and responsibilities
2. Consider their organization's stated priorities
3. Look for pain points mentioned in research
4. Prefer High Value angles unless research suggests otherwise
5. Ensure variety across the email sequence`;

  return angles;
}

function generateSkillPrompt(company: CompanyContext): string {
  const tone = company.emailTone || "professional";
  const senderName = company.senderName;
  const senderTitle = company.senderTitle;
  const signatureBlock = company.signatureBlock;

  let skill = `# Email Writing Guidelines for ${company.companyName}

## Tone & Style
- Write in a **${tone}** tone
- Be peer-to-peer, not sales-to-prospect
- Frame everything from the recipient's perspective first
- Keep emails concise and scannable

## Email Structure (5-Email Sequence)

### Email 1: Introduction
- Open with a genuine, research-based observation
- Briefly introduce ${company.companyName} and one key benefit
- Ask a low-commitment question
- Max 125 words

### Email 2: Value Proposition #1
- Lead with the prospect's likely challenge
- Present how ${company.companyName} addresses it
- Include one specific proof point
- Max 125 words

### Email 3: Value Proposition #2
- Different angle from Email 2
- New insight or perspective
- Social proof if relevant
- Max 125 words

### Email 4: Value Proposition #3
- Third distinct angle
- Address potential objection implicitly
- Call to action
- Max 125 words

### Email 5: Break-Up
- Short and respectful
- Clear close to the sequence
- Leave door open
- Max 75 words

## Formatting Rules
- Maximum 3 short paragraphs per email
- No walls of text
- One clear call-to-action per email
- Use the prospect's first name naturally`;

  if (senderName || senderTitle) {
    skill += `\n\n## Signature
${senderName ? `- Sender Name: ${senderName}` : ""}
${senderTitle ? `- Title: ${senderTitle}` : ""}`;
  }

  if (signatureBlock) {
    skill += `\n- Full Signature:\n${signatureBlock}`;
  }

  skill += `\n\n## Critical Don'ts
- No "edtech bro" language (disrupt, 10x, revolutionize, game-changer)
- No pushy sales tactics
- No unsubstantiated claims
- No multiple links per email
- No excessive exclamation marks
- No generic compliments that could apply to anyone`;

  return skill;
}

export async function getSkillPrompt(): Promise<string> {
  const custom = await loadCustomPrompts();
  if (custom.skill) return custom.skill;

  const company = await getCompanyContext();
  if (company) {
    return generateSkillPrompt(company);
  }

  return SKILL_PROMPT;
}

export async function getProductOverview(): Promise<string> {
  const custom = await loadCustomPrompts();
  if (custom.overview) return custom.overview;

  const company = await getCompanyContext();
  if (company) {
    return generateProductOverview(company);
  }

  return PEACH_OVERVIEW;
}

export async function getValuePropositions(): Promise<string> {
  const custom = await loadCustomPrompts();
  if (custom.angles) return custom.angles;

  const company = await getCompanyContext();
  if (company) {
    return generateValuePropositions(company);
  }

  return VALUE_PROPOSITIONS;
}

export async function getAllPrompts(): Promise<{
  skill: string;
  overview: string;
  angles: string;
  companyName: string | null;
}> {
  const custom = await loadCustomPrompts();
  const company = await getCompanyContext();

  return {
    skill: custom.skill || (company ? generateSkillPrompt(company) : SKILL_PROMPT),
    overview: custom.overview || (company ? generateProductOverview(company) : PEACH_OVERVIEW),
    angles: custom.angles || (company ? generateValuePropositions(company) : VALUE_PROPOSITIONS),
    companyName: company?.companyName || null,
  };
}

export async function getActiveCompanyContext(): Promise<CompanyContext | null> {
  return getCompanyContext();
}

export function clearPromptsCache(): void {
  cachedPrompts = null;
  cacheTime = 0;
  cachedCompany = null;
  companyCacheTime = 0;
}
