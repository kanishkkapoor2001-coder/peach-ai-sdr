import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmContacts, crmActivities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * POST /api/crm/contacts/[id]/enrich
 *
 * Use AI to research and enrich a contact's profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get contact
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, id))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Mark as in progress
    await db
      .update(crmContacts)
      .set({ enrichmentStatus: "in_progress" })
      .where(eq(crmContacts.id, id));

    // Build prompt for AI research
    const prompt = `You are a B2B sales research assistant. Research the following contact and their company to provide sales-relevant intelligence.

CONTACT INFORMATION:
- Name: ${contact.firstName} ${contact.lastName}
- Email: ${contact.email}
- Job Title: ${contact.jobTitle || "Unknown"}
- Company: ${contact.companyName || "Unknown"}
- Website: ${contact.companyWebsite || "Unknown"}
- Country: ${contact.companyCountry || "Unknown"}
- LinkedIn: ${contact.linkedinUrl || "Not provided"}

Based on this information, provide a detailed research report in the following JSON format:

{
  "linkedinHeadline": "Professional headline based on their likely role",
  "linkedinAbout": "Brief professional summary of this person's likely background",
  "companySize": "Estimate: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+",
  "companyDescription": "Brief description of what the company does",
  "companyFunding": "If known or can be inferred, funding stage or revenue range",
  "industry": "Primary industry classification",
  "techStack": ["List", "of", "likely", "technologies", "they", "use"],
  "competitors": ["List", "of", "likely", "competitors"],
  "buyingSignals": [
    "Specific signals that suggest they might be in-market",
    "Growth indicators",
    "Technology needs based on their industry"
  ],
  "decisionMakers": [
    {"name": "Likely C-level or VP", "title": "CEO/CTO/VP Sales", "linkedinUrl": null}
  ],
  "recentNews": [
    {"title": "Relevant news or trend", "summary": "Brief summary", "date": "2024-01-15"}
  ],
  "leadScore": 7,
  "scoreReasons": [
    "Reason 1 for the score",
    "Reason 2 for the score",
    "Reason 3 for the score"
  ],
  "personalizationHooks": [
    "Specific things to mention in outreach",
    "Common pain points for their role/industry",
    "Potential mutual connections or interests"
  ]
}

IMPORTANT:
- Be realistic and conservative with estimates
- Focus on actionable sales intelligence
- If you don't have enough information, make educated guesses based on industry norms
- Lead score should be 1-10 based on fit and likelihood to buy
- Return ONLY valid JSON, no explanation text`;

    const { text: aiText } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
      maxTokens: 2000,
    } as any);

    // Extract JSON from the response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const enrichmentData = JSON.parse(jsonMatch[0]);

    // Update contact with enriched data
    const [updatedContact] = await db
      .update(crmContacts)
      .set({
        linkedinHeadline: enrichmentData.linkedinHeadline,
        linkedinAbout: enrichmentData.linkedinAbout,
        companySize: enrichmentData.companySize,
        companyDescription: enrichmentData.companyDescription,
        companyFunding: enrichmentData.companyFunding,
        industry: enrichmentData.industry,
        techStack: enrichmentData.techStack || [],
        competitors: enrichmentData.competitors || [],
        buyingSignals: enrichmentData.buyingSignals || [],
        decisionMakers: enrichmentData.decisionMakers || [],
        recentNews: (enrichmentData.recentNews || []).map((n: any) => ({
          title: n.title,
          summary: n.summary,
          date: n.date,
          url: "",
        })),
        leadScore: enrichmentData.leadScore,
        scoreReasons: enrichmentData.scoreReasons || [],
        scoreUpdatedAt: new Date(),
        enrichedAt: new Date(),
        enrichmentSource: "ai",
        enrichmentStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, id))
      .returning();

    // Log activity
    await db.insert(crmActivities).values({
      contactId: id,
      activityType: "enriched",
      subject: "AI enrichment completed",
      metadata: {
        fieldsUpdated: Object.keys(enrichmentData).length,
        leadScore: enrichmentData.leadScore,
      },
    });

    return NextResponse.json({
      contact: updatedContact,
      enrichment: enrichmentData,
    });
  } catch (error) {
    console.error("[CRM Enrich] Error:", error);

    // Mark as failed
    await db
      .update(crmContacts)
      .set({ enrichmentStatus: "failed" })
      .where(eq(crmContacts.id, id));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
