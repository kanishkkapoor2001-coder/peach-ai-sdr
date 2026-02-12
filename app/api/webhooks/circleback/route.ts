import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmContacts, crmActivities, leads, meetings } from "@/lib/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import crypto from "crypto";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Circleback webhook payload types
interface CirclebackAttendee {
  name: string;
  email: string;
}

interface CirclebackActionItem {
  id: number;
  title: string;
  description?: string;
  assignee?: { name: string; email: string } | null;
  status: "PENDING" | "DONE";
}

interface CirclebackTranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
}

interface CirclebackInsight {
  insight: string;
  speaker?: string;
  timestamp?: number;
}

interface CirclebackWebhookPayload {
  id: number;
  name: string;
  createdAt: string;
  duration: number;
  url: string;
  recordingUrl?: string;
  tags: string[];
  icalUid?: string;
  attendees: CirclebackAttendee[];
  notes: string;
  actionItems: CirclebackActionItem[];
  transcript: CirclebackTranscriptSegment[];
  insights?: Record<string, CirclebackInsight[]>;
}

// Verify Circleback webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Analyze meeting with AI to determine if it's a client call
async function analyzeMeeting(payload: CirclebackWebhookPayload): Promise<{
  isClientCall: boolean;
  hasActionableNextSteps: boolean;
  hasInterestHinted: boolean;
  hasUnclearNextSteps: boolean;
  shouldSync: boolean;
  summary: string;
  keyInsights: string[];
  nextSteps: string[];
  sentiment: "positive" | "neutral" | "negative" | "unclear";
  clientEmail?: string;
  clientName?: string;
}> {
  const prompt = `Analyze this meeting transcript and notes to determine if it's a client/prospect sales call.

MEETING INFO:
- Title: ${payload.name}
- Duration: ${Math.round(payload.duration / 60)} minutes
- Attendees: ${payload.attendees.map(a => `${a.name} (${a.email})`).join(", ")}
- Tags: ${payload.tags.join(", ") || "None"}

MEETING NOTES:
${payload.notes}

ACTION ITEMS:
${payload.actionItems.map(a => `- [${a.status}] ${a.title}${a.description ? `: ${a.description}` : ""}`).join("\n") || "None"}

TRANSCRIPT EXCERPT (first 3000 chars):
${payload.transcript.slice(0, 50).map(t => `${t.speaker}: ${t.text}`).join("\n").slice(0, 3000)}

Analyze and return a JSON response with:
{
  "isClientCall": boolean, // Is this a sales/client meeting (not internal)?
  "hasActionableNextSteps": boolean, // Are there clear next steps mentioned?
  "hasInterestHinted": boolean, // Did the client show interest in product/service?
  "hasUnclearNextSteps": boolean, // Were next steps discussed but unclear?
  "shouldSync": boolean, // Should this be synced to CRM? (true if client call with any interest/action items)
  "summary": "2-3 sentence summary of the meeting outcome",
  "keyInsights": ["array", "of", "3-5 key insights"],
  "nextSteps": ["array", "of", "specific next steps"],
  "sentiment": "positive" | "neutral" | "negative" | "unclear",
  "clientEmail": "email of the external client/prospect if identifiable",
  "clientName": "name of the main client contact"
}

IMPORTANT: Return ONLY valid JSON, no explanation.`;

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
      maxTokens: 1500,
    } as any);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[Circleback] AI analysis failed:", error);
  }

  // Default response if AI fails
  return {
    isClientCall: false,
    hasActionableNextSteps: payload.actionItems.length > 0,
    hasInterestHinted: false,
    hasUnclearNextSteps: false,
    shouldSync: false,
    summary: payload.notes.slice(0, 200),
    keyInsights: [],
    nextSteps: payload.actionItems.map(a => a.title),
    sentiment: "unclear",
  };
}

