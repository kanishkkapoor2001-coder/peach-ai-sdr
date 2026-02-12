import { NextRequest, NextResponse } from "next/server";
import { db, leads, emailHistory, type NewLead } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, sql, inArray, and, or } from "drizzle-orm";
import {
  parseCSVContent,
  autoDetectMappings,
  transformToLeads,
  validateLeads,
  deduplicateLeads,
} from "@/lib/utils/csv-parser";

interface DuplicateInfo {
  email: string;
  firstName: string;
  lastName: string;
  existingCampaignId: string | null;
  existingCampaignName: string | null;
  isInSameCampaign: boolean;
}

/**
 * Check for duplicate leads across campaigns
 */
async function checkForDuplicates(
  emailsToCheck: string[],
  targetCampaignId: string | null
): Promise<{
  duplicates: DuplicateInfo[];
  duplicatesInSameCampaign: DuplicateInfo[];
  duplicatesInOtherCampaigns: DuplicateInfo[];
}> {
  if (emailsToCheck.length === 0) {
    return { duplicates: [], duplicatesInSameCampaign: [], duplicatesInOtherCampaigns: [] };
  }

  // Normalize emails to lowercase
  const normalizedEmails = emailsToCheck.map(e => e.toLowerCase());

  // Find existing leads with these emails
  // Use inArray which properly handles array parameters in Drizzle
  const existingLeads = await db
    .select({
      email: leads.email,
      firstName: leads.firstName,
      lastName: leads.lastName,
      campaignId: leads.campaignId,
    })
    .from(leads)
    .where(inArray(sql`LOWER(${leads.email})`, normalizedEmails));

  if (existingLeads.length === 0) {
    return { duplicates: [], duplicatesInSameCampaign: [], duplicatesInOtherCampaigns: [] };
  }

  // Get campaign names for the duplicates
  const campaignIds = [...new Set(existingLeads.filter(l => l.campaignId).map(l => l.campaignId!))];
  let campaignNamesMap: Map<string, string> = new Map();

  if (campaignIds.length > 0) {
    const campaignData = await db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(inArray(campaigns.id, campaignIds));

    campaignNamesMap = new Map(campaignData.map(c => [c.id, c.name]));
  }

  // Build duplicate info
  const duplicates: DuplicateInfo[] = existingLeads.map(lead => ({
    email: lead.email,
    firstName: lead.firstName,
    lastName: lead.lastName,
    existingCampaignId: lead.campaignId,
    existingCampaignName: lead.campaignId ? campaignNamesMap.get(lead.campaignId) || null : null,
    isInSameCampaign: targetCampaignId !== null && lead.campaignId === targetCampaignId,
  }));

  return {
    duplicates,
    duplicatesInSameCampaign: duplicates.filter(d => d.isInSameCampaign),
    duplicatesInOtherCampaigns: duplicates.filter(d => !d.isInSameCampaign && d.existingCampaignId),
  };
}

