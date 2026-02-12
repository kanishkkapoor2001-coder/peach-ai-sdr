/**
 * Notion CRM Integration
 *
 * Syncs leads to Notion with:
 * - Company Database (parent) - with school name
 * - CRM Database (contacts) - with email, phone, notes
 * - Tasks Database (tasks linked to contacts)
 */

import { Client } from "@notionhq/client";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";
import { calculateLeadScore, generateScoreReasons } from "./lead-scorer";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;
const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;
const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

export interface NotionSyncResult {
  success: boolean;
  companyPageId?: string;
  contactPageId?: string;
  taskPageId?: string;
  relationLinked?: boolean;
  relationSetupRequired?: boolean;
  error?: string;
}

/**
 * Check if a company already exists in Notion
 */
async function findCompany(schoolName: string): Promise<string | null> {
  if (!COMPANY_DB_ID) return null;

  try {
    const response = await notion.databases.query({
      database_id: COMPANY_DB_ID,
      filter: {
        property: "Name",
        title: {
          equals: schoolName,
        },
      },
    });

    if (response.results.length > 0) {
      return response.results[0].id;
    }
    return null;
  } catch (error) {
    console.error("[Notion] Error finding company:", error);
    return null;
  }
}

/**
 * Create a company in Notion
 */
async function createCompany(lead: {
  schoolName: string;
  schoolWebsite?: string | null;
  schoolCountry?: string | null;
}): Promise<string | null> {
  if (!COMPANY_DB_ID) return null;

  try {
    const properties: Record<string, any> = {
      Name: {
        title: [{ text: { content: lead.schoolName } }],
      },
    };

    console.log("[Notion] Creating company:", lead.schoolName);

    const response = await notion.pages.create({
      parent: { database_id: COMPANY_DB_ID },
      properties,
    });

    console.log("[Notion] Company created successfully:", response.id);
    return response.id;
  } catch (error: any) {
    console.error("[Notion] Error creating company:", error?.message || error);
    return null;
  }
}

/**
 * Create a contact in the CRM database (All Contacts)
 *
 * CURRENT Notion "All Contacts" database properties (as of API inspection):
 * - Name (title) - Contact name
 * - Email (email)
 * - Phone (phone_number)
 * - Phone no. (phone_number) - alternate phone field
 * - Title  (rich_text) - Job title (note: has trailing space)
 * - Stage (multi_select) - Prospect, Qualifying, etc.
 * - Source (select)
 * - Notes (rich_text) - For lead score, reasons
 * - Website  (url) - School website (note: has trailing space)
 * - Location  (multi_select) - Country/region (note: has trailing space)
 * - Fees (rich_text) - Annual fees
 * - Total Student Body Size (rich_text) - Student count
 * - Device Acess (rich_text) - Device access info (typo in Notion)
 * - Linkedin (rich_text) - LinkedIn URL
 * - Tasks (relation) - Link to Tasks database (dual_property)
 *
 * NOTE: There is NO relation to Schools/Company database in current schema!
 * The school info is stored in the Notes field instead.
 */