/**
 * POST /api/webhooks/circleback
 *
 * Receives meeting data from Circleback webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload: CirclebackWebhookPayload = JSON.parse(rawBody);

    // Verify signature if secret is configured
    const signingSecret = process.env.CIRCLEBACK_WEBHOOK_SECRET;
    if (signingSecret) {
      const signature = request.headers.get("x-signature");
      if (!signature || !verifySignature(rawBody, signature, signingSecret)) {
        console.error("[Circleback] Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    console.log(`[Circleback] Received meeting: ${payload.name} (ID: ${payload.id})`);

    // Analyze meeting with AI
    const analysis = await analyzeMeeting(payload);

    if (!analysis.shouldSync) {
      console.log(`[Circleback] Skipping non-client meeting: ${payload.name}`);
      return NextResponse.json({
        synced: false,
        reason: "Not identified as a client call requiring sync",
        analysis: {
          isClientCall: analysis.isClientCall,
          hasActionableNextSteps: analysis.hasActionableNextSteps,
        },
      });
    }

    // Find matching CRM contact or lead by email
    let crmContact = null;
    let matchedLead = null;

    // Check all attendee emails
    for (const attendee of payload.attendees) {
      // Skip internal emails (customize this pattern)
      if (attendee.email.includes("@peach.study") || attendee.email.includes("@your-company.com")) {
        continue;
      }

      // Try to find in CRM contacts
      const [existingContact] = await db
        .select()
        .from(crmContacts)
        .where(eq(crmContacts.email, attendee.email.toLowerCase()))
        .limit(1);

      if (existingContact) {
        crmContact = existingContact;
        break;
      }

      // Try to find in leads
      const [existingLead] = await db
        .select()
        .from(leads)
        .where(eq(leads.email, attendee.email.toLowerCase()))
        .limit(1);

      if (existingLead) {
        matchedLead = existingLead;
        break;
      }
    }

    // If we found a lead but no CRM contact, create one
    if (matchedLead && !crmContact) {
      const [newContact] = await db
        .insert(crmContacts)
        .values({
          leadId: matchedLead.id,
          firstName: matchedLead.firstName,
          lastName: matchedLead.lastName,
          email: matchedLead.email,
          phone: matchedLead.phone,
          jobTitle: matchedLead.jobTitle,
          companyName: matchedLead.schoolName,
          companyWebsite: matchedLead.schoolWebsite,
          companyCountry: matchedLead.schoolCountry,
          stage: "meeting_scheduled",
          source: "circleback",
          campaignId: matchedLead.campaignId,
        })
        .returning();

      crmContact = newContact;
    }

    // If still no contact and we identified a client, create new contact
    if (!crmContact && analysis.clientEmail) {
      const nameParts = (analysis.clientName || "Unknown Contact").split(" ");
      const [newContact] = await db
        .insert(crmContacts)
        .values({
          firstName: nameParts[0] || "Unknown",
          lastName: nameParts.slice(1).join(" ") || "",
          email: analysis.clientEmail,
          stage: "meeting_scheduled",
          source: "circleback",
        })
        .returning();

      crmContact = newContact;
    }

    if (!crmContact) {
      console.log(`[Circleback] Could not identify client contact for meeting: ${payload.name}`);
      return NextResponse.json({
        synced: false,
        reason: "Could not identify client contact",
      });
    }

    // Update CRM contact with meeting insights
    const existingNotes = crmContact.notes || "";
    const newNotesEntry = `
---
## Meeting: ${payload.name}
**Date:** ${new Date(payload.createdAt).toLocaleDateString()}
**Duration:** ${Math.round(payload.duration / 60)} minutes

### Summary
${analysis.summary}

### Key Insights
${analysis.keyInsights.map(i => `- ${i}`).join("\n")}

### Next Steps
${analysis.nextSteps.map(s => `- ${s}`).join("\n")}

### Sentiment: ${analysis.sentiment}
---
`;

    await db
      .update(crmContacts)
      .set({
        notes: existingNotes + newNotesEntry,
        stage: analysis.sentiment === "positive" ? "qualified" : crmContact.stage,
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, crmContact.id));

    // Create meeting record
    const [meeting] = await db
      .insert(meetings)
      .values({
        leadId: crmContact.leadId || crmContact.id,
        scheduledAt: new Date(payload.createdAt),
        endTime: new Date(new Date(payload.createdAt).getTime() + payload.duration * 1000),
        eventName: payload.name,
        meetingUrl: payload.url,
        status: "completed",
        notes: analysis.summary,
        prepDocument: {
          prospectSummary: analysis.summary,
          talkingPoints: analysis.keyInsights,
          objections: [],
          quickFacts: [
            { label: "Duration", value: `${Math.round(payload.duration / 60)} min` },
            { label: "Sentiment", value: analysis.sentiment },
            { label: "Action Items", value: `${payload.actionItems.length}` },
          ],
        },
      })
      .returning();

    // Log activity
    await db.insert(crmActivities).values({
      contactId: crmContact.id,
      activityType: "meeting_completed",
      subject: `Meeting: ${payload.name}`,
      body: analysis.summary,
      metadata: {
        circlebackId: payload.id,
        duration: payload.duration,
        sentiment: analysis.sentiment,
        actionItems: payload.actionItems.length,
        hasInterest: analysis.hasInterestHinted,
        keyInsights: analysis.keyInsights,
        nextSteps: analysis.nextSteps,
        attendees: payload.attendees,
        recordingUrl: payload.recordingUrl,
        transcript: payload.transcript.slice(0, 20), // Store first 20 segments
      },
    });

    console.log(`[Circleback] Synced meeting to CRM contact: ${crmContact.email}`);

    return NextResponse.json({
      synced: true,
      contactId: crmContact.id,
      meetingId: meeting.id,
      analysis: {
        sentiment: analysis.sentiment,
        hasInterest: analysis.hasInterestHinted,
        actionItems: payload.actionItems.length,
      },
    });
  } catch (error) {
    console.error("[Circleback Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/circleback
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Circleback webhook endpoint is ready",
  });
}
