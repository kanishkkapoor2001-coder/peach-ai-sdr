import * as XLSX from "xlsx";

// Common email domain typos - catch these during import
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
};

export interface CSVRow {
  [key: string]: string | number | undefined;
}

export interface ParsedCSV {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
}

// Common column name mappings for auto-detection
const COLUMN_MAPPINGS: Record<string, string[]> = {
  firstName: [
    "first_name", "firstname", "first name", "given name", "name_first",
    "contact_first_name", "person_first_name", "first"
  ],
  lastName: [
    "last_name", "lastname", "last name", "surname", "family name",
    "name_last", "contact_last_name", "person_last_name", "last"
  ],
  fullName: [
    "name", "full_name", "fullname", "full name", "contact_name", "person_name"
  ],
  email: [
    "email", "email_address", "emailaddress", "e-mail", "contact_email",
    "person_email", "work_email", "business_email", "mail"
  ],
  jobTitle: [
    "job_title", "jobtitle", "title", "position", "role", "designation",
    "job title", "job", "person_title", "contact_title"
  ],
  schoolName: [
    "school_name", "schoolname", "school", "organization", "organisation",
    "company", "company_name", "institution", "school name", "org_name",
    "organization_name", "organisation_name"
  ],
  schoolWebsite: [
    "school_website", "website", "url", "web", "school_url", "company_website",
    "org_website", "domain", "site"
  ],
  schoolCountry: [
    "country", "school_country", "location_country", "nation"
  ],
  schoolRegion: [
    "region", "state", "province", "area", "school_region", "location_region",
    "city", "location"
  ],
  linkedinUrl: [
    "linkedin", "linkedin_url", "linkedinurl", "linkedin_profile",
    "person_linkedin", "contact_linkedin", "li_url"
  ],
  phone: [
    "phone", "phone_number", "phonenumber", "telephone", "mobile", "cell",
    "contact_phone", "person_phone", "contact_number"
  ],
  curriculum: [
    "curriculum", "curricula", "program", "programme", "school_curriculum",
    "programs", "programmes"
  ],
  annualFeesUsd: [
    "annual_fees", "fees", "tuition", "annual_fees_usd", "fee", "tuition_fees",
    "yearly_fees", "annual_tuition", "tuition_fee"
  ],
  studentCount: [
    "student_count", "students", "enrollment", "enrolment", "student_body",
    "num_students", "total_students", "student_population"
  ],
  deviceAccess: [
    "device_access", "devices", "device_ratio", "tech_access", "1to1",
    "device_program", "technology_access"
  ],
  schoolType: [
    "school_type", "type", "school_category", "institution_type"
  ],
  selectionReason: [
    "selection_reason", "reason", "notes", "why", "research_summary",
    "summary", "description"
  ],
  confidence: [
    "confidence", "confidence_score", "score", "match_score"
  ],
};

/**
 * Parse CSV or Excel file to structured data
 */
export function parseCSVContent(content: string | ArrayBuffer, filename: string): ParsedCSV {
  let workbook: XLSX.WorkBook;

  if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || filename.endsWith(".numbers")) {
    // Excel/Numbers file
    workbook = XLSX.read(content, { type: "array" });
  } else {
    // CSV file
    workbook = XLSX.read(content, { type: "string" });
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  if (rawData.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Get headers from first row keys
  const headers = Object.keys(rawData[0]);

  // Convert to CSVRow format
  const rows: CSVRow[] = rawData.map((row) => {
    const csvRow: CSVRow = {};
    for (const key of headers) {
      const value = row[key];
      csvRow[key] = typeof value === "string" || typeof value === "number" ? value : undefined;
    }
    return csvRow;
  });

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Auto-detect column mappings based on header names
 */
export function autoDetectMappings(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/[_-]/g, " ");

    for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
      // Skip if this field is already mapped
      if (usedFields.has(field)) continue;

      const normalizedAliases = aliases.map(a => a.toLowerCase().replace(/[_-]/g, " "));

      if (
        normalizedAliases.includes(normalizedHeader) ||
        normalizedHeader === field.toLowerCase()
      ) {
        mappings[header] = field;
        usedFields.add(field);
        break;
      }
    }
  }

  return mappings;
}

/**
 * Get available lead fields for mapping
 */
export function getLeadFields(): { field: string; label: string; required: boolean }[] {
  return [
    { field: "firstName", label: "First Name", required: true },
    { field: "lastName", label: "Last Name", required: true },
    { field: "fullName", label: "Full Name (auto-split)", required: false },
    { field: "email", label: "Email", required: true },
    { field: "jobTitle", label: "Job Title", required: true },
    { field: "schoolName", label: "School Name", required: true },
    { field: "schoolWebsite", label: "School Website", required: false },
    { field: "schoolCountry", label: "Country", required: false },
    { field: "schoolRegion", label: "Region/State/City", required: false },
    { field: "linkedinUrl", label: "LinkedIn URL", required: false },
    { field: "phone", label: "Phone", required: false },
    { field: "curriculum", label: "Curriculum", required: false },
    { field: "annualFeesUsd", label: "Annual Fees (USD)", required: false },
    { field: "studentCount", label: "Student Count", required: false },
    { field: "deviceAccess", label: "Device Access", required: false },
    { field: "schoolType", label: "School Type", required: false },
    { field: "selectionReason", label: "Notes/Research Summary", required: false },
    { field: "confidence", label: "Confidence Score", required: false },
    { field: "_skip", label: "Skip this column", required: false },
  ];
}