/**
 * POST /api/leads/import
 *
 * Import leads from CSV/Excel file or from search results
 *
 * For CSV upload, send FormData with:
 * - file: File (CSV, XLSX, XLS)
 * - mappings?: JSON string of column mappings
 *
 * For search results import, send JSON:
 * - leads: Array of lead objects
 * - source: "search" | "csv"
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let leadsToImport: Array<Record<string, unknown>> = [];
    let source = "manual";
    let campaignId: string | null = null;
    let campaignName: string | null = null;
    let autoCreateCampaign = false;
    let searchQuery: string | null = null;

    // Handle JSON body (from search results)
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (!body.leads || !Array.isArray(body.leads)) {
        return NextResponse.json(
          { error: "No leads provided" },
          { status: 400 }
        );
      }

      leadsToImport = body.leads;
      source = body.source || "search";
      campaignId = body.campaignId || null;
      campaignName = body.campaignName || null;
      autoCreateCampaign = body.autoCreateCampaign || false;
      searchQuery = body.searchQuery || null;

    // Handle FormData (file upload)
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const mappingsStr = formData.get("mappings") as string | null;
      const campaignIdFromForm = formData.get("campaignId") as string | null;

      // Set campaignId from FormData if provided
      if (campaignIdFromForm) {
        campaignId = campaignIdFromForm;
      }

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // Read file content
      const filename = file.name;
      let content: string | ArrayBuffer;

      if (filename.endsWith(".csv")) {
        content = await file.text();
      } else {
        content = await file.arrayBuffer();
      }

      // Parse CSV
      const parsed = parseCSVContent(content, filename);

      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: "File is empty or could not be parsed" },
          { status: 400 }
        );
      }

      // Use provided mappings or auto-detect
      const mappings = mappingsStr
        ? JSON.parse(mappingsStr)
        : autoDetectMappings(parsed.headers);

      // Transform rows to leads
      leadsToImport = transformToLeads(parsed.rows, mappings);
      source = "csv";

    } else {
      return NextResponse.json(
        { error: "Invalid content type. Use multipart/form-data for files or application/json for search results" },
        { status: 400 }
      );
    }

    // Validate leads
    const { valid, invalid } = validateLeads(leadsToImport);

    if (valid.length === 0) {
      return NextResponse.json(
        {
          error: "No valid leads to import",
          invalid: invalid.slice(0, 10), // Return first 10 invalid for debugging
          totalInvalid: invalid.length,
        },
        { status: 400 }
      );
    }

    // Deduplicate within the import set
    const uniqueLeads = deduplicateLeads(valid);
    const duplicatesRemoved = valid.length - uniqueLeads.length;

    // Check for duplicates against existing leads in campaigns
    const emailsToCheck = uniqueLeads
      .map(lead => lead.email as string)
      .filter(email => email && !email.includes("@placeholder.local"));

    const duplicateCheck = await checkForDuplicates(emailsToCheck, campaignId);

    // Auto-create campaign if requested
    if (autoCreateCampaign && !campaignId) {
      const name = campaignName || `${source === "search" ? "AI Search" : "CSV Import"} - ${new Date().toLocaleDateString()}`;
      const [newCampaign] = await db
        .insert(campaigns)
        .values({
          name,
          source,
          sourceQuery: searchQuery,
          status: "draft",
          totalLeads: uniqueLeads.length,
        })
        .returning();
      campaignId = newCampaign.id;
    }

    // Prepare for database insert
    const leadsForDb: NewLead[] = uniqueLeads.map((lead) => ({
      firstName: String(lead.firstName || ""),
      lastName: String(lead.lastName || ""),
      email: lead.email ? String(lead.email) : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}@placeholder.local`,
      emailVerified: false,
      linkedinUrl: lead.linkedinUrl ? String(lead.linkedinUrl) : undefined,
      phone: lead.phone ? String(lead.phone) : undefined,
      jobTitle: String(lead.jobTitle || "Unknown"),
      schoolName: String(lead.schoolName || "Unknown"),
      schoolWebsite: lead.schoolWebsite ? String(lead.schoolWebsite) : undefined,
      schoolCountry: lead.schoolCountry ? String(lead.schoolCountry) : undefined,
      schoolRegion: lead.schoolRegion ? String(lead.schoolRegion) : undefined,
      curriculum: lead.curriculum as string[] || [],
      annualFeesUsd: lead.annualFeesUsd ? Number(lead.annualFeesUsd) : undefined,
      studentCount: lead.studentCount ? Number(lead.studentCount) : undefined,
      deviceAccess: lead.deviceAccess ? String(lead.deviceAccess) : undefined,
      schoolType: lead.schoolType ? String(lead.schoolType) : undefined,
      researchSummary: lead.researchSummary ? String(lead.researchSummary) : undefined,
      leadScore: lead.leadScore ? Number(lead.leadScore) : undefined,
      status: "new",
      campaignId: campaignId || undefined,
    }));

    // Batch insert (chunks of 50 for safety)
    const BATCH_SIZE = 50;
    const insertedIds: string[] = [];

    for (let i = 0; i < leadsForDb.length; i += BATCH_SIZE) {
      const batch = leadsForDb.slice(i, i + BATCH_SIZE);
      const inserted = await db.insert(leads).values(batch).returning({ id: leads.id });
      insertedIds.push(...inserted.map((r) => r.id));
    }

    // Also add to email_history for deduplication tracking
    const emailHistoryEntries = leadsForDb
      .filter(lead => lead.email && !lead.email.includes("@placeholder.local"))
      .map((lead, index) => ({
        email: lead.email!.toLowerCase(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        fullName: `${lead.firstName} ${lead.lastName}`.trim(),
        jobTitle: lead.jobTitle,
        schoolName: lead.schoolName,
        source: source === "search" ? "search" : "import",
        status: "contacted" as const,
        leadId: insertedIds[index] || null,
        firstContactedAt: new Date(),
        lastContactedAt: new Date(),
      }));

    // Insert into email_history (ignore conflicts on duplicate emails)
    if (emailHistoryEntries.length > 0) {
      for (let i = 0; i < emailHistoryEntries.length; i += BATCH_SIZE) {
        const batch = emailHistoryEntries.slice(i, i + BATCH_SIZE);
        try {
          await db.insert(emailHistory).values(batch).onConflictDoNothing();
        } catch (e) {
          // Ignore duplicate key errors
          console.log("[Lead Import] Some email history entries already exist");
        }
      }
    }

    // Update campaign lead count if we added to a campaign
    if (campaignId && insertedIds.length > 0) {
      // Use COALESCE to handle NULL totalLeads
      await db
        .update(campaigns)
        .set({
          totalLeads: sql`COALESCE(${campaigns.totalLeads}, 0) + ${insertedIds.length}`,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      console.log(`[Lead Import] Updated campaign ${campaignId} totalLeads by +${insertedIds.length}`);
    }

    console.log(`[Lead Import] Imported ${insertedIds.length} leads from ${source}${campaignId ? ` to campaign ${campaignId}` : ""}`);

    // Build duplicate warning message if applicable
    let duplicateWarning: string | null = null;
    if (duplicateCheck.duplicatesInSameCampaign.length > 0) {
      duplicateWarning = `${duplicateCheck.duplicatesInSameCampaign.length} lead(s) already exist in this campaign`;
    } else if (duplicateCheck.duplicatesInOtherCampaigns.length > 0) {
      const campaignNames = [...new Set(duplicateCheck.duplicatesInOtherCampaigns.map(d => d.existingCampaignName).filter(Boolean))];
      duplicateWarning = `${duplicateCheck.duplicatesInOtherCampaigns.length} lead(s) already exist in other campaigns: ${campaignNames.slice(0, 3).join(", ")}${campaignNames.length > 3 ? ` and ${campaignNames.length - 3} more` : ""}`;
    }

    return NextResponse.json({
      success: true,
      imported: insertedIds.length,
      duplicatesRemoved,
      invalidCount: invalid.length,
      source,
      ids: insertedIds,
      campaignId,
      // Duplicate detection info
      duplicates: {
        totalFound: duplicateCheck.duplicates.length,
        inSameCampaign: duplicateCheck.duplicatesInSameCampaign.length,
        inOtherCampaigns: duplicateCheck.duplicatesInOtherCampaigns.length,
        details: duplicateCheck.duplicates.slice(0, 20), // First 20 for display
        warning: duplicateWarning,
      },
    });

  } catch (error) {
    console.error("[Lead Import] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads/import/preview
 *
 * Preview CSV import with auto-detected mappings
 */
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Read file content
    const filename = file.name;
    let content: string | ArrayBuffer;

    if (filename.endsWith(".csv")) {
      content = await file.text();
    } else {
      content = await file.arrayBuffer();
    }

    // Parse CSV
    const parsed = parseCSVContent(content, filename);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty or could not be parsed" },
        { status: 400 }
      );
    }

    // Auto-detect mappings
    const detectedMappings = autoDetectMappings(parsed.headers);

    // Return preview data
    return NextResponse.json({
      headers: parsed.headers,
      mappings: detectedMappings,
      preview: parsed.rows.slice(0, 5), // First 5 rows for preview
      totalRows: parsed.totalRows,
      filename: filename,
    });

  } catch (error) {
    console.error("[Lead Import Preview] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}
