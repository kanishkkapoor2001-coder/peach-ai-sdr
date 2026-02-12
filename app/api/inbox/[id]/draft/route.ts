import { NextRequest, NextResponse } from "next/server";
import { db, inboxMessages, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateDraftReply, detectMeetingReadiness } from "@/lib/ai/draft-reply";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [result] = await db
      .select({
        message: inboxMessages,
        lead: leads,
      })
      .from(inboxMessages)
      .innerJoin(leads, eq(inboxMessages.leadId, leads.id))
      .where(eq(inboxMessages.id, id));

    if (!result) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const { message, lead } = result;

    const threadMessages = await db
      .select()
      .from(inboxMessages)
      .where(eq(inboxMessages.leadId, lead.id))
      .orderBy(inboxMessages.receivedAt);

    const previousMessages = threadMessages.map(m => ({
      direction: m.direction as "inbound" | "outbound",
      subject: m.subject,
      body: m.body,
      date: m.receivedAt,
    }));

    const lastOutboundMessage = threadMessages
      .filter(m => m.direction === "outbound")
      .pop();

    const meetingReadiness = await detectMeetingReadiness({
      incomingMessage: message.body,
      previousMessages,
      ourLastMessage: lastOutboundMessage?.body,
    });

    const suggestMeeting = meetingReadiness.readiness === "ready" || meetingReadiness.readiness === "maybe";

    let suggestedMeeting: { date: string; time: string; duration: number; title: string } | undefined;
    let suggestedTimeLabel = "";

    if (meetingReadiness.readiness === "ready") {
      const now = new Date();
      const suggested = new Date(now);
      suggested.setDate(suggested.getDate() + 1);
      while (suggested.getDay() === 0 || suggested.getDay() === 6) {
        suggested.setDate(suggested.getDate() + 1);
      }
      suggested.setHours(14, 0, 0, 0);

      const dateStr = suggested.toISOString().split("T")[0];
      suggestedTimeLabel = suggested.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }) + " at 2:00 PM";

      suggestedMeeting = {
        date: dateStr,
        time: "14:00",
        duration: 30,
        title: `Call with ${lead.firstName} ${lead.lastName}`,
      };
    }

    const draft = await generateDraftReply({
      lead,
      incomingMessage: message.body,
      previousMessages,
      meetingReady: meetingReadiness.readiness === "ready",
      suggestedTime: suggestedTimeLabel || undefined,
    });

    await db
      .update(inboxMessages)
      .set({ aiDraftReply: draft })
      .where(eq(inboxMessages.id, id));

    return NextResponse.json({
      draft,
      meetingReadiness,
      suggestMeeting,
      suggestedMeeting,
    });
  } catch (error) {
    console.error("[Inbox] Error generating draft:", error);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