/**
 * Transform CSV rows to lead objects using the provided mappings
 */
export function transformToLeads(
  rows: CSVRow[],
  mappings: Record<string, string>
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const lead: Record<string, unknown> = {};

    for (const [csvColumn, leadField] of Object.entries(mappings)) {
      // Skip columns marked to skip
      if (leadField === "_skip") continue;

      const value = row[csvColumn];
      if (value === undefined || value === "") continue;

      // Handle special field transformations
      switch (leadField) {
        case "fullName": {
          // Split full name into first/last
          const nameParts = String(value).trim().split(/\s+/);
          lead.firstName = nameParts[0] || "";
          lead.lastName = nameParts.slice(1).join(" ") || "";
          break;
        }

        case "curriculum": {
          // Split curriculum by comma/semicolon if it's a string
          lead[leadField] = typeof value === "string"
            ? value.split(/[,;]/).map((c) => c.trim()).filter(Boolean)
            : [String(value)];
          break;
        }

        case "annualFeesUsd":
        case "studentCount": {
          // Parse numbers, removing currency symbols and commas
          const numStr = String(value).replace(/[$,£€\s]/g, "").trim();
          const num = parseInt(numStr, 10);
          lead[leadField] = isNaN(num) ? undefined : num;
          break;
        }

        case "confidence": {
          // Parse confidence as decimal (0-1) or percentage
          const numStr = String(value).replace(/[%\s]/g, "").trim();
          let num = parseFloat(numStr);
          if (!isNaN(num)) {
            // If > 1, assume it's a percentage
            if (num > 1) num = num / 100;
            lead.leadScore = Math.round(num * 10); // Convert to 0-10 score
          }
          break;
        }

        case "selectionReason": {
          lead.researchSummary = value;
          break;
        }

        default:
          lead[leadField] = value;
      }
    }

    return lead;
  });
}

/**
 * Validate that required fields are present
 */
export function validateLeads(
  leads: Array<Record<string, unknown>>
): {
  valid: Array<Record<string, unknown>>;
  invalid: Array<{ row: number; errors: string[]; data: Record<string, unknown> }>;
} {
  // Only firstName, email, and schoolName are truly required
  // lastName and jobTitle can be empty strings or "Unknown"
  const strictlyRequired = ["firstName", "schoolName"];
  const valid: Array<Record<string, unknown>> = [];
  const invalid: Array<{ row: number; errors: string[]; data: Record<string, unknown> }> = [];

  leads.forEach((lead, index) => {
    const errors: string[] = [];

    // Check strictly required fields
    for (const field of strictlyRequired) {
      if (!lead[field] || (typeof lead[field] === "string" && lead[field].toString().trim() === "")) {
        errors.push(`Missing ${field}`);
      }
    }

    // Validate email format if present
    if (lead.email && typeof lead.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(lead.email)) {
        errors.push("Invalid email format");
      } else {
        // Check for common domain typos and auto-fix them
        const domain = lead.email.split("@")[1]?.toLowerCase();
        if (domain && COMMON_DOMAIN_TYPOS[domain]) {
          const correctedDomain = COMMON_DOMAIN_TYPOS[domain];
          const correctedEmail = lead.email.replace(/@[^@]+$/, `@${correctedDomain}`);
          console.log(`[CSV Parser] Auto-corrected email typo: ${lead.email} → ${correctedEmail}`);
          lead.email = correctedEmail;
        }
      }
    }

    // Note: email can be missing for AI search results - we'll find it later
    // lastName and jobTitle can be empty - we'll default them to "" and "Unknown"

    if (errors.length > 0) {
      invalid.push({ row: index + 1, errors, data: lead });
    } else {
      // Ensure defaults for optional fields
      if (!lead.lastName) lead.lastName = "";
      if (!lead.jobTitle) lead.jobTitle = "Unknown";
      valid.push(lead);
    }
  });

  return { valid, invalid };
}

/**
 * Deduplicate leads by email or school+name combination
 */
export function deduplicateLeads(
  leads: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];

  for (const lead of leads) {
    // Create a unique key - email if available, otherwise school+name
    const email = lead.email as string | undefined;
    const key = email
      ? email.toLowerCase()
      : `${(lead.schoolName as string || "").toLowerCase()}-${(lead.firstName as string || "").toLowerCase()}-${(lead.lastName as string || "").toLowerCase()}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(lead);
    }
  }

  return unique;
}
