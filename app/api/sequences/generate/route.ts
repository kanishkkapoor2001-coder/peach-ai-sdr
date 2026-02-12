import { NextRequest, NextResponse } from "next/server";
import { db, leads, emailSequences } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { generateEmailSequence, selectAngles } from "@/lib/ai/generate-emails";
import { researchLead } from "@/lib/ai/research-lead";
import { chunk, sleep } from "@/lib/utils";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { checkUsage, incrementUsage } from "@/lib/services/usage-tracker";

const BATCH_SIZE = 10; // Process 10 leads at a time for quality

// POST /api/sequences/generate - Generate email sequences for selected leads
export async function POST(request: NextRequest) {
  try {
    // Check workspace usage limits
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leadIds } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "No lead IDs provided" },
        { status: 400 }
      );
    }

    // Check if workspace has enough usage quota
    const usageCheck = await checkUsage(workspaceId);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: usageCheck.message || "Usage limit reached",
          usage: {
            current: usageCheck.currentUsage,
            limit: usageCheck.limit,
            accountType: usageCheck.accountType,
          }
        },
        { status: 429 }
      );
    }

    // For sample accounts, limit the number of leads they can process
    const maxLeadsForSample = usageCheck.accountType === "sample"
      ? Math.min(leadIds.length, usageCheck.limit - usageCheck.currentUsage)
      : leadIds.length;

    const leadIdsToProcess = leadIds.slice(0, maxLeadsForSample);

    // Fetch all leads (using the potentially limited list for sample accounts)
    const leadsToProcess = await db
      .select()
      .from(leads)
      .where(inArray(leads.id, leadIdsToProcess));

    if (leadsToProcess.length === 0) {
      return NextResponse.json({ error: "No leads found" }, { status: 404 });
    }

    const results: { leadId: string; success: boolean; error?: string }[] = [];
    const batches = chunk(leadsToProcess, BATCH_SIZE);

    for (const batch of batches) {
      // Process each lead in the batch
      const batchResults = await Promise.all(
        batch.map(async (lead) => {
          try {
            // 1. Research the lead
            const research = await researchLead(lead);

            // 2. Update lead with research
            await db
              .update(leads)
              .set({
                researchSummary: research.summary,
                personInsights: research.personInsights,
                schoolInsights: research.schoolInsights,
                status: "researching",
                updatedAt: new Date(),
              })
              .where(eq(leads.id, lead.id));

            // 3. Generate email sequence
            const emails = await generateEmailSequence(lead, research);

            // 4. Save sequence to database
            await db.insert(emailSequences).values({
              leadId: lead.id,
              primaryAngle: research.primaryAngle,
              secondaryAngle: research.secondaryAngle,
              tertiaryAngle: research.tertiaryAngle,
              email1Subject: emails.email1Subject,
              email1Body: emails.email1Body,
              email2Subject: emails.email2Subject,
              email2Body: emails.email2Body,
              email3Subject: emails.email3Subject,
              email3Body: emails.email3Body,
              email4Subject: emails.email4Subject,
              email4Body: emails.email4Body,
              email5Subject: emails.email5Subject,
              email5Body: emails.email5Body,
              status: "pending_review",
            });

            // 5. Update lead status
            await db
              .update(leads)
              .set({
                status: "emails_generated",
                updatedAt: new Date(),
              })
              .where(eq(leads.id, lead.id));

            // Increment usage count after successful AI processing
            await incrementUsage(workspaceId);

            return { leadId: lead.id, success: true };
          } catch (error) {
            console.error(`Error processing lead ${lead.id}:`, error);
            return {
              leadId: lead.id,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      results.push(...batchResults);

      // Brief pause between batches to avoid rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await sleep(2000);
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Get updated usage info
    const updatedUsage = await checkUsage(workspaceId);

    return NextResponse.json({
      message: `Generated sequences for ${successful} leads (${failed} failed)`,
      results,
      usage: {
        current: updatedUsage.currentUsage,
        limit: updatedUsage.limit,
        accountType: updatedUsage.accountType,
      },
      limitedTo: maxLeadsForSample < leadIds.length
        ? `Limited to ${maxLeadsForSample} leads due to usage limits`
        : undefined,
    });
  } catch (error) {
    console.error("Error generating sequences:", error);
    return NextResponse.json(
      { error: "Failed to generate sequences" },
      { status: 500 }
    );
  }
}
