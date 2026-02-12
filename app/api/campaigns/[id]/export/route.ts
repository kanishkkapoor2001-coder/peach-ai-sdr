import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, emailSequences, leadTouchpoints, campaigns } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * GET /api/campaigns/[id]/export
 *
 * Export campaign data at various stages:
 * - leads: Just the lead data
 * - leads_with_emails: Leads + generated email sequences
 * - full: Everything including send status
 *
 * Query params:
 * - type: "leads" | "leads_with_emails" | "full" (default: "full")
 * - format: "json" | "csv" (default: "csv")
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const exportType = searchParams.get("type") || "full";
  const format = searchParams.get("format") || "csv";

  try {
    // Verify campaign exists
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch leads for this campaign
    const campaignLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.campaignId, campaignId));

    if (campaignLeads.length === 0) {
      return NextResponse.json({ error: "No leads in this campaign" }, { status: 400 });
    }

    // Prepare export data based on type
    let exportData: any[] = [];

    if (exportType === "leads") {
      // Just lead data
      exportData = campaignLeads.map((lead) => ({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        jobTitle: lead.jobTitle,
        phone: lead.phone,
        schoolName: lead.schoolName,
        schoolWebsite: lead.schoolWebsite,
        schoolCountry: lead.schoolCountry,
        schoolRegion: lead.schoolRegion,
        curriculum: Array.isArray(lead.curriculum) ? lead.curriculum.join(", ") : lead.curriculum,
        annualFees: lead.annualFeesUsd,
        studentCount: lead.studentCount,
        deviceAccess: lead.deviceAccess,
        leadScore: lead.leadScore,
        status: lead.status,
        emailVerified: lead.emailVerified,
        createdAt: lead.createdAt,
      }));
    } else if (exportType === "leads_with_emails" || exportType === "full") {
      // Get sequences for these leads
      const leadIds = campaignLeads.map((l) => l.id);

      const leadSequencesList = await db
        .select()
        .from(emailSequences)
        .where(inArray(emailSequences.leadId, leadIds));

      // Get all touchpoints for these leads directly (using leadId)
      let allTouchpoints: any[] = [];

      if (leadIds.length > 0) {
        allTouchpoints = await db
          .select()
          .from(leadTouchpoints)
          .where(inArray(leadTouchpoints.leadId, leadIds));
      }

      // Create a map of touchpoints by lead ID
      const touchpointsByLead: Record<string, any[]> = {};
      for (const tp of allTouchpoints) {
        if (tp.leadId && !touchpointsByLead[tp.leadId]) {
          touchpointsByLead[tp.leadId] = [];
        }
        if (tp.leadId) {
          touchpointsByLead[tp.leadId].push(tp);
        }
      }

      // Create a map of sequences by lead ID
      const sequenceByLead: Record<string, any> = {};
      for (const seq of leadSequencesList) {
        sequenceByLead[seq.leadId] = {
          ...seq,
          touchpoints: touchpointsByLead[seq.leadId] || [],
        };
      }

      // Build export data
      exportData = campaignLeads.map((lead) => {
        const sequence = sequenceByLead[lead.id];
        const baseData: any = {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          jobTitle: lead.jobTitle,
          phone: lead.phone,
          schoolName: lead.schoolName,
          schoolWebsite: lead.schoolWebsite,
          schoolCountry: lead.schoolCountry,
          schoolRegion: lead.schoolRegion,
          curriculum: Array.isArray(lead.curriculum) ? lead.curriculum.join(", ") : lead.curriculum,
          annualFees: lead.annualFeesUsd,
          studentCount: lead.studentCount,
          deviceAccess: lead.deviceAccess,
          leadScore: lead.leadScore,
          leadStatus: lead.status,
          emailVerified: lead.emailVerified,
          leadCreatedAt: lead.createdAt,
        };

        if (sequence) {
          baseData.sequenceStatus = sequence.status;
          baseData.sequenceCreatedAt = sequence.createdAt;

          // Add email content for each touchpoint (up to 5 emails)
          const sortedTouchpoints = (sequence.touchpoints || []).sort(
            (a: any, b: any) => (a.stepNumber || 0) - (b.stepNumber || 0)
          );

          for (let i = 0; i < Math.min(sortedTouchpoints.length, 5); i++) {
            const tp = sortedTouchpoints[i];
            baseData[`email${i + 1}_subject`] = tp.subject || "";
            baseData[`email${i + 1}_body`] = tp.body || "";

            if (exportType === "full") {
              baseData[`email${i + 1}_status`] = tp.status || "draft";
              baseData[`email${i + 1}_sentAt`] = tp.sentAt || "";
              baseData[`email${i + 1}_openedAt`] = tp.openedAt || "";
              baseData[`email${i + 1}_clickedAt`] = tp.clickedAt || "";
            }
          }
        } else {
          baseData.sequenceStatus = "not_generated";
        }

        return baseData;
      });
    }

    // Return based on format
    if (format === "json") {
      return NextResponse.json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          totalLeads: campaignLeads.length,
          exportedAt: new Date().toISOString(),
          exportType,
        },
        data: exportData,
      });
    }

    // Convert to CSV
    if (exportData.length === 0) {
      return NextResponse.json({ error: "No data to export" }, { status: 400 });
    }

    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(","),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            const stringValue = String(value);
            // Escape quotes and wrap in quotes if contains comma, newline, or quote
            if (
              stringValue.includes(",") ||
              stringValue.includes("\n") ||
              stringValue.includes('"')
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      ),
    ];

    const csv = csvRows.join("\n");
    const filename = `${campaign.name.replace(/[^a-z0-9]/gi, "_")}_${exportType}_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
