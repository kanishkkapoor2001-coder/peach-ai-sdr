/**
 * Gemini Chat Service
 *
 * Handles chat conversations using Google's Gemini API
 * with RAG (Retrieval Augmented Generation) using the codebase index.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getCodebaseIndex,
  searchCodebase,
  getCodebaseSummary,
  CodeChunk,
} from "./codebase-index";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""
);

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: string;
  sources?: string[];
  error?: string;
}

// System prompt for the chatbot
const SYSTEM_PROMPT = `You are a helpful assistant for the Peach AI SDR application.

CRITICAL RULES - FOLLOW THESE EXACTLY:
1. NEVER make up features, endpoints, or workflows that don't exist
2. If you're not 100% sure about something, say "I'm not sure" - DO NOT GUESS
3. Keep answers SHORT and SIMPLE - 2-3 sentences max unless more detail is needed
4. Better to say nothing than give wrong information
5. Only reference code/files you can actually see in the context provided

HOW THE APP ACTUALLY WORKS:

The Workflow (in order):
1. CREATE A CAMPAIGN first (Campaigns page) - set name, target audience
2. ADD LEADS to that campaign - import CSV or use AI search on Leads page
3. GENERATE EMAILS - AI creates personalized 5-email sequences for leads in the campaign
4. SEND EMAILS - emails go out via configured domains
5. HANDLE REPLIES - inbox shows responses, AI helps draft replies
6. CRM SYNC - leads who reply get synced to Notion automatically

Key Pages:
- /leads - Import and manage leads (must be part of a campaign)
- /campaigns - Create and manage email campaigns
- /sequences - View generated email sequences
- /inbox - See and respond to email replies
- /crm - Notion integration settings
- /meetings - Track booked meetings

IMPORTANT: All leads must be in a campaign. You cannot email individual leads outside of a campaign.

When answering:
- Be direct and helpful
- If asked about something not in the codebase context, say you don't have that information
- Never invent API endpoints or features`;

/**
 * Build context from relevant code chunks
 */
function buildContext(chunks: CodeChunk[], maxLength: number = 15000): string {
  let context = "";

  for (const chunk of chunks) {
    const chunkText = `
--- ${chunk.filePath} ---
${chunk.description ? `// ${chunk.description}\n` : ""}
${chunk.content.slice(0, 3000)}
${chunk.content.length > 3000 ? "\n// ... (truncated)" : ""}
`;

    if (context.length + chunkText.length > maxLength) {
      break;
    }

    context += chunkText;
  }

  return context;
}

/**
 * Chat with the AI assistant
 */
export async function chat(
  messages: ChatMessage[],
  includeCodeContext: boolean = true
): Promise<ChatResponse> {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return {
        message: "I'm sorry, but the AI service is not configured. Please add your Gemini API key to continue.",
        error: "GOOGLE_GENERATIVE_AI_API_KEY not configured",
      };
    }

    // Use gemini-2.0-flash which is fast and capable
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Get the latest user message for context search
    const lastUserMessage = messages
      .filter((m) => m.role === "user")
      .pop()?.content || "";

    // Search codebase for relevant context
    let codeContext = "";
    let sources: string[] = [];

    if (includeCodeContext && lastUserMessage) {
      const index = getCodebaseIndex();
      const relevantChunks = searchCodebase(index, lastUserMessage, 8);

      if (relevantChunks.length > 0) {
        codeContext = buildContext(relevantChunks);
        sources = relevantChunks.map((c) => c.filePath);
      }
    }

    // Build the prompt
    const codebaseSummary = getCodebaseSummary(getCodebaseIndex());

    let fullPrompt = SYSTEM_PROMPT;

    if (codeContext) {
      fullPrompt += `

CODEBASE SUMMARY:
${codebaseSummary}

RELEVANT CODE CONTEXT:
${codeContext}
`;
    }

    // Format conversation history
    const conversationHistory = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Create chat session
    const chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
        {
          role: "model",
          parts: [
            {
              text: "I understand. I'm the Peach AI SDR assistant, ready to help with questions about the application, its features, code, and workflows. How can I help you today?",
            },
          ],
        },
        ...conversationHistory.slice(0, -1), // Add history except the last message
      ],
    });

    // Send the latest message
    const result = await chatSession.sendMessage(lastUserMessage);
    const response = result.response.text();

    return {
      message: response,
      sources: sources.length > 0 ? sources : undefined,
    };
  } catch (error) {
    console.error("[Gemini Chat] Error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return {
          message: "There's an issue with the API configuration. Please check that the Gemini API key is valid.",
          error: error.message,
        };
      }
      if (error.message.includes("quota") || error.message.includes("rate")) {
        return {
          message: "The AI service is currently busy. Please try again in a moment.",
          error: error.message,
        };
      }
    }

    return {
      message: "I encountered an error while processing your request. Please try again.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get suggested questions based on the codebase
 */
export function getSuggestedQuestions(): string[] {
  return [
    "How do I start a new campaign?",
    "How do I add leads to a campaign?",
    "What's the workflow for sending emails?",
    "How does Notion sync work?",
  ];
}