async function createContact(
  lead: {
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    phone?: string | null;
    schoolName?: string;
    schoolWebsite?: string | null;
    schoolCountry?: string | null;
    annualFeesUsd?: number | null;
    studentCount?: number | null;
    deviceAccess?: string | null;
    linkedinUrl?: string | null;
  },
  companyPageId: string | null,
  leadScore: number,
  scoreReasons: string[]
): Promise<string | null> {
  if (!CRM_DB_ID) return null;

  try {
    // Build notes content - lead score + reasons + school info
    let notesContent = `Lead Score: ${leadScore}/10\n\nWhy Good Fit:\n${scoreReasons.map((r) => `• ${r}`).join("\n")}`;
    if (lead.schoolName) {
      notesContent += `\n\nSchool: ${lead.schoolName}`;
    }

    const properties: Record<string, any> = {
      // Name is the page title in Notion
      "Name": {
        title: [{ text: { content: `${lead.firstName} ${lead.lastName}` } }],
      },
      // Email field (email type)
      "Email": {
        email: lead.email,
      },
      // Title for job role (rich_text)
      "Title ": {
        rich_text: [{ text: { content: lead.jobTitle || "" } }],
      },
      // Stage is multi_select
      "Stage": {
        multi_select: [{ name: "Prospect" }],
      },
      // Source field (select)
      "Source": {
        select: { name: "Outbound" },
      },
      // Notes for lead score info and reasons
      "Notes": {
        rich_text: [
          {
            text: {
              content: notesContent.slice(0, 2000), // Notion has a 2000 char limit per rich_text block
            },
          },
        ],
      },
    };

    // Add phone if available
    if (lead.phone) {
      properties["Phone"] = {
        phone_number: lead.phone,
      };
    }

    // Add school website (note the space in property name)
    if (lead.schoolWebsite) {
      properties["Website "] = {
        url: lead.schoolWebsite,
      };
    }

    // Add location/country (multi_select)
    if (lead.schoolCountry) {
      properties["Location "] = {
        multi_select: [{ name: lead.schoolCountry }],
      };
    }

    // Add fees (rich_text)
    if (lead.annualFeesUsd) {
      properties["Fees"] = {
        rich_text: [{ text: { content: `$${lead.annualFeesUsd.toLocaleString()}` } }],
      };
    }

    // Add student count (rich_text)
    if (lead.studentCount) {
      properties["Total Student Body Size"] = {
        rich_text: [{ text: { content: lead.studentCount.toString() } }],
      };
    }

    // Add device access (rich_text - note the typo in Notion: "Acess")
    if (lead.deviceAccess) {
      properties["Device Acess"] = {
        rich_text: [{ text: { content: lead.deviceAccess } }],
      };
    }

    // Add LinkedIn URL (rich_text)
    if (lead.linkedinUrl) {
      properties["Linkedin"] = {
        rich_text: [{ text: { content: lead.linkedinUrl } }],
      };
    }

    // NOTE: The CRM database does NOT have a relation to Schools/Company database
    // School information is stored in the Notes field instead
    // If a relation property exists, we'll try to set it, but it will likely fail
    // The updateCompanyWithContact function handles the reverse link (Company -> Contact)
    if (companyPageId) {
      console.log("[Notion] Company page ID available:", companyPageId);
      console.log("[Notion] Note: CRM has no School relation property - school info is in Notes");
    }

    console.log("[Notion] Creating contact with properties:", Object.keys(properties));

    const response = await notion.pages.create({
      parent: { database_id: CRM_DB_ID },
      properties,
    });

    console.log("[Notion] Contact created successfully:", response.id);
    return response.id;
  } catch (error: any) {
    // If the Company property name is wrong, try alternative names
    if (error?.message?.includes("Company") || error?.code === "validation_error") {
      console.log("[Notion] Trying alternative company relation property names...");
      return await createContactWithAlternativeRelation(lead, companyPageId, leadScore, scoreReasons);
    }
    console.error("[Notion] Error creating contact:", error);
    return null;
  }
}

/**
 * Fallback: Try alternative property names for company relation
 */
