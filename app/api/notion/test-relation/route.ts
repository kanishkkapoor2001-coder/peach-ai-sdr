import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

/**
 * POST /api/notion/test-relation
 * Test setting a relation directly to debug the issue
 */
export async function POST(request: NextRequest) {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const { contactPageId, companyPageId } = await request.json();

    if (!contactPageId || !companyPageId) {
      return NextResponse.json(
        { error: "Both contactPageId and companyPageId are required" },
        { status: 400 }
      );
    }

    console.log("[Test Relation] Attempting to set School 1 relation");
    console.log("[Test Relation] Contact:", contactPageId);
    console.log("[Test Relation] Company:", companyPageId);

    const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;
    const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;

    // Get BOTH database schemas to understand the full relation config
    let crmSchema = null;
    let companySchema = null;
    let relationProperties: any = {};

    if (CRM_DB_ID) {
      const dbSchema = await notion.databases.retrieve({ database_id: CRM_DB_ID }) as any;
      crmSchema = dbSchema.properties;

      // Find all relation properties
      for (const [name, prop] of Object.entries(dbSchema.properties) as any) {
        if (prop.type === "relation") {
          relationProperties[name] = {
            type: prop.type,
            relation: prop.relation,
            databaseId: prop.relation?.database_id,
            syncedPropertyName: prop.relation?.synced_property_name,
            syncedPropertyId: prop.relation?.synced_property_id,
          };
        }
      }
    }

    if (COMPANY_DB_ID) {
      const dbSchema = await notion.databases.retrieve({ database_id: COMPANY_DB_ID }) as any;
      companySchema = {} as Record<string, any>;

      // Find all relation properties on company side
      for (const [name, prop] of Object.entries(dbSchema.properties) as any) {
        if (prop.type === "relation") {
          (companySchema as Record<string, any>)[name] = {
            type: prop.type,
            relation: prop.relation,
            databaseId: prop.relation?.database_id,
            syncedPropertyName: prop.relation?.synced_property_name,
          };
        }
      }
    }

    // Get current state of both pages BEFORE update
    const contactBefore = await notion.pages.retrieve({ page_id: contactPageId }) as any;
    const companyBefore = await notion.pages.retrieve({ page_id: companyPageId }) as any;

    // Try to update the contact with the School 1 relation
    try {
      const result = await notion.pages.update({
        page_id: contactPageId,
        properties: {
          "School 1": {
            relation: [{ id: companyPageId }],
          },
        },
      });

      // Wait for Notion to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get state AFTER update
      const contactAfter = await notion.pages.retrieve({ page_id: contactPageId }) as any;
      const companyAfter = await notion.pages.retrieve({ page_id: companyPageId }) as any;

      // Extract just the relation properties for comparison
      const extractRelations = (props: any) => {
        const result: any = {};
        for (const [name, prop] of Object.entries(props) as any) {
          if (prop.type === "relation") {
            result[name] = prop.relation;
          }
        }
        return result;
      };

      return NextResponse.json({
        success: true,
        relationProperties,
        companyRelationProperties: companySchema,
        contactBefore: extractRelations(contactBefore.properties),
        contactAfter: extractRelations(contactAfter.properties),
        companyBefore: extractRelations(companyBefore.properties),
        companyAfter: extractRelations(companyAfter.properties),
        updateResultId: result.id,
      });
    } catch (updateError: any) {
      console.error("[Test Relation] Update failed:", updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message,
        errorCode: updateError.code,
        errorBody: updateError.body,
        relationProperties,
        companyRelationProperties: companySchema,
      });
    }
  } catch (error) {
    console.error("[Test Relation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notion/test-relation
 * Get the database schemas to understand relation configuration
 */
export async function GET() {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;
    const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;

    const result: any = {
      crm: { relations: {}, allProperties: [] },
      company: { relations: {}, allProperties: [] },
    };

    if (CRM_DB_ID) {
      const dbSchema = await notion.databases.retrieve({ database_id: CRM_DB_ID }) as any;
      result.crm.title = dbSchema.title?.[0]?.plain_text;
      result.crm.allProperties = Object.keys(dbSchema.properties);

      for (const [name, prop] of Object.entries(dbSchema.properties) as any) {
        if (prop.type === "relation") {
          result.crm.relations[name] = {
            databaseId: prop.relation?.database_id,
            type: prop.relation?.type, // "single_property" or "dual_property"
            syncedPropertyName: prop.relation?.synced_property_name,
            syncedPropertyId: prop.relation?.synced_property_id,
          };
        }
      }
    }

    if (COMPANY_DB_ID) {
      const dbSchema = await notion.databases.retrieve({ database_id: COMPANY_DB_ID }) as any;
      result.company.title = dbSchema.title?.[0]?.plain_text;
      result.company.allProperties = Object.keys(dbSchema.properties);

      for (const [name, prop] of Object.entries(dbSchema.properties) as any) {
        if (prop.type === "relation") {
          result.company.relations[name] = {
            databaseId: prop.relation?.database_id,
            type: prop.relation?.type,
            syncedPropertyName: prop.relation?.synced_property_name,
            syncedPropertyId: prop.relation?.synced_property_id,
          };
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Test Relation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get schemas" },
      { status: 500 }
    );
  }
}
