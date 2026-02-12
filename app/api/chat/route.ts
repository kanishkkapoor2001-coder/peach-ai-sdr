import { NextRequest, NextResponse } from "next/server";
import { chat, getSuggestedQuestions, ChatMessage } from "@/lib/chatbot/gemini-chat";

/**
 * POST /api/chat
 * Send a message to the AI chatbot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Validate message format
    const validRoles = ["user", "assistant", "system"];
    for (const msg of messages) {
      if (!validRoles.includes(msg.role) || typeof msg.content !== "string") {
        return NextResponse.json(
          { error: "Invalid message format" },
          { status: 400 }
        );
      }
    }

    const response = await chat(messages);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 * Get suggested questions and chatbot status
 */
export async function GET() {
  try {
    const suggestions = getSuggestedQuestions();
    const apiKeyConfigured = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    return NextResponse.json({
      status: apiKeyConfigured ? "ready" : "not_configured",
      suggestions,
      apiKeyConfigured,
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
