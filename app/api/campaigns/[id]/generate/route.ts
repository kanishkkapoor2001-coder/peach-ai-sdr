import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, leads, emailSequences, sequenceTemplates, touchpointTemplates, companyContext } from "@/lib/db/schema";
import { eq, and, inArray, sql, asc, desc } from "drizzle-orm";
import { generateEmailSequence, selectAngles, LeadResearch } from "@/lib/ai/generate-emails";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";

// Schema for generating sequence template content
const SequenceTemplateSchema = z.object({
  steps: z.array(z.object({
    stepNumber: z.number(),
    subject: z.string().describe("Email subject line with {{firstName}} placeholder"),
    body: z.string().describe("Email body, max 150 words, with personalization placeholders"),
  })),
});

// POST - Generate emails for campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const { mode, leadIds, regenerate } = body;

    // Mode: "sequence" - generate template content for sequence steps
    if (mode === "sequence") {
      return generateSequenceTemplates(campaignId);
    }

    // Mode: "leads" (default) - generate personalized emails for leads

    // Get campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Update campaign status to generating
    await db
      .update(campaigns)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    // Get leads that need email generation
    let leadsToGenerate;
    if (leadIds && leadIds.length > 0) {
      // Specific leads
      leadsToGenerate = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.campaignId, campaignId),
            inArray(leads.id, leadIds)
          )
        );

      // If regenerating, delete existing sequences for these leads first
      if (regenerate && leadsToGenerate.length > 0) {
        await db
          .delete(emailSequences)
          .where(inArray(emailSequences.leadId, leadIds));
      }
    } else {
      // All leads without sequences
      const leadsWithSequences = await db
        .select({ leadId: emailSequences.leadId })
        .from(emailSequences);

      const leadIdsWithSequences = new Set(leadsWithSequences.map((l) => l.leadId));

      const allCampaignLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.campaignId, campaignId));

      leadsToGenerate = allCampaignLeads.filter(
        (lead) => !leadIdsWithSequences.has(lead.id)
      );
    }

    if (leadsToGenerate.length === 0) {
      await db
        .update(campaigns)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      return NextResponse.json({
        message: "No leads need email generation",
        generated: 0,
      });
    }

    // Generate emails for each lead
    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const lead of leadsToGenerate) {
      try {
        // Build research data from lead (basic research from lead data)
        const researchSummary = lead.researchSummary || `${lead.firstName} ${lead.lastName} is ${lead.jobTitle} at ${lead.schoolName}${lead.schoolCountry ? ` in ${lead.schoolCountry}` : ''}.`;

        // Select angles based on lead data
        const angleSelection = await selectAngles(lead, researchSummary);

        // Build research object for email generation
        const research: LeadResearch = {
          summary: researchSummary,
          personInsights: {
            role: lead.jobTitle,
            achievements: [],
            publicStatements: [],
            topicsOfInterest: [],
          },
          schoolInsights: {
            curriculum: lead.curriculum as string[] || [],
            type: lead.schoolType || undefined,
            recentNews: [],
            aiStance: undefined,
            strategicPriorities: [],
          },
          primaryAngle: angleSelection.primaryAngle,
          secondaryAngle: angleSelection.secondaryAngle,
          tertiaryAngle: angleSelection.tertiaryAngle,
        };

        const sequence = await generateEmailSequence(lead, research);

        // Calculate confidence score based on personalization quality
        const confidenceScore = calculateConfidenceScore(sequence, lead);

        // Insert sequence with confidence score
        await db.insert(emailSequences).values({
          leadId: lead.id,
          primaryAngle: angleSelection.primaryAngle,
          secondaryAngle: angleSelection.secondaryAngle,
          tertiaryAngle: angleSelection.tertiaryAngle,
          email1Subject: sequence.email1Subject,
          email1Body: sequence.email1Body,
          email2Subject: sequence.email2Subject,
          email2Body: sequence.email2Body,
          email3Subject: sequence.email3Subject,
          email3Body: sequence.email3Body,
          email4Subject: sequence.email4Subject,
          email4Body: sequence.email4Body,
          email5Subject: sequence.email5Subject,
          email5Body: sequence.email5Body,
          // Auto-approve if confidence is high enough
          status: confidenceScore >= 8 ? "approved" : "pending_review",
          confidenceScore,
          confidenceReason: getConfidenceReason(confidenceScore),
        });

        // Update lead status
        await db
          .update(leads)
          .set({ status: "emails_generated", updatedAt: new Date() })
          .where(eq(leads.id, lead.id));

        generated++;
      } catch (error) {
        failed++;
        errors.push(`${lead.firstName} ${lead.lastName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Failed to generate for lead ${lead.id}:`, error);
      }
    }

    // Update campaign status
    const newStatus = failed === leadsToGenerate.length ? "draft" : "ready";
    await db
      .update(campaigns)
      .set({
        status: newStatus,
        emailsGenerated: sql`${campaigns.emailsGenerated} + ${generated}`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json({
      message: `Generated ${generated} email sequences${failed > 0 ? `, ${failed} failed` : ""}`,
      generated,
      failed,
      errors: errors.slice(0, 5), // First 5 errors
    });
  } catch (error) {
    console.error("Failed to generate campaign emails:", error);
    return NextResponse.json(
      { error: "Failed to generate emails" },
      { status: 500 }
    );
  }
}

