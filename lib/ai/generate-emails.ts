import { generateObject } from "ai";
import { z } from "zod";
import { EMAIL_PRINCIPLES } from "@/lib/prompts/email-principles";
import { getAllPrompts } from "@/lib/prompts/get-prompts";
import { getModel, getAIConfigSummary } from "@/lib/ai/provider";
import type { Lead } from "@/lib/db/schema";

// Schema for email sequence generation
const EmailSequenceSchema = z.object({
  email1Subject: z.string().describe("Subject line for introduction email"),
  email1Body: z.string().describe("Body of introduction email, max 125 words"),
  email2Subject: z.string().describe("Subject line for value prop #1 email"),
  email2Body: z.string().describe("Body of value prop #1 email, max 125 words"),
  email3Subject: z.string().describe("Subject line for value prop #2 email"),
  email3Body: z.string().describe("Body of value prop #2 email, max 125 words"),
  email4Subject: z.string().describe("Subject line for value prop #3 email"),
  email4Body: z.string().describe("Body of value prop #3 email, max 125 words"),
  email5Subject: z.string().describe("Subject line for break-up email"),
  email5Body: z.string().describe("Body of break-up email, max 75 words"),
  anglesUsed: z.array(z.string()).describe("List of value proposition angles used"),
});

export type GeneratedEmailSequence = z.infer<typeof EmailSequenceSchema>;

// Research data structure
export interface LeadResearch {
  summary: string;
  personInsights: {
    role?: string;
    achievements?: string[];
    publicStatements?: string[];
    topicsOfInterest?: string[];
  };
  schoolInsights: {
    curriculum?: string[];
    type?: string;
    recentNews?: string[];
    aiStance?: string;
    strategicPriorities?: string[];
  };
  primaryAngle: string;
  secondaryAngle: string;
  tertiaryAngle: string;
}

/**
 * Build system prompt with custom or default prompts
 */
async function buildSystemPrompt(): Promise<string> {
  const { skill, overview, angles } = await getAllPrompts();

  return `You are an expert SDR writing cold emails to school leaders.

## Your References:

${skill}

---

${EMAIL_PRINCIPLES}

---

${angles}

---

${overview}

## Critical Rules:
- Max 125 words per email (break-up under 75)
- 3 short paragraphs max per email
- Use neutral, international English
- Be peer-to-peer, professional
- Frame from their world first
- Include one personalised detail per email from the research provided

## NEVER:
- Use "edtech bro" language (disrupt, 10x, revolutionise, game-changer)
- Use heavy US idioms or "districts"
- Write walls of text
- Include multiple links
- Be pushy or salesy
- Make unsubstantiated claims`;
}

export async function generateEmailSequence(
  lead: Lead,
  research: LeadResearch
): Promise<GeneratedEmailSequence> {
  const systemPrompt = await buildSystemPrompt();

  console.log(`[Email Generation] Using: ${getAIConfigSummary()}`);

  const { object } = await generateObject({
    model: getModel("default"),
    schema: EmailSequenceSchema,
    system: systemPrompt,
    prompt: `Write a 5-email sequence for this prospect:

## Target Information
**Name:** ${lead.firstName} ${lead.lastName}
**Title:** ${lead.jobTitle}
**Email:** ${lead.email}
**School:** ${lead.schoolName}
**Country:** ${lead.schoolCountry || "Unknown"}
**Region:** ${lead.schoolRegion || "Unknown"}

## School Details
- **Curriculum:** ${lead.curriculum?.join(", ") || "Unknown"}
- **Annual Fees:** ${lead.annualFeesUsd ? `$${lead.annualFeesUsd.toLocaleString()}` : "Unknown"}
- **Student Count:** ${lead.studentCount || "Unknown"}
- **Device Access:** ${lead.deviceAccess || "Unknown"}
- **School Type:** ${lead.schoolType || "Unknown"}

## Research Findings
${research.summary}

### Person Insights
${research.personInsights.role ? `- Role: ${research.personInsights.role}` : ""}
${research.personInsights.achievements?.length ? `- Achievements: ${research.personInsights.achievements.join("; ")}` : ""}
${research.personInsights.publicStatements?.length ? `- Public Statements: ${research.personInsights.publicStatements.join("; ")}` : ""}
${research.personInsights.topicsOfInterest?.length ? `- Topics of Interest: ${research.personInsights.topicsOfInterest.join(", ")}` : ""}

### School Insights
${research.schoolInsights.recentNews?.length ? `- Recent News: ${research.schoolInsights.recentNews.join("; ")}` : ""}
${research.schoolInsights.aiStance ? `- AI Stance: ${research.schoolInsights.aiStance}` : ""}
${research.schoolInsights.strategicPriorities?.length ? `- Strategic Priorities: ${research.schoolInsights.strategicPriorities.join(", ")}` : ""}

## Selected Value Proposition Angles
- **Email 2 (Primary):** ${research.primaryAngle}
- **Email 3 (Secondary):** ${research.secondaryAngle}
- **Email 4 (Tertiary):** ${research.tertiaryAngle}

Generate the complete 5-email sequence following the SKILL guidelines exactly.`,
  });

  return object;
}

// Schema for angle selection
const AngleSelectionSchema = z.object({
  primaryAngle: z.string().describe("Best matching angle for Email 2"),
  secondaryAngle: z.string().describe("Second best angle for Email 3"),
  tertiaryAngle: z.string().describe("Third angle for Email 4"),
  reasoning: z.string().describe("Brief explanation of why these angles were chosen"),
});

export async function selectAngles(
  lead: Lead,
  researchSummary: string
): Promise<z.infer<typeof AngleSelectionSchema>> {
  const { angles } = await getAllPrompts();

  const { object } = await generateObject({
    model: getModel("fast"),
    schema: AngleSelectionSchema,
    system: `You are an expert at matching sales angles to prospect research.

${angles}

Select the 3 best angles based on:
1. The person's role and responsibilities
2. Research findings about their interests and priorities
3. School characteristics (curriculum, size, device access)

Prefer HIGH value angles unless research strongly suggests otherwise.`,
    prompt: `Select 3 value proposition angles for:

**Target:** ${lead.firstName} ${lead.lastName}
**Role:** ${lead.jobTitle}
**School:** ${lead.schoolName}
**Curriculum:** ${lead.curriculum?.join(", ") || "Unknown"}
**Device Access:** ${lead.deviceAccess || "Unknown"}

**Research Summary:**
${researchSummary}

Choose the best PRIMARY, SECONDARY, and TERTIARY angles from:
- Hyper-Personalisation (Very High)
- Learning Insights (High)
- Centralised Curriculum (High)
- Authentic Assessment (High)
- Pedagogy (High)
- Teacher Workload (Medium)
- Holistic AI (Medium)
- Engagement (Medium)
- Handwriting Support (Medium)
- Teaching Material (Medium)
- Remediation (Medium)`,
  });

  return object;
}
