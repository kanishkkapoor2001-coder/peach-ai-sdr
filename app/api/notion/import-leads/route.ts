import { NextRequest, NextResponse } from "next/server";
import { db, leads } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * POST /api/notion/import-leads
 *
 * Import leads from Notion CRM database
 * Reads contacts from the configured Notion CRM database and imports them as leads
 */
export async function POST(request: NextRequest) {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const crmDbId = process.env.NOTION_CRM_DB_ID;

    if (!notionApiKey) {
      return NextResponse.json(
        { error: "Notion API key not configured. Add NOTION_API_KEY to your .env.local file." },
        { status: 400 }
      );
    }

    if (!crmDbId) {
      return NextResponse.json(
        { error: "Notion CRM database ID not configured. Add NOTION_CRM_DB_ID to your .env.local file." },
        { status: 400 }
      );
    }

    // Query Notion database
    const response = await fetch(`https://api.notion.com/v1/databases/${crmDbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionApiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Notion Import] API Error:", error);
      return NextResponse.json(
        { error: `Notion API error: ${error.message || "Failed to query database"}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const notionContacts = data.results || [];

    console.log(`[Notion Import] Found ${notionContacts.length} contacts in Notion CRM`);

    // Get existing emails to avoid duplicates
    const existingLeads = await db.select({ email: leads.email }).from(leads);
    const existingEmails = new Set(existingLeads.map(l => l.email.toLowerCase()));

    let imported = 0;
    let skipped = 0;

    for (const contact of notionContacts) {
      try {
        const properties = contact.properties || {};

        // Extract fields from Notion properties
        // Common property names for CRM databases
        const getName = () => {
          // Try different common property names
          for (const key of ["Name", "Contact Name", "Full Name", "name"]) {
            if (properties[key]?.title?.[0]?.plain_text) {
              return properties[key].title[0].plain_text;
            }
          }
          return null;
        };

        const getEmail = () => {
          for (const key of ["Email", "email", "E-mail", "Contact Email"]) {
            if (properties[key]?.email) {
              return properties[key].email;
            }
            if (properties[key]?.rich_text?.[0]?.plain_text) {
              const text = properties[key].rich_text[0].plain_text;
              if (text.includes("@")) return text;
            }
          }
          return null;
        };

        const getRole = () => {
          for (const key of ["Role", "Title", "Job Title", "Position", "role", "title"]) {
            if (properties[key]?.select?.name) {
              return properties[key].select.name;
            }
            if (properties[key]?.rich_text?.[0]?.plain_text) {
              return properties[key].rich_text[0].plain_text;
            }
          }
          return null;
        };

        const getCompany = () => {
          for (const key of ["Company", "School", "Organization", "company", "school"]) {
            if (properties[key]?.relation?.[0]) {
              // It's a relation - we'd need to fetch the related page
              // For now, skip and let user fill in manually
              return null;
            }
            if (properties[key]?.select?.name) {
              return properties[key].select.name;
            }
            if (properties[key]?.rich_text?.[0]?.plain_text) {
              return properties[key].rich_text[0].plain_text;
            }
          }
          return null;
        };

        const name = getName();
        const email = getEmail();

        if (!name || !email) {
          console.log(`[Notion Import] Skipping contact - missing name or email`);
          skipped++;
          continue;
        }

        // Check for duplicate
        if (existingEmails.has(email.toLowerCase())) {
          console.log(`[Notion Import] Skipping duplicate: ${email}`);
          skipped++;
          continue;
        }

        // Split name into first and last
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const role = getRole();
        const company = getCompany();

        // Insert lead
        await db.insert(leads).values({
          firstName,
          lastName,
          email: email.toLowerCase(),
          jobTitle: role || "Unknown",
          schoolName: company || "Unknown",
          status: "new",
        });

        existingEmails.add(email.toLowerCase());
        imported++;

        console.log(`[Notion Import] Imported: ${firstName} ${lastName} (${email})`);

      } catch (err) {
        console.error(`[Notion Import] Error importing contact:`, err);
        skipped++;
      }
    }

    console.log(`[Notion Import] Complete - Imported: ${imported}, Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: notionContacts.length,
    });

  } catch (error) {
    console.error("[Notion Import] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import from Notion" },
      { status: 500 }
    );
  }
}