// Calculate confidence score based on email quality
function calculateConfidenceScore(
  sequence: { email1Subject: string; email1Body: string; anglesUsed?: string[] },
  lead: { firstName: string; schoolName: string; researchSummary?: string | null }
): number {
  let score = 5; // Base score

  const subject = sequence.email1Subject;
  const body = sequence.email1Body;
  if (!body) return 3;

  // Check for personalization
  if (body.includes(lead.firstName)) score += 1;
  if (body.includes(lead.schoolName)) score += 1;

  // Check for research-based content
  if (lead.researchSummary && body.length > 200) score += 1;

  // Check for specific angles used
  if (sequence.anglesUsed && sequence.anglesUsed.length > 0) score += 1;

  // Check subject line quality
  if (subject && subject.length > 10 && subject.length < 60) score += 0.5;
  if (subject && !subject.includes("!") && subject.toUpperCase() !== subject) score += 0.5;

  return Math.min(10, Math.round(score));
}

function getConfidenceReason(score: number): string {
  if (score >= 9) return "Highly personalized with specific research";
  if (score >= 8) return "Well personalized, auto-approved";
  if (score >= 6) return "Moderately personalized, review recommended";
  if (score >= 4) return "Basic personalization, needs review";
  return "Low personalization, requires editing";
}

/**
 * Generate AI content for sequence template steps
 */
