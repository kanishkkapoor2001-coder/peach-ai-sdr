/**
 * Saarthi AI Lead Search Client
 *
 * Connects to your existing lead search endpoint that uses NLP
 * to find school decision makers based on natural language queries.
 */

export interface SaarthiLead {
  name: string;
  title: string;
  email: string | null;
  contact_number: string | null;
  school_name: string;
  location: string;
  website: string | null;
  selection_reason: string;
  confidence: number;
}

export interface SaarthiSearchResponse {
  data: SaarthiLead[];
  query?: string;
  total?: number;
}

export interface SaarthiSearchRequest {
  query: string;
  // Add any other parameters your API accepts
  limit?: number;
  region?: string;
}

// Lead search API endpoint
const SAARTHI_API_URL = process.env.SAARTHI_API_URL || "https://whale-app-uprvn.ondigitalocean.app/leads";
const SAARTHI_TIMEOUT = 200000; // 200 seconds (API can take up to 3 minutes)

/**
 * Search for leads using natural language query
 *
 * @example
 * const results = await searchLeads({
 *   query: "Decision makers at IB schools in Southeast Asia where students have device access and fees > $2000/year"
 * });
 */
export async function searchLeads(request: SaarthiSearchRequest): Promise<SaarthiSearchResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAARTHI_TIMEOUT);

  try {
    const response = await fetch(SAARTHI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Saarthi API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Handle different response formats
    if (Array.isArray(data)) {
      return { data, query: request.query, total: data.length };
    }

    if (data.data && Array.isArray(data.data)) {
      return { ...data, query: request.query, total: data.data.length };
    }

    // Unexpected format
    console.warn("Unexpected Saarthi response format:", data);
    return { data: [], query: request.query, total: 0 };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Search timed out after 3 minutes. Please try a more specific query.");
      }
      throw error;
    }

    throw new Error("Unknown error during lead search");
  }
}

/**
 * Transform Saarthi lead to our database format
 */
export function transformSaarthiLead(lead: SaarthiLead): {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string;
  schoolName: string;
  schoolWebsite: string | null;
  schoolCountry: string | null;
  schoolRegion: string | null;
  researchSummary: string;
  leadScore: number | null;
} {
  // Parse name into first/last
  const nameParts = lead.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Parse location into country/region
  const locationParts = lead.location?.split(",").map(p => p.trim()) || [];
  const schoolRegion = locationParts[0] || null;
  const schoolCountry = locationParts[locationParts.length - 1] || null;

  // Calculate initial lead score from confidence
  // confidence 0.95 -> score 9, confidence 0.7 -> score 7
  const leadScore = lead.confidence ? Math.round(lead.confidence * 10) : null;

  return {
    firstName,
    lastName,
    email: lead.email || null,
    phone: lead.contact_number || null,
    jobTitle: lead.title || "Unknown",
    schoolName: lead.school_name || "Unknown",
    schoolWebsite: lead.website || null,
    schoolCountry,
    schoolRegion,
    researchSummary: lead.selection_reason || "",
    leadScore,
  };
}

/**
 * Transform multiple leads
 */
export function transformSaarthiLeads(leads: SaarthiLead[]) {
  return leads.map(transformSaarthiLead);
}
