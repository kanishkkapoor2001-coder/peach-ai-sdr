import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { Lead } from "@/lib/db/schema";
import { getProductOverview, getActiveCompanyContext } from "@/lib/prompts/get-prompts";

interface Message {
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  date: Date | null;
}

interface DraftReplyContext {
  lead: Lead;
  incomingMessage: string;
  previousMessages: Message[];
  meetingReady?: boolean;
  suggestedTime?: string;
  calendlyUrl?: string; // If provided, include booking link in reply
}

async function buildDraftReplySystemPrompt(): Promise<string> {
  const company = await getActiveCompanyContext();
  const overview = await getProductOverview();
  const companyName = company?.companyName || "your company";

  return `You are an expert SDR for ${companyName}. Generate a thoughtful, personalized reply to a prospect who has responded to your outreach.

## About ${companyName}
${overview}

## Guidelines for Replies:

1. **Acknowledge their response** - Thank them for taking the time to reply
2. **Address their specific points** - If they asked questions or raised concerns, address them directly
3. **Be helpful, not pushy** - Your goal is to be genuinely useful
4. **Keep it concise** - 2-3 short paragraphs max
5. **Clear next step** - End with a clear, low-pressure call to action

## Tone:
- Professional but warm
- Peer-to-peer, not salesy
- Confident but not arrogant
- International English (avoid heavy US idioms)

## If they're interested:
- Offer a quick call or demo
- Suggest 2-3 specific time slots (e.g., "How about Tuesday at 2pm or Wednesday at 10am GMT?")
- Mention you'll send a calendar invite once they confirm a time

## If they have objections/concerns:
- Acknowledge their concern genuinely
- Provide relevant information without being defensive
- Offer to address it on a call if complex

## If they're not interested:
- Be gracious and respectful
- Leave the door open for future
- Don't push or try to convince

## NEVER:
- Be pushy or desperate
- Make unsubstantiated claims
- Use high-pressure tactics
- Write walls of text
- Use phrases like "just following up" or "touching base"
`;
}

export async function generateDraftReply(context: DraftReplyContext): Promise<string> {
  const { lead, incomingMessage, previousMessages } = context;

  const conversationHistory = previousMessages
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    .map((m) => {
      const sender = m.direction === "outbound" ? "You (SDR)" : `${lead.firstName}`;
      return `**${sender}** (${m.date?.toLocaleDateString() || "Unknown date"}):\nSubject: ${m.subject}\n${m.body}`;
    })
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: getModel(),
    system: await buildDraftReplySystemPrompt(),
    prompt: `Generate a reply to this prospect's message.

## Prospect Information
**Name:** ${lead.firstName} ${lead.lastName}
**Title:** ${lead.jobTitle}
**School:** ${lead.schoolName}
**Country:** ${lead.schoolCountry || "Unknown"}

## Conversation History
${conversationHistory || "No previous messages"}

---

## Their Latest Message
${incomingMessage}

---

Write a thoughtful reply that addresses their message and moves the conversation forward appropriately. Just provide the email body text, no subject line.${
      context.meetingReady || context.calendlyUrl
        ? `\n\nIMPORTANT: The prospect wants to book a meeting.${
            context.calendlyUrl
              ? ` Include this booking link naturally in your response: ${context.calendlyUrl}\nSay something like "You can book a time that works for you here: [link]" or "Here's my calendar if you'd like to find a time: [link]".`
              : ` Suggest ${context.suggestedTime || "a time in the coming days"} for a quick 30-minute call and let them know you're sending a calendar invite along with this email. Keep it confident — don't ask "does this work?", instead say something like "I've attached a calendar invite for ${context.suggestedTime || "our call"} — feel free to suggest another time if that doesn't work."`
          }`
        : ""
    }`,
  });

  return text;
}

export async function detectMeetingReadiness(context: {
  incomingMessage: string;
  previousMessages: Message[];
  ourLastMessage?: string;
}): Promise<{
  readiness: "ready" | "maybe" | "not_ready";
  confidence: number;
  reason: string;
}> {
  const { incomingMessage, previousMessages, ourLastMessage } = context;

  const readyKeywords = [
    "schedule", "call", "demo", "meeting", "available", "calendar",
    "chat", "talk", "discuss", "speak", "time", "slot", "book",
    "sure", "yes", "sounds good", "let's do it", "i'm interested",
    "that works", "count me in"
  ];

  const notReadyKeywords = [
    "not interested", "no thanks", "unsubscribe", "remove me",
    "stop", "don't contact", "busy", "not now", "maybe later",
    "not a priority"
  ];

  const messageLower = incomingMessage.toLowerCase();

  const hasReadyKeyword = readyKeywords.some(k => messageLower.includes(k));
  const hasNotReadyKeyword = notReadyKeywords.some(k => messageLower.includes(k));

  if (hasNotReadyKeyword) {
    return {
      readiness: "not_ready",
      confidence: 0.9,
      reason: "Message contains declining language",
    };
  }

  const ourLastLower = ourLastMessage?.toLowerCase() || "";
  const weAskedForCall = ourLastLower.includes("call") ||
    ourLastLower.includes("meet") ||
    ourLastLower.includes("demo") ||
    ourLastLower.includes("chat");

  const theyAgreed = messageLower.includes("sure") ||
    messageLower.includes("yes") ||
    messageLower.includes("sounds good") ||
    messageLower.includes("let's") ||
    messageLower.includes("that works");

  if (weAskedForCall && theyAgreed) {
    return {
      readiness: "ready",
      confidence: 0.95,
      reason: "They agreed to our meeting request",
    };
  }

  if (hasReadyKeyword) {
    return {
      readiness: "ready",
      confidence: 0.8,
      reason: "Message indicates interest in meeting",
    };
  }

  const positiveKeywords = ["interesting", "sounds", "tell me more", "curious", "like to know"];
  const hasPositiveKeyword = positiveKeywords.some(k => messageLower.includes(k));

  if (hasPositiveKeyword) {
    return {
      readiness: "maybe",
      confidence: 0.6,
      reason: "Showing interest, might be ready for soft meeting suggestion",
    };
  }

  return {
    readiness: "not_ready",
    confidence: 0.5,
    reason: "No clear meeting signals detected",
  };
}
