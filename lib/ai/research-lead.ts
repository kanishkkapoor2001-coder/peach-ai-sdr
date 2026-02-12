import { generateText } from "ai";
import type { Lead } from "@/lib/db/schema";
import type { LeadResearch } from "./generate-emails";
import { getModel, getAIConfigSummary } from "@/lib/ai/provider";

// This would integrate with Exa.ai for real web search
// For now, using Claude to synthesize research based on available data

export async function researchLead(lead: Lead): Promise<LeadResearch> {
  console.log(`[Lead Research] Using: ${getAIConfigSummary()}`);

  const { text } = await generateText({
    model: getModel("default"),
    system: `You are a research assistant helping to gather information about school leaders for sales outreach.

Given the information provided about a prospect, synthesize what we know and make reasonable inferences about:
1. Their likely priorities based on their role
2. What challenges they might face
3. What value propositions would resonate with them

Be factual about what's known and clearly mark inferences.`,
    prompt: `Research this prospect:

**Name:** ${lead.firstName} ${lead.lastName}
**Title:** ${lead.jobTitle}
**School:** ${lead.schoolName}
**Country:** ${lead.schoolCountry || "Unknown"}
**Region:** ${lead.schoolRegion || "Unknown"}
**School Website:** ${lead.schoolWebsite || "Unknown"}

**Known School Details:**
- Curriculum: ${lead.curriculum?.join(", ") || "Unknown"}
- Annual Fees: ${lead.annualFeesUsd ? `$${lead.annualFeesUsd}` : "Unknown"}
- Student Count: ${lead.studentCount || "Unknown"}
- Device Access: ${lead.deviceAccess || "Unknown"}
- School Type: ${lead.schoolType || "Unknown"}

**Existing Research Notes:**
${lead.researchSummary || "None"}

**Recent News:**
${lead.recentNews?.join("\n") || "None"}

**AI Policy:**
${lead.aiPolicy || "Unknown"}

Provide a comprehensive research summary including:
1. Summary of who this person is and their likely priorities
2. Insights about the person (role focus, likely interests)
3. Insights about the school (context, challenges, opportunities)
4. Recommended value proposition angles based on their profile`,
  });

  // Parse the research text into structured format
  // In production, this would use structured output
  const research: LeadResearch = {
    summary: text,
    personInsights: {
      role: lead.jobTitle,
      achievements: [],
      publicStatements: [],
      topicsOfInterest: inferTopicsFromRole(lead.jobTitle),
    },
    schoolInsights: {
      curriculum: lead.curriculum || [],
      type: lead.schoolType || undefined,
      recentNews: lead.recentNews || [],
      aiStance: lead.aiPolicy || undefined,
      strategicPriorities: lead.strategicPriorities || [],
    },
    primaryAngle: selectPrimaryAngle(lead),
    secondaryAngle: selectSecondaryAngle(lead),
    tertiaryAngle: selectTertiaryAngle(lead),
  };

  return research;
}

function inferTopicsFromRole(jobTitle: string): string[] {
  const titleLower = jobTitle.toLowerCase();
  const topics: string[] = [];

  if (titleLower.includes("principal") || titleLower.includes("head")) {
    topics.push("school strategy", "student outcomes", "teacher retention");
  }
  if (titleLower.includes("curriculum")) {
    topics.push("curriculum alignment", "pedagogy", "assessment");
  }
  if (titleLower.includes("technology") || titleLower.includes("digital")) {
    topics.push("edtech", "digital transformation", "AI in education");
  }
  if (titleLower.includes("teacher")) {
    topics.push("classroom efficiency", "student engagement", "workload");
  }

  return topics;
}

function selectPrimaryAngle(lead: Lead): string {
  const titleLower = lead.jobTitle.toLowerCase();

  // High-value roles get personalisation angle
  if (
    titleLower.includes("principal") ||
    titleLower.includes("head") ||
    titleLower.includes("curriculum")
  ) {
    return "Hyper-Personalisation";
  }

  // CEOs/Trustees get insights angle
  if (titleLower.includes("ceo") || titleLower.includes("trustee")) {
    return "Learning Insights";
  }

  // Default to authentic assessment
  return "Authentic Assessment";
}

function selectSecondaryAngle(lead: Lead): string {
  const titleLower = lead.jobTitle.toLowerCase();

  if (titleLower.includes("curriculum")) {
    return "Centralised Curriculum";
  }

  if (lead.deviceAccess === "low" || lead.deviceAccess === "shared") {
    return "Handwriting Support";
  }

  return "Teacher Workload";
}

function selectTertiaryAngle(lead: Lead): string {
  const titleLower = lead.jobTitle.toLowerCase();

  if (titleLower.includes("teacher")) {
    return "Teaching Material";
  }

  if (lead.curriculum?.includes("IB")) {
    return "IB Coursework";
  }

  return "Pedagogy";
}

// Exa.ai integration (to be implemented)
export async function searchWithExa(query: string): Promise<any[]> {
  const EXA_API_KEY = process.env.EXA_API_KEY;

  if (!EXA_API_KEY) {
    console.warn("EXA_API_KEY not set, skipping Exa.ai search");
    return [];
  }

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EXA_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        type: "neural",
        useAutoprompt: true,
        numResults: 10,
        contents: {
          text: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Exa.ai error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Exa.ai search failed:", error);
    return [];
  }
}

// Hunter.io email verification (to be implemented)
export async function verifyEmail(email: string): Promise<boolean> {
  const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

  if (!HUNTER_API_KEY) {
    console.warn("HUNTER_API_KEY not set, skipping email verification");
    return true; // Assume valid if we can't verify
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(
        email
      )}&api_key=${HUNTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Hunter.io error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.status === "valid" || data.data?.status === "accept_all";
  } catch (error) {
    console.error("Email verification failed:", error);
    return true; // Assume valid on error
  }
}