async function createContactWithAlternativeRelation(
  lead: {
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    phone?: string | null;
    schoolName?: string;
    schoolWebsite?: string | null;
    schoolCountry?: string | null;
    annualFeesUsd?: number | null;
    studentCount?: number | null;
    deviceAccess?: string | null;
    linkedinUrl?: string | null;
  },
  companyPageId: string | null,
  leadScore: number,
  scoreReasons: string[]
): Promise<string | null> {
  if (!CRM_DB_ID) return null;

  let notesContent = `Lead Score: ${leadScore}/10\n\nWhy Good Fit:\n${scoreReasons.map((r) => `• ${r}`).join("\n")}`;
  if (lead.schoolName) {
    notesContent += `\n\nSchool: ${lead.schoolName}`;
  }

  // Build base properties with school info
  const buildProperties = (): Record<string, any> => {
    const props: Record<string, any> = {
      "Name": {
        title: [{ text: { content: `${lead.firstName} ${lead.lastName}` } }],
      },
      "Email": {
        email: lead.email,
      },
      "Title ": {
        rich_text: [{ text: { content: lead.jobTitle || "" } }],
      },
      "Stage": {
        multi_select: [{ name: "Prospect" }],
      },
      "Source": {
        select: { name: "Outbound" },
      },
      "Notes": {
        rich_text: [
          {
            text: {
              content: notesContent.slice(0, 2000),
            },
          },
        ],
      },
    };

    if (lead.phone) {
      props["Phone"] = { phone_number: lead.phone };
    }
    if (lead.schoolWebsite) {
      props["Website "] = { url: lead.schoolWebsite };
    }
    if (lead.schoolCountry) {
      props["Location "] = { multi_select: [{ name: lead.schoolCountry }] };
    }
    if (lead.annualFeesUsd) {
      props["Fees"] = { rich_text: [{ text: { content: `$${lead.annualFeesUsd.toLocaleString()}` } }] };
    }
    if (lead.studentCount) {
      props["Total Student Body Size"] = { rich_text: [{ text: { content: lead.studentCount.toString() } }] };
    }
    if (lead.deviceAccess) {
      props["Device Acess"] = { rich_text: [{ text: { content: lead.deviceAccess } }] };
    }
    if (lead.linkedinUrl) {
      props["Linkedin"] = { rich_text: [{ text: { content: lead.linkedinUrl } }] };
    }

    return props;
  };

  // Alternative property names for company relation (including "School 1" which is the actual name)
  const relationPropertyNames = ["School 1", "Companies", "Company ", "Organisation", "Organization", "School"];

  for (const relationProp of relationPropertyNames) {
    try {
      const properties = buildProperties();

      if (companyPageId) {
        properties[relationProp] = {
          relation: [{ id: companyPageId }],
        };
      }

      console.log(`[Notion] Trying relation property: "${relationProp}"`);

      const response = await notion.pages.create({
        parent: { database_id: CRM_DB_ID },
        properties,
      });

      console.log(`[Notion] Contact created with "${relationProp}" relation:`, response.id);
      return response.id;
    } catch (error: any) {
      console.log(`[Notion] Property "${relationProp}" failed, trying next...`);
      continue;
    }
  }

  // Last resort: create without company relation
  console.log("[Notion] Creating contact without company relation");
  try {
    const properties = buildProperties();

    const response = await notion.pages.create({
      parent: { database_id: CRM_DB_ID },
      properties,
    });

    return response.id;
  } catch (error) {
    console.error("[Notion] Failed to create contact even without relation:", error);
    return null;
  }
}

/**
 * Update company with contact relation (bidirectional linking)
 *
 * IMPORTANT: The Notion API does NOT allow creating relation properties programmatically.
 * The user must manually create a "Contacts" relation property in their Schools database
 * that links to the "All Contacts" database.
 *
 * This function will:
 * 1. Check if a relation property exists
 * 2. If it exists, update it with the contact
 * 3. If it doesn't exist, log instructions for the user
 */
