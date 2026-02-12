import { NextRequest, NextResponse } from "next/server";
import { syncLeadToNotion, testNotionConnection, getNotionDatabaseSchema } from "@/lib/services/notion-client";

/**
 * POST /api/notion/sync
 * Sync a lead to Notion CRM
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const result = await syncLeadToNotion(leadId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      companyPageId: result.companyPageId,
      contactPageId: result.contactPageId,
      taskPageId: result.taskPageId,
    });
  } catch (error) {
    console.error("[API] Notion sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * Convert Notion database ID to URL
 */
function getNotionDatabaseUrl(databaseId: string | undefined): string | null {
  if (!databaseId) return null;
  // Remove hyphens and format as Notion URL
  const cleanId = databaseId.replace(/-/g, "");
  return `https://notion.so/${cleanId}`;
}

/**
 * GET /api/notion/sync
 * Test Notion connection and database access
 * Optional query param: ?schema=true to get database schemas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showSchema = searchParams.get("schema") === "true";

    const result = await testNotionConnection();

    // Add database IDs and URLs for direct linking
    const databaseLinks = {
      company: {
        id: process.env.NOTION_COMPANY_DB_ID || null,
        url: getNotionDatabaseUrl(process.env.NOTION_COMPANY_DB_ID),
        configured: !!process.env.NOTION_COMPANY_DB_ID,
      },
      crm: {
        id: process.env.NOTION_CRM_DB_ID || null,
        url: getNotionDatabaseUrl(process.env.NOTION_CRM_DB_ID),
        configured: !!process.env.NOTION_CRM_DB_ID,
      },
      tasks: {
        id: process.env.NOTION_TASKS_DB_ID || null,
        url: getNotionDatabaseUrl(process.env.NOTION_TASKS_DB_ID),
        configured: !!process.env.NOTION_TASKS_DB_ID,
      },
    };

    // If schema requested and we have database access, get the schemas
    if (showSchema) {
      const schemas: Record<string, any> = {};

      if (process.env.NOTION_COMPANY_DB_ID) {
        schemas.company = await getNotionDatabaseSchema(process.env.NOTION_COMPANY_DB_ID);
      }
      if (process.env.NOTION_CRM_DB_ID) {
        schemas.crm = await getNotionDatabaseSchema(process.env.NOTION_CRM_DB_ID);
      }
      if (process.env.NOTION_TASKS_DB_ID) {
        schemas.tasks = await getNotionDatabaseSchema(process.env.NOTION_TASKS_DB_ID);
      }

      return NextResponse.json({ ...result, databaseLinks, schemas });
    }

    return NextResponse.json({ ...result, databaseLinks });
  } catch (error) {
    console.error("[API] Notion connection test error:", error);
    return NextResponse.json(
      {
        connected: false,
        databases: { company: false, crm: false, tasks: false },
        databaseLinks: { company: null, crm: null, tasks: null },
        error: error instanceof Error ? error.message : "Connection test failed",
      },
      { status: 500 }
    );
  }
}
