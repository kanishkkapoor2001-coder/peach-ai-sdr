import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

/**
 * GET /api/notion/debug
 * Debug Notion database structure - see actual page properties
 *
 * Query params:
 * - pageId: specific page ID to check
 * - schoolName: search for a specific school by name
 */
export async function GET(request: NextRequest) {
  try {
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get("pageId");
    const schoolName = searchParams.get("schoolName");

    const COMPANY_DB_ID = process.env.NOTION_COMPANY_DB_ID;
    const CRM_DB_ID = process.env.NOTION_CRM_DB_ID;

    const result: any = {
      company: null,
      crm: null,
    };

    // If specific page ID provided, get that page
    if (pageId) {
      const page = await notion.pages.retrieve({ page_id: pageId }) as any;
      return NextResponse.json({
        pageId: page.id,
        properties: Object.keys(page.properties).map((key) => ({
          name: key,
          type: page.properties[key].type,
          value: page.properties[key],
        })),
      });
    }

    // If school name provided, search for it
    if (schoolName && COMPANY_DB_ID) {
      const searchResult = await notion.databases.query({
        database_id: COMPANY_DB_ID,
        filter: {
          property: "Name",
          title: {
            equals: schoolName,
          },
        },
      });

      if (searchResult.results.length > 0) {
        const page = searchResult.results[0] as any;
        result.company = {
          pageId: page.id,
          properties: Object.keys(page.properties).map((key) => ({
            name: key,
            type: page.properties[key].type,
            value: page.properties[key],
          })),
        };
      } else {
        result.company = { error: `School "${schoolName}" not found` };
      }

      return NextResponse.json(result);
    }

    // Default: Get first page from each database
    if (COMPANY_DB_ID) {
      const companyPages = await notion.databases.query({
        database_id: COMPANY_DB_ID,
        page_size: 5,
      });

      result.companies = companyPages.results.map((page: any) => ({
        pageId: page.id,
        name: page.properties.Name?.title?.[0]?.plain_text || "Unknown",
        contactsCount: page.properties.Contacts?.relation?.length || 0,
        contacts: page.properties.Contacts?.relation || [],
      }));
    }

    // Get CRM contacts with their School relation
    if (CRM_DB_ID) {
      const crmPages = await notion.databases.query({
        database_id: CRM_DB_ID,
        page_size: 5,
      });

      result.contacts = crmPages.results.map((page: any) => ({
        pageId: page.id,
        name: page.properties.Name?.title?.[0]?.plain_text || "Unknown",
        email: page.properties.Email?.email || null,
        schoolRelation: page.properties["School 1"]?.relation || [],
      }));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Notion Debug] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Debug failed" },
      { status: 500 }
    );
  }
}
