import { NextRequest, NextResponse } from "next/server";
import { db, companyContext } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";

export const maxDuration = 60; // 60 seconds for website analysis

/**
 * POST /api/company/analyze-website
 *
 * Scrape and analyze a company website to extract value propositions,
 * target markets, and other insights
 */
export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, companyId } = await request.json();

    if (!websiteUrl) {
      return NextResponse.json(
        { error: "Website URL is required" },
        { status: 400 }
      );
    }

    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    console.log(`[Website Analyzer] Analyzing: ${url}`);

    // Fetch website content
    let websiteContent = "";
    try {
      // Try to fetch the main page and key pages
      const pagesToFetch = [
        url,
        `${url}/about`,
        `${url}/about-us`,
        `${url}/product`,
        `${url}/products`,
        `${url}/features`,
        `${url}/solutions`,
        `${url}/pricing`,
      ];

      const fetchPage = async (pageUrl: string): Promise<string> => {
        try {
          const response = await fetch(pageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; PeachSDR/1.0)",
            },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) return "";
          const html = await response.text();
          // Basic HTML to text conversion
          return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .substring(0, 15000); // Limit per page
        } catch {
          return "";
        }
      };

      const results = await Promise.all(pagesToFetch.map(fetchPage));
      websiteContent = results.filter(Boolean).join("\n\n---\n\n").substring(0, 50000);

      if (!websiteContent || websiteContent.length < 100) {
        return NextResponse.json(
          { error: "Could not fetch website content. Please check the URL and try again." },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("[Website Analyzer] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch website. Please check the URL and try again." },
        { status: 400 }
      );
    }

    // Use AI to analyze the website content
    const analysisPrompt = `You are analyzing a company's website to extract key information for sales outreach.

Website content:
${websiteContent}

Analyze this content and extract:

1. **Company Summary** (2-3 sentences describing what the company does)

2. **Value Propositions** (3-5 key value propositions the company offers)
   - For each: title, description, and target audience

3. **Target Markets** (2-4 target market segments)
   - For each: segment name, description, and priority (high/medium/low)

4. **Pain Points Solved** (3-5 pain points the product/service addresses)

5. **Key Differentiators** (3-5 things that make this company unique)

6. **Key Features** (5-8 main features or capabilities)

7. **Ideal Customer Profile** (description of the ideal customer)

Respond in JSON format:
{
  "summary": "...",
  "valuePropositions": [
    { "title": "...", "description": "...", "targetAudience": "..." }
  ],
  "targetMarkets": [
    { "segment": "...", "description": "...", "priority": "high|medium|low" }
  ],
  "painPoints": ["..."],
  "differentiators": ["..."],
  "keyFeatures": ["..."],
  "idealCustomerProfile": "..."
}`;

    const { text } = await generateText({
      model: getModel(),
      prompt: analysisPrompt,
    });

    // Parse the AI response
    let analysis;
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("[Website Analyzer] Parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to analyze website content" },
        { status: 500 }
      );
    }

    // If companyId provided, update the company context
    if (companyId) {
      const valueProps = (analysis.valuePropositions || []).map((vp: { title: string; description: string; targetAudience?: string }) => ({
        ...vp,
        source: "ai_discovered" as const,
      }));

      await db
        .update(companyContext)
        .set({
          companyDescription: analysis.summary,
          valuePropositions: valueProps,
          targetMarkets: analysis.targetMarkets || [],
          painPoints: analysis.painPoints || [],
          differentiators: analysis.differentiators || [],
          websiteScrapedAt: new Date(),
          websiteContent: websiteContent.substring(0, 50000),
          aiInsights: {
            summary: analysis.summary,
            keyFeatures: analysis.keyFeatures || [],
            competitiveAdvantages: analysis.differentiators || [],
            idealCustomerProfile: analysis.idealCustomerProfile || "",
            generatedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(companyContext.id, companyId));

      console.log(`[Website Analyzer] Updated company ${companyId} with insights`);
    }

    return NextResponse.json({
      success: true,
      analysis: {
        summary: analysis.summary,
        valuePropositions: analysis.valuePropositions,
        targetMarkets: analysis.targetMarkets,
        painPoints: analysis.painPoints,
        differentiators: analysis.differentiators,
        keyFeatures: analysis.keyFeatures,
        idealCustomerProfile: analysis.idealCustomerProfile,
      },
    });
  } catch (error) {
    console.error("[Website Analyzer] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
