/**
 * Meeting Readiness Detection
 *
 * Analyzes conversation to detect when a lead is ready to book a meeting.
 * Handles two scenarios:
 * 1. Lead initiates - "I'd like to see a demo", "Can we schedule a call?"
 * 2. Lead confirms our ask - We asked for call, they said "Yes", "Sure", etc.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";

const MeetingReadinessSchema = z.object({
  isReady: z.boolean().describe("Whether the lead appears ready to book a meeting"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  scenario: z.enum(["lead_initiated", "confirmed_our_ask", "not_ready"]).describe("Which scenario detected"),
  signals: z.array(z.string()).describe("Specific phrases or signals that indicate readiness"),
  suggestedAction: z.enum(["send_calendly", "continue_nurture", "clarify_interest"]).describe("What to do next"),
  reasoning: z.string().describe("Brief explanation of the assessment"),
});

export type MeetingReadiness = z.infer<typeof MeetingReadinessSchema>;

interface ConversationMessage {
  direction: "inbound" | "outbound";
  subject?: string;
  body: string;
  date?: Date | string;
}

/**
 * Analyze conversation to detect booking readiness
 */
export async function detectMeetingReadiness(
  conversation: ConversationMessage[]
): Promise<MeetingReadiness> {
  if (conversation.length === 0) {
    return {
      isReady: false,
      confidence: 0,
      scenario: "not_ready",
      signals: [],
      suggestedAction: "continue_nurture",
      reasoning: "No conversation to analyze",
    };
  }

  // Format conversation for analysis
  const conversationText = conversation
    .map((msg, i) => {
      const direction = msg.direction === "outbound" ? "YOU" : "LEAD";
      return `[${direction}]: ${msg.body}`;
    })
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: getModel("default"),
      schema: MeetingReadinessSchema,
      system: `You are an expert at analyzing sales conversations to detect when a prospect is ready to book a meeting.

You should detect TWO scenarios:

## Scenario A - Lead Initiates:
The lead explicitly asks for or suggests a meeting/call/demo. Examples:
- "I'd like to see a demo"
- "Can we schedule a call?"
- "When are you available to chat?"
- "I'm interested in learning more - let's talk"
- "Do you have time this week?"

## Scenario B - Lead Confirms Our Ask:
You (the SDR) previously asked for a meeting, and the lead is now confirming. Examples:
- Your email: "Would you be open to a quick call?"
- Their reply: "Sure", "Yes, that works", "Let's do it", "Sounds good"
- Their reply: "I have time Thursday", "How about next week?"

## NOT Ready Signals:
- Asking questions but no commitment
- "Send me more info first"
- Vague interest without action
- Objections or pushback
- Just saying "thanks" or "interesting"

Be conservative - only mark as ready if there's clear intent to meet.`,
      prompt: `Analyze this conversation for meeting booking readiness:

${conversationText}

Determine:
1. Is the lead ready to book a meeting?
2. Which scenario applies (lead_initiated, confirmed_our_ask, or not_ready)?
3. What specific signals indicate this?
4. What should be the next action?`,
    });

    return object;
  } catch (error) {
    console.error("[Meeting Readiness] Detection error:", error);
    return {
      isReady: false,
      confidence: 0,
      scenario: "not_ready",
      signals: [],
      suggestedAction: "continue_nurture",
      reasoning: "Failed to analyze conversation",
    };
  }
}

/**
 * Quick check for obvious booking signals (for real-time detection)
 */
export function hasObviousBookingSignals(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Direct meeting requests
  const directSignals = [
    "schedule a call",
    "book a meeting",
    "set up a call",
    "let's talk",
    "let's chat",
    "want to meet",
    "see a demo",
    "show me a demo",
    "when are you available",
    "when can we",
    "do you have time",
    "free for a call",
    "hop on a call",
    "get on a call",
  ];

  // Affirmative responses
  const affirmativeSignals = [
    "yes, let's",
    "sure, let's",
    "sounds good, let",
    "that works",
    "i'm available",
    "i can meet",
    "let's do it",
    "count me in",
    "i'd like that",
  ];

  return (
    directSignals.some((signal) => lowerText.includes(signal)) ||
    affirmativeSignals.some((signal) => lowerText.includes(signal))
  );
}
