import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { getActiveCompanyContext } from "@/lib/prompts/get-prompts";
import { db, inboxMessages } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export interface MeetingPrepInput {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;

  schoolName: string;
  schoolWebsite?: string | null;
  schoolCountry?: string | null;
  curriculum?: string[] | null;
  annualFeesUsd?: number | null;
  studentCount?: number | null;
  deviceAccess?: string | null;

  researchSummary?: string | null;
  personInsights?: string | null;
  schoolInsights?: string | null;
  linkedinUrl?: string | null;
  leadScore?: number | null;
  scoreReasons?: string[] | null;
  leadId?: string;
}

export interface MeetingPrep {
  prospectSummary: string;
  personDeepDive: {
    background: string;
    likelyPriorities: string[];
    communicationStyle: string;
    keyInsights: string[];
  };
  talkingPoints: string[];
  discoveryQuestions: string[];
  objections: {
    objection: string;
    response: string;
  }[];
  quickFacts: {
    label: string;
    value: string;
  }[];
  conversationContext?: {
    emailCount: number;
    lastTopics: string[];
    theirConcerns: string[];
    theirInterests: string[];
  };
}

/**
 * Get email conversation history for context
 */
async function getConversationHistory(leadId: string): Promise<string> {
  try {
    const messages = await db
      .select()
      .from(inboxMessages)
      .where(eq(inboxMessages.leadId, leadId))
      .orderBy(desc(inboxMessages.receivedAt))
      .limit(10);

    if (messages.length === 0) return "";

    return messages
      .reverse()
      .map((m) => {
        const sender = m.direction === "outbound" ? "You" : "Prospect";
        const date = m.receivedAt
          ? new Date(m.receivedAt).toLocaleDateString()
          : "Unknown";
        return `[${date}] ${sender}:\n${m.body?.slice(0, 500)}${m.body && m.body.length > 500 ? "..." : ""}`;
      })
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("[MeetingPrep] Error fetching conversation:", error);
    return "";
  }
}

/**
 * Analyze the prospect's communication style from their emails
 */
async function analyzeProspectStyle(leadId: string): Promise<{
  style: string;
  concerns: string[];
  interests: string[];
}> {
  try {
    const messages = await db
      .select()
      .from(inboxMessages)
      .where(eq(inboxMessages.leadId, leadId))
      .orderBy(desc(inboxMessages.receivedAt));

    const inboundMessages = messages.filter((m) => m.direction === "inbound");

    if (inboundMessages.length === 0) {
      return { style: "Unknown", concerns: [], interests: [] };
    }

    const allText = inboundMessages.map((m) => m.body).join(" ").toLowerCase();

    // Analyze style
    let style = "Professional";
    if (allText.includes("hey") || allText.includes("hi ")) {
      style = "Casual/Friendly";
    } else if (allText.includes("dear") || allText.includes("sincerely")) {
      style = "Formal";
    } else if (allText.length < 100 * inboundMessages.length) {
      style = "Brief/Direct";
    }

    // Extract concerns
    const concerns: string[] = [];
    if (allText.includes("budget") || allText.includes("cost") || allText.includes("price")) {
      concerns.push("Budget/Cost sensitivity");
    }
    if (allText.includes("time") || allText.includes("busy") || allText.includes("schedule")) {
      concerns.push("Time constraints");
    }
    if (allText.includes("teacher") || allText.includes("staff") || allText.includes("training")) {
      concerns.push("Staff adoption/training");
    }
    if (allText.includes("data") || allText.includes("privacy") || allText.includes("security")) {
      concerns.push("Data privacy/security");
    }
    if (allText.includes("already") || allText.includes("using") || allText.includes("current")) {
      concerns.push("Existing solution comparison");
    }

    // Extract interests
    const interests: string[] = [];
    if (allText.includes("ai") || allText.includes("artificial intelligence")) {
      interests.push("AI in education");
    }
    if (allText.includes("personalis") || allText.includes("individual")) {
      interests.push("Personalised learning");
    }
    if (allText.includes("assessment") || allText.includes("feedback")) {
      interests.push("Assessment/feedback tools");
    }
    if (allText.includes("engage") || allText.includes("motivat")) {
      interests.push("Student engagement");
    }
    if (allText.includes("efficien") || allText.includes("save time")) {
      interests.push("Efficiency/time-saving");
    }

    return { style, concerns, interests };
  } catch (error) {
    console.error("[MeetingPrep] Error analyzing style:", error);
    return { style: "Unknown", concerns: [], interests: [] };
  }
}