async function generateSequenceTemplates(campaignId: string) {
  // 1. Get the campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 }
    );
  }

  // 2. Get the sequence template
  const [sequenceTemplate] = await db
    .select()
    .from(sequenceTemplates)
    .where(eq(sequenceTemplates.campaignId, campaignId))
    .limit(1);

  if (!sequenceTemplate) {
    return NextResponse.json(
      { error: "No sequence found for this campaign. Add email steps first." },
      { status: 400 }
    );
  }

  // 3. Get the touchpoint templates (steps)
  const steps = await db
    .select()
    .from(touchpointTemplates)
    .where(eq(touchpointTemplates.sequenceTemplateId, sequenceTemplate.id))
    .orderBy(asc(touchpointTemplates.stepNumber));

  if (steps.length === 0) {
    return NextResponse.json(
      { error: "No sequence steps to generate content for. Add at least one email step." },
      { status: 400 }
    );
  }

  // 4. Get a sample lead for context
  const [sampleLead] = await db
    .select()
    .from(leads)
    .where(eq(leads.campaignId, campaignId))
    .limit(1);

  // 5. Get company context for product info
  const [company] = await db
    .select()
    .from(companyContext)
    .orderBy(desc(companyContext.updatedAt))
    .limit(1);

  // Build product context string
  const productContext = company ? `
## Your Company & Product:
Company: ${company.companyName}
${company.companyWebsite ? `Website: ${company.companyWebsite}` : ""}
${company.companyDescription ? `What you do: ${company.companyDescription}` : ""}
${company.valuePropositions && (company.valuePropositions as Array<{title: string; description: string}>).length > 0
  ? `Key value props:\n${(company.valuePropositions as Array<{title: string; description: string}>).map((vp) => `- ${vp.title}: ${vp.description}`).join("\n")}`
  : ""}
${company.targetMarkets && (company.targetMarkets as Array<{segment: string; description: string}>).length > 0
  ? `Target markets:\n${(company.targetMarkets as Array<{segment: string; description: string}>).map((tm) => `- ${tm.segment}: ${tm.description}`).join("\n")}`
  : ""}
` : `
## Your Company & Product:
Note: No company context configured. Write generic professional B2B outreach about educational technology.
`;

  // 6. Generate content using AI
  try {
    const { object: generated } = await generateObject({
      model: getModel("default"),
      schema: SequenceTemplateSchema,
      system: `You are an expert SDR writing cold email sequences for B2B outreach to school leaders.

Your task is to create email templates for a multi-step outreach sequence.
${productContext}

## Email Sequence Strategy:
- Email 1: Introduction - establish relevance, show you understand their world, briefly mention what you offer
- Email 2: Value proposition - share a specific benefit or insight about your product
- Email 3: Social proof or case study - brief mention of similar schools using your solution
- Email 4: Different angle - approach from a new perspective (time savings, student outcomes, etc.)
- Email 5: Break-up email - polite, gives them an easy out, very short

## Writing Rules:
- Max 150 words per email (break-up email under 80 words)
- 2-3 short paragraphs max
- Use neutral, international English
- Be peer-to-peer, professional, not salesy
- Include personalization placeholders: {{firstName}}, {{schoolName}}, {{jobTitle}}
- Each email should be able to stand alone
- Subject lines should be short (under 50 characters), curiosity-driven
- ALWAYS write complete, ready-to-send emails - NO placeholder text like [your product], [mention XYZ], etc.
- Be specific about the product/service - don't be vague

## NEVER:
- Use buzzwords (disrupt, revolutionize, game-changer, cutting-edge)
- Use heavy US idioms
- Write walls of text
- Include multiple CTAs or links
- Be pushy or aggressive
- Use exclamation marks in subject lines
- Leave ANY placeholder text in brackets like [your product] or [mention solution]`,
      prompt: `Generate ${steps.length} email templates for this campaign:

Campaign: ${campaign.name}
${campaign.description ? `Description: ${campaign.description}` : ""}
${sampleLead ? `
Context from a sample lead:
- Role: ${sampleLead.jobTitle || "School Leader"}
- School Type: ${sampleLead.schoolType || "International School"}
- Country: ${sampleLead.schoolCountry || "Global"}
` : "Target: School leaders at international schools"}

Generate content for these steps:
${steps.map(s => `- Step ${s.stepNumber}: ${s.channel} ${(s.delayDays ?? 0) > 0 ? `(sent ${s.delayDays} days after previous)` : "(sent immediately)"}`).join("\n")}

IMPORTANT: Create complete, ready-to-send email templates. Do not leave any placeholder text in brackets. Every email should be polished and specific about what you're offering.

Use {{firstName}}, {{schoolName}}, and {{jobTitle}} for personalization only.`,
    });

    // 6. Update each step with generated content
    const updatedSteps: Array<{ id: string; stepNumber: number; subject: string; body: string }> = [];

    for (const step of steps) {
      const generatedStep = generated.steps.find(g => g.stepNumber === step.stepNumber);
      if (generatedStep) {
        await db
          .update(touchpointTemplates)
          .set({
            subject: generatedStep.subject,
            body: generatedStep.body,
            updatedAt: new Date(),
          })
          .where(eq(touchpointTemplates.id, step.id));

        updatedSteps.push({
          id: step.id,
          stepNumber: step.stepNumber,
          subject: generatedStep.subject,
          body: generatedStep.body,
        });
      }
    }

    console.log(`[Campaign Generate] Generated sequence templates for ${updatedSteps.length} steps in campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      mode: "sequence",
      generated: updatedSteps.length,
      steps: updatedSteps,
    });

  } catch (error) {
    console.error("[Campaign Generate] AI generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content" },
      { status: 500 }
    );
  }
}