async function updateCompanyWithContact(
  companyPageId: string,
  contactPageId: string
): Promise<{ success: boolean; relationExists: boolean; propertyName?: string }> {
  if (!COMPANY_DB_ID) return { success: false, relationExists: false };

  try {
    const dbSchema = await notion.databases.retrieve({ database_id: COMPANY_DB_ID }) as any;
    const properties = dbSchema.properties || {};

    // Find any existing relation property that points to the CRM database
    let relationPropName: string | null = null;

    for (const [name, prop] of Object.entries(properties) as any) {
      if (prop.type === "relation") {
        // Check if this relation points to our CRM database
        if (prop.relation?.database_id === CRM_DB_ID) {
          relationPropName = name;
          console.log(`[Notion] Found existing relation property: "${name}"`);
          break;
        }
      }
    }

    // If no relation property exists, provide helpful message
    if (!relationPropName) {
      console.log("[Notion] ⚠️ No Contacts relation property found on Schools database");
      console.log("[Notion] To enable automatic contact linking, please:");
      console.log("[Notion]   1. Open your 'Schools copy' database in Notion");
      console.log("[Notion]   2. Add a new property called 'Contacts'");
      console.log("[Notion]   3. Set type to 'Relation'");
      console.log("[Notion]   4. Link it to your 'All Contacts' database");
      console.log("[Notion]   5. Enable 'Show on All Contacts' for bidirectional linking");
      return { success: false, relationExists: false };
    }

    // Now update the company page with the contact relation
    // Get existing relations to append to (not replace)
    const page = await notion.pages.retrieve({ page_id: companyPageId }) as any;
    const existingRelations: { id: string }[] = [];

    const prop = page.properties?.[relationPropName];
    if (prop?.relation) {
      existingRelations.push(...prop.relation);
    }

    // Check if contact is already linked
    const alreadyLinked = existingRelations.some(r => r.id === contactPageId);
    if (alreadyLinked) {
      console.log("[Notion] Contact already linked to company");
      return { success: true, relationExists: true, propertyName: relationPropName };
    }

    // Add the new contact to existing relations
    const allRelations = [...existingRelations, { id: contactPageId }];

    await notion.pages.update({
      page_id: companyPageId,
      properties: {
        [relationPropName]: {
          relation: allRelations,
        },
      },
    });

    console.log(`[Notion] ✓ Updated company with contact via "${relationPropName}" property`);
    return { success: true, relationExists: true, propertyName: relationPropName };
  } catch (error: any) {
    console.error("[Notion] Error updating company with contact:", error?.message);
    return { success: false, relationExists: false };
  }
}

/**
 * Create a follow-up task
 *
 * Actual Notion Tasks database properties:
 * - Task (title)
 * - Clients (relation to All Contacts)
 * - Due Date (date)
 * - Status (status type)
 * - Priority (select)
 * - Notes (rich_text)
 */
async function createTask(
  contactPageId: string,
  leadName: string
): Promise<string | null> {
  if (!TASKS_DB_ID) return null;

  try {
    // Calculate due date (3 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const properties: Record<string, any> = {
      // Task is the title
      "Task": {
        title: [{ text: { content: `Follow up with ${leadName}` } }],
      },
      // Clients is the relation to All Contacts
      "Clients ": {
        relation: [{ id: contactPageId }],
      },
      // Due Date
      "Due Date": {
        date: { start: dueDate.toISOString().split("T")[0] },
      },
      // Priority (select)
      "Priority": {
        select: { name: "Medium" },
      },
      // Notes
      "Notes": {
        rich_text: [
          {
            text: {
              content: "Lead replied to outreach. Review conversation and follow up.",
            },
          },
        ],
      },
    };

    const response = await notion.pages.create({
      parent: { database_id: TASKS_DB_ID },
      properties,
    });

    return response.id;
  } catch (error) {
    console.error("[Notion] Error creating task:", error);
    return null;
  }
}

/**
 * Sync a lead to Notion CRM
 */