export async function generateMeetingPrep(
  input: MeetingPrepInput
): Promise<MeetingPrep> {
  const company = await getActiveCompanyContext();
  const companyName = company?.companyName || "your company";
  const companyDesc = company?.companyDescription || "your product";

  // Get conversation history if we have a lead ID
  let conversationHistory = "";
  let prospectStyle = { style: "Unknown", concerns: [] as string[], interests: [] as string[] };

  if (input.leadId) {
    conversationHistory = await getConversationHistory(input.leadId);
    prospectStyle = await analyzeProspectStyle(input.leadId);
  }

  // Build comprehensive prompt
  const prompt = `You are preparing a detailed, person-specific meeting prep for a sales discovery call about ${companyName} (${companyDesc}).

## PROSPECT PROFILE

**Personal Details:**
- Name: ${input.firstName} ${input.lastName}
- Role: ${input.jobTitle}
- Email: ${input.email}
- LinkedIn: ${input.linkedinUrl || "Not available"}

**Organization:**
- School: ${input.schoolName}
- Website: ${input.schoolWebsite || "Not available"}
- Country: ${input.schoolCountry || "Unknown"}
- Curriculum: ${input.curriculum?.join(", ") || "Unknown"}
- Annual Fees: ${input.annualFeesUsd ? `$${input.annualFeesUsd}` : "Unknown"}
- Student Count: ${input.studentCount || "Unknown"}
- Device Access: ${input.deviceAccess || "Unknown"}

**Research Notes:**
${input.researchSummary || "None available"}

**Person Insights:**
${input.personInsights || "None available"}

**School Insights:**
${input.schoolInsights || "None available"}

**Lead Score & Reasons:**
${input.leadScore ? `Score: ${input.leadScore}/10` : "Not scored"}
${input.scoreReasons?.length ? input.scoreReasons.map((r) => `• ${r}`).join("\n") : ""}

**Communication Style Analysis:**
- Style: ${prospectStyle.style}
- Known Concerns: ${prospectStyle.concerns.join(", ") || "None identified"}
- Interests: ${prospectStyle.interests.join(", ") || "None identified"}

${conversationHistory ? `## EMAIL CONVERSATION HISTORY\n${conversationHistory}` : ""}

---

## YOUR TASK

Create a HIGHLY SPECIFIC meeting prep that:
1. Uses ONLY information from the profile above - no generic advice
2. References specific details about THIS person and THIS school
3. Prepares discovery questions based on what we DON'T know yet
4. Anticipates objections based on their communication and profile

Return JSON:
{
  "prospectSummary": "2 paragraphs. Para 1: Who they are specifically - their role context at this school, what their day-to-day likely looks like. Para 2: Based on our conversation history, what they're looking for and why they agreed to this call.",

  "personDeepDive": {
    "background": "What we know about their career/background specifically",
    "likelyPriorities": ["List 3-4 SPECIFIC priorities based on their role at THIS school"],
    "communicationStyle": "How they communicate based on their emails - formal/casual, brief/detailed, what they respond to",
    "keyInsights": ["3-4 specific insights about this person that should inform the call"]
  },

  "talkingPoints": [
    "5 SPECIFIC talking points that reference things they've said or aspects of their school. NOT generic points like 'ask about their challenges' - instead 'Follow up on their concern about X mentioned in their Feb 5 email'"
  ],

  "discoveryQuestions": [
    "5 questions to fill gaps in our knowledge about their situation. Reference what we already know to show we've done homework."
  ],

  "objections": [
    {
      "objection": "A specific objection based on their profile/conversation",
      "response": "A tailored response that addresses their specific situation"
    }
  ],

  "quickFacts": [
    {"label": "Key fact", "value": "Specific value from their profile"}
  ],

  "conversationContext": {
    "emailCount": <number of emails exchanged>,
    "lastTopics": ["Topics from recent emails"],
    "theirConcerns": ["Concerns they've raised"],
    "theirInterests": ["What they've expressed interest in"]
  }
}`;

  try {
    const { text } = await generateText({
      model: getModel(),
      prompt,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse meeting prep response");
    }

    const prep = JSON.parse(jsonMatch[0]) as MeetingPrep;

    // Validate required fields
    if (
      !prep.prospectSummary ||
      !prep.personDeepDive ||
      !Array.isArray(prep.talkingPoints) ||
      !Array.isArray(prep.objections)
    ) {
      throw new Error("Invalid meeting prep structure");
    }

    return prep;
  } catch (error) {
    console.error("[MeetingPrep] Generation error:", error);

    // Enhanced fallback with whatever data we have
    return {
      prospectSummary: `${input.firstName} ${input.lastName} is a ${input.jobTitle} at ${input.schoolName}${input.schoolCountry ? ` in ${input.schoolCountry}` : ""}. Based on their role, they likely oversee ${input.jobTitle.toLowerCase().includes("head") || input.jobTitle.toLowerCase().includes("director") ? "strategic decisions around curriculum and technology adoption" : "day-to-day implementation of educational tools and resources"}.

They have expressed interest in learning more about ${companyName}. ${conversationHistory ? "Based on our email exchange, they appear to be actively evaluating solutions." : "This will be our first direct conversation."}`,

      personDeepDive: {
        background: `${input.jobTitle} at ${input.schoolName}. ${input.linkedinUrl ? "LinkedIn profile available for additional context." : "Limited public information available."}`,
        likelyPriorities: [
          `Managing ${input.schoolName}'s educational technology initiatives`,
          "Improving student outcomes and engagement",
          "Supporting teacher effectiveness and reducing workload",
          input.curriculum?.length ? `Maintaining quality in ${input.curriculum[0]} curriculum delivery` : "Ensuring curriculum standards are met",
        ],
        communicationStyle: prospectStyle.style !== "Unknown"
          ? `${prospectStyle.style} communication style based on email analysis`
          : "Communication style to be determined during call",
        keyInsights: [
          input.schoolName ? `Works at ${input.schoolName}` : "School context needed",
          input.deviceAccess ? `School has ${input.deviceAccess} device access` : "Device access unknown",
          prospectStyle.concerns.length > 0 ? `Has shown concern about: ${prospectStyle.concerns[0]}` : "Concerns to be discovered",
          prospectStyle.interests.length > 0 ? `Interested in: ${prospectStyle.interests[0]}` : "Interests to be explored",
        ],
      },

      talkingPoints: [
        conversationHistory ? "Reference their initial inquiry and what prompted them to reach out" : `Open by acknowledging their role at ${input.schoolName}`,
        prospectStyle.interests.length > 0 ? `Explore their interest in ${prospectStyle.interests[0]}` : "Discover their top priorities this term",
        input.curriculum?.length ? `Discuss how ${companyName} supports ${input.curriculum[0]} curriculum` : "Understand their curriculum requirements",
        prospectStyle.concerns.length > 0 ? `Address their concern about ${prospectStyle.concerns[0]}` : "Identify potential blockers early",
        "Understand their decision-making process and timeline",
      ],

      discoveryQuestions: [
        `What prompted you to explore ${companyName} at this time?`,
        `How is ${input.schoolName} currently approaching [relevant area]?`,
        "Who else would be involved in evaluating a solution like this?",
        "What would success look like for you in the first 6 months?",
        "What have you tried before, and what worked or didn't work?",
      ],

      objections: [
        {
          objection: prospectStyle.concerns.includes("Budget/Cost sensitivity")
            ? "We need to understand the cost before committing"
            : "We don't have budget allocated for this",
          response: prospectStyle.concerns.includes("Budget/Cost sensitivity")
            ? "Absolutely - I'll walk you through our pricing. Many schools like yours start with a pilot to demonstrate ROI before full rollout."
            : "I understand budget cycles can be tight. Would it help to see a pilot approach that demonstrates value before a larger investment?",
        },
        {
          objection: prospectStyle.concerns.includes("Staff adoption/training")
            ? "Our teachers are already stretched thin with training"
            : "I'm not sure our staff would adopt this",
          response: "That's a valid concern. Our implementation includes dedicated support and we've designed the onboarding to take minimal teacher time. Would it help to speak with a teacher from a similar school?",
        },
        {
          objection: "We need to compare with other solutions",
          response: "That makes sense - you want to make the right choice. What criteria are most important to you? I can help clarify how we compare on the things that matter most.",
        },
      ],

      quickFacts: [
        { label: "Name", value: `${input.firstName} ${input.lastName}` },
        { label: "Role", value: input.jobTitle },
        { label: "School", value: input.schoolName },
        { label: "Country", value: input.schoolCountry || "Unknown" },
        { label: "Communication", value: prospectStyle.style },
        ...(prospectStyle.concerns.length > 0 ? [{ label: "Key Concern", value: prospectStyle.concerns[0] }] : []),
      ],

      conversationContext: conversationHistory ? {
        emailCount: conversationHistory.split("---").length,
        lastTopics: prospectStyle.interests.slice(0, 2),
        theirConcerns: prospectStyle.concerns,
        theirInterests: prospectStyle.interests,
      } : undefined,
    };
  }
}

