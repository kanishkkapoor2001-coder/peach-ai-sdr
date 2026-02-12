import { NextRequest, NextResponse } from "next/server";
import { searchLeads, transformSaarthiLeads } from "@/lib/services/saarthi-client";

// Set max duration for this API route (180+ seconds for slow search API)
export const maxDuration = 200; // 200 seconds

/**
 * POST /api/leads/search
 *
 * Search for leads using natural language query
 *
 * Request body:
 * {
 *   query: string  // Natural language search query
 * }
 *
 * Response:
 * {
 *   leads: Array<{
 *     name, title, email, phone, schoolName, location, website, reason, confidence
 *   }>,
 *   total: number,
 *   query: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit } = body;

    if (!query || typeof query !== "string" || query.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a more detailed search query (at least 10 characters)" },
        { status: 400 }
      );
    }

    console.log(`[Lead Search] Starting search for: "${query}" (limit: ${limit || "none"})`);
    const startTime = Date.now();

    // Call lead search API
    const response = await searchLeads({ query: query.trim(), limit: limit || undefined });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Lead Search] Found ${response.data.length} leads in ${duration}s`);

    // Transform to our format but keep original data for preview
    const transformedLeads = transformSaarthiLeads(response.data);

    // Get all existing emails from email_history to filter duplicates
    const { db, emailHistory } = await import("@/lib/db");
    const existingEmails = await db.select({ email: emailHistory.email }).from(emailHistory);
    const existingEmailSet = new Set(existingEmails.map(e => e.email.toLowerCase()));

    // Also get emails from leads table
    const { leads } = await import("@/lib/db");
    const existingLeadEmails = await db.select({ email: leads.email }).from(leads);
    existingLeadEmails.forEach(e => existingEmailSet.add(e.email.toLowerCase()));

    // Combine original and transformed data for preview, marking duplicates
    const previewLeads = response.data.map((original, index) => {
      const email = original.email?.toLowerCase() || "";
      const isDuplicate = email ? existingEmailSet.has(email) : false;
      const transformed = transformedLeads[index];

      return {
        // Original fields for display
        name: original.name,
        title: original.title,
        originalEmail: original.email,
        phone: original.contact_number,
        schoolName: original.school_name,
        location: original.location,
        website: original.website,
        reason: original.selection_reason,
        confidence: original.confidence,
        // Duplicate flag
        isDuplicate,
        // Transformed fields for import (email will overwrite original)
        firstName: transformed.firstName,
        lastName: transformed.lastName,
        email: transformed.email,
        jobTitle: transformed.jobTitle,
        schoolWebsite: transformed.schoolWebsite,
        schoolCountry: transformed.schoolCountry,
        schoolRegion: transformed.schoolRegion,
        researchSummary: transformed.researchSummary,
        leadScore: transformed.leadScore,
      };
    });

    // Filter out duplicates for the main list, but keep count
    const uniqueLeads = previewLeads.filter(l => !l.isDuplicate);
    const duplicateCount = previewLeads.length - uniqueLeads.length;

    // Filter out leads without ANY contact method (email, phone, or LinkedIn)
    // Leads without contact info are useless for outreach
    const contactableLeads = uniqueLeads.filter(l => {
      const hasEmail = l.email || l.originalEmail;
      const hasPhone = l.phone;
      // Check if website might be a LinkedIn profile
      const hasLinkedIn = l.website && l.website.includes("linkedin.com");
      return hasEmail || hasPhone || hasLinkedIn;
    });
    const noContactCount = uniqueLeads.length - contactableLeads.length;

    // Log filtering results
    if (noContactCount > 0) {
      console.log(`[Lead Search] Filtered out ${noContactCount} leads with no contact information`);
    }

    return NextResponse.json({
      leads: contactableLeads,
      total: contactableLeads.length,
      duplicatesRemoved: duplicateCount,
      noContactRemoved: noContactCount,
      query: query,
      duration: `${duration}s`,
    });

  } catch (error) {
    console.error("[Lead Search] Error:", error);

    const message = error instanceof Error ? error.message : "Search failed";

    // Check for timeout
    if (message.includes("timed out")) {
      return NextResponse.json(
        { error: message },
        { status: 504 }
      );
    }

    // Check for 404 - likely means the API endpoint isn't configured
    if (message.includes("404")) {
      return NextResponse.json(
        {
          error: "AI Search is not configured. Please set SAARTHI_API_URL in your environment variables or use CSV import instead.",
          hint: "Add SAARTHI_API_URL=your-api-url to .env.local"
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
