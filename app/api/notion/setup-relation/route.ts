import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

/**
 * POST /api/notion/setup-relation
 * Create the Contacts relation property on Schools database
 * This links Schools → All Contacts (bidirectional)
 */
export async function POST(request: NextRequest) {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;
    const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;

    if (!COMPANY_DB_ID || !CRM_DB_ID) {
      return NextResponse.json(
        { error: "Missing NOTION_COMPANY_DB_ID or NOTION_CRM_DB_ID" },
        { status: 400 }
      );
    }

    // Check current schema
    const dbSchema = await notion.databases.retrieve({ database_id: COMPANY_DB_ID }) as any;
    const properties = dbSchema.properties || {};

    // Check if Contacts relation already exists
    for (const [name, prop] of Object.entries(properties) as any) {
      if (prop.type === "relation" && prop.relation?.database_id === CRM_DB_ID) {
        return NextResponse.json({
          success: true,
          message: `Relation property "${name}" already exists`,
          existingProperty: name,
        });
      }
    }

    console.log("[Setup Relation] Creating Contacts relation property...");
    console.log("[Setup Relation] Company DB:", COMPANY_DB_ID);
    console.log("[Setup Relation] CRM DB:", CRM_DB_ID);

    // Create the relation property
    try {
      const result = await notion.databases.update({
        database_id: COMPANY_DB_ID,
        properties: {
          "Contacts": {
            relation: {
              database_id: CRM_DB_ID,
              type: "dual_property",
              dual_property: {
                synced_property_name: "School",
              },
            },
          },
        } as any,
      });

      console.log("[Setup Relation] Success! Relation created.");

      return NextResponse.json({
        success: true,
        message: "Created 'Contacts' relation property on Schools database",
        createdSyncedProperty: "School (on All Contacts)",
      });
    } catch (createError: any) {
      console.error("[Setup Relation] Failed to create relation:", createError);

      // Parse the error for more details
      const errorDetails = {
        message: createError.message,
        code: createError.code,
        status: createError.status,
        body: createError.body,
      };

      return NextResponse.json({
        success: false,
        error: "Notion API doesn't allow creating relation properties programmatically",
        details: errorDetails,
        manualSetupRequired: true,
        instructions: [
          "1. Open your Notion workspace",
          "2. Go to the 'Schools copy' database",
          "3. Click the '+' button to add a new property",
          "4. Select 'Relation' as the property type",
          "5. Name it 'Contacts'",
          "6. Link it to your 'All Contacts' database",
          "7. Enable 'Show on All Contacts' to create the reverse link",
          "8. After setup, sync will work automatically"
        ],
      }, { status: 400 });
    }
  } catch (error) {
    console.error("[Setup Relation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notion/setup-relation
 * Check current relation setup status
 */
export async function GET() {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;
    const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;

    if (!COMPANY_DB_ID || !CRM_DB_ID) {
      return NextResponse.json({
        configured: false,
        error: "Missing database IDs in environment",
      });
    }

    // Get both schemas
    const [companyDb, crmDb] = await Promise.all([
      notion.databases.retrieve({ database_id: COMPANY_DB_ID }),
      notion.databases.retrieve({ database_id: CRM_DB_ID }),
    ]) as any[];

    // Find relation properties
    const companyRelations: any = {};
    const crmRelations: any = {};

    for (const [name, prop] of Object.entries(companyDb.properties) as any) {
      if (prop.type === "relation") {
        companyRelations[name] = {
          targetDatabase: prop.relation?.database_id,
          type: prop.relation?.type,
          syncedPropertyName: prop.relation?.synced_property_name,
        };
      }
    }

    for (const [name, prop] of Object.entries(crmDb.properties) as any) {
      if (prop.type === "relation") {
        crmRelations[name] = {
          targetDatabase: prop.relation?.database_id,
          type: prop.relation?.type,
          syncedPropertyName: prop.relation?.synced_property_name,
        };
      }
    }

    // Check if properly linked
    const hasSchoolsToContacts = Object.values(companyRelations).some(
      (r: any) => r.targetDatabase === CRM_DB_ID
    );
    const hasContactsToSchools = Object.values(crmRelations).some(
      (r: any) => r.targetDatabase === COMPANY_DB_ID
    );

    return NextResponse.json({
      configured: true,
      schoolsDatabase: {
        id: COMPANY_DB_ID,
        name: companyDb.title?.[0]?.plain_text,
        relationProperties: companyRelations,
        hasLinkToContacts: hasSchoolsToContacts,
      },
      contactsDatabase: {
        id: CRM_DB_ID,
        name: crmDb.title?.[0]?.plain_text,
        relationProperties: crmRelations,
        hasLinkToSchools: hasContactsToSchools,
      },
      status: hasSchoolsToContacts && hasContactsToSchools
        ? "fully_linked"
        : hasSchoolsToContacts || hasContactsToSchools
          ? "partially_linked"
          : "not_linked",
      recommendation: !hasSchoolsToContacts && !hasContactsToSchools
        ? "Call POST /api/notion/setup-relation to create the bidirectional link"
        : hasSchoolsToContacts && hasContactsToSchools
          ? "Databases are properly linked"
          : "Partial link exists - may need manual configuration in Notion",
    });
  } catch (error) {
    console.error("[Setup Relation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed" },
      { status: 500 }
    );
  }
}