export async function syncLeadToNotion(leadId: string): Promise<NotionSyncResult> {
  if (!process.env.NOTION_API_KEY || !COMPANY_DB_ID || !CRM_DB_ID) {
    return {
      success: false,
      error: "Notion not configured. Set NOTION_API_KEY and database IDs.",
    };
  }

  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    console.log(`[Notion] Syncing lead: ${lead.firstName} ${lead.lastName}`);

    const leadScore = calculateLeadScore(lead);
    const scoreReasons = generateScoreReasons(lead, leadScore);

    // Step 1: Find or create company
    let companyPageId = await findCompany(lead.schoolName);

    if (!companyPageId) {
      companyPageId = await createCompany({
        schoolName: lead.schoolName,
        schoolWebsite: lead.schoolWebsite,
        schoolCountry: lead.schoolCountry,
      });
    }

    if (!companyPageId) {
      return { success: false, error: "Failed to create/find company" };
    }

    // Step 2: Create contact with full school info
    const contactPageId = await createContact(
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        jobTitle: lead.jobTitle,
        phone: lead.phone,
        schoolName: lead.schoolName,
        schoolWebsite: lead.schoolWebsite,
        schoolCountry: lead.schoolCountry,
        annualFeesUsd: lead.annualFeesUsd,
        studentCount: lead.studentCount,
        deviceAccess: lead.deviceAccess,
        linkedinUrl: lead.linkedinUrl,
      },
      companyPageId,
      leadScore,
      scoreReasons
    );

    if (!contactPageId) {
      return {
        success: false,
        companyPageId,
        error: "Failed to create contact",
      };
    }

    // Step 2.5: Update company with contact relation (bidirectional)
    let relationLinked = false;
    let relationSetupRequired = false;

    if (companyPageId && contactPageId) {
      const relationResult = await updateCompanyWithContact(companyPageId, contactPageId);
      relationLinked = relationResult.success;
      relationSetupRequired = !relationResult.relationExists;
    }

    // Step 3: Create follow-up task
    let taskPageId: string | null = null;
    if (TASKS_DB_ID) {
      taskPageId = await createTask(
        contactPageId,
        `${lead.firstName} ${lead.lastName}`
      );
    }

    // Update lead with Notion IDs
    await db
      .update(leads)
      .set({
        notionCompanyId: companyPageId,
        notionContactId: contactPageId,
        leadScore,
        scoreReasons,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    console.log(
      `[Notion] Synced lead ${leadId} -> Company: ${companyPageId}, Contact: ${contactPageId}`
    );

    if (relationSetupRequired) {
      console.log("[Notion] ⚠️ Relation property not set up - see instructions above");
    }

    return {
      success: true,
      companyPageId,
      contactPageId,
      taskPageId: taskPageId || undefined,
      relationLinked,
      relationSetupRequired,
    };
  } catch (error) {
    console.error("[Notion] Sync error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

/**
 * Get database schema - useful for debugging property names
 */
export async function getNotionDatabaseSchema(databaseId: string): Promise<{
  success: boolean;
  properties?: Record<string, { type: string; name: string }>;
  error?: string;
}> {
  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });

    const properties: Record<string, { type: string; name: string }> = {};

    if ('properties' in database) {
      for (const [name, prop] of Object.entries(database.properties)) {
        properties[name] = {
          type: (prop as any).type,
          name: name,
        };
      }
    }

    return { success: true, properties };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get schema",
    };
  }
}

/**
 * Test Notion connection
 */
export async function testNotionConnection(): Promise<{
  connected: boolean;
  databases: { company: boolean; crm: boolean; tasks: boolean };
  error?: string;
}> {
  const result = {
    connected: false,
    databases: { company: false, crm: false, tasks: false },
  };

  if (!process.env.NOTION_API_KEY) {
    return { ...result, error: "NOTION_API_KEY not set" };
  }

  try {
    await notion.users.me({});
    result.connected = true;

    if (COMPANY_DB_ID) {
      try {
        await notion.databases.retrieve({ database_id: COMPANY_DB_ID });
        result.databases.company = true;
      } catch {
      }
    }

    if (CRM_DB_ID) {
      try {
        await notion.databases.retrieve({ database_id: CRM_DB_ID });
        result.databases.crm = true;
      } catch {
      }
    }

    if (TASKS_DB_ID) {
      try {
        await notion.databases.retrieve({ database_id: TASKS_DB_ID });
        result.databases.tasks = true;
      } catch {
      }
    }

    return result;
  } catch (error) {
    return {
      ...result,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