export function formatMeetingPrepAsMarkdown(prep: MeetingPrep): string {
  let md = "# Meeting Preparation\n\n";

  md += "## Prospect Overview\n\n";
  md += prep.prospectSummary + "\n\n";

  if (prep.personDeepDive) {
    md += "## Deep Dive: About This Person\n\n";
    md += `**Background:** ${prep.personDeepDive.background}\n\n`;
    md += `**Communication Style:** ${prep.personDeepDive.communicationStyle}\n\n`;
    md += "**Likely Priorities:**\n";
    prep.personDeepDive.likelyPriorities.forEach((p) => {
      md += `- ${p}\n`;
    });
    md += "\n**Key Insights:**\n";
    prep.personDeepDive.keyInsights.forEach((i) => {
      md += `- ${i}\n`;
    });
    md += "\n";
  }

  if (prep.conversationContext) {
    md += "## Conversation Context\n\n";
    md += `- **Emails Exchanged:** ${prep.conversationContext.emailCount}\n`;
    if (prep.conversationContext.theirConcerns.length > 0) {
      md += `- **Their Concerns:** ${prep.conversationContext.theirConcerns.join(", ")}\n`;
    }
    if (prep.conversationContext.theirInterests.length > 0) {
      md += `- **Their Interests:** ${prep.conversationContext.theirInterests.join(", ")}\n`;
    }
    md += "\n";
  }

  md += "## Talking Points\n\n";
  prep.talkingPoints.forEach((point, i) => {
    md += `${i + 1}. ${point}\n`;
  });
  md += "\n";

  if (prep.discoveryQuestions) {
    md += "## Discovery Questions\n\n";
    prep.discoveryQuestions.forEach((q, i) => {
      md += `${i + 1}. ${q}\n`;
    });
    md += "\n";
  }

  md += "## Potential Objections & Responses\n\n";
  prep.objections.forEach((obj, i) => {
    md += `**${i + 1}. "${obj.objection}"**\n`;
    md += `> ${obj.response}\n\n`;
  });

  md += "## Quick Reference\n\n";
  md += "| | |\n|---|---|\n";
  prep.quickFacts.forEach((fact) => {
    md += `| ${fact.label} | ${fact.value} |\n`;
  });

  return md;
}
