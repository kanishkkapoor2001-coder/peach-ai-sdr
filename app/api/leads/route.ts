import { NextRequest, NextResponse } from "next/server";
import { db, leads, type NewLead } from "@/lib/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { getCurrentWorkspaceId } from "@/lib/auth-helpers";

// GET /api/leads - List all leads (with optional pagination for large datasets)
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get current workspace
    const workspaceId = await getCurrentWorkspaceId();

    // Build where conditions
    const conditions = [];
    if (workspaceId) {
      conditions.push(eq(leads.workspaceId, workspaceId));
    }
    if (status) {
      conditions.push(eq(leads.status, status as any));
    }

    const allLeads = conditions.length > 0
      ? await db
          .select()
          .from(leads)
          .where(and(...conditions))
          .orderBy(desc(leads.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(leads)
          .orderBy(desc(leads.createdAt))
          .limit(limit)
          .offset(offset);

    const duration = Date.now() - startTime;
    console.log(`[API] GET /api/leads - ${allLeads.length} leads in ${duration}ms`);

    return NextResponse.json({ leads: allLeads });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// POST /api/leads - Create a new lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get current workspace
    const workspaceId = await getCurrentWorkspaceId();

    const newLead: NewLead = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      emailVerified: body.emailVerified || false,
      linkedinUrl: body.linkedinUrl,
      phone: body.phone,
      jobTitle: body.jobTitle,
      schoolName: body.schoolName,
      schoolWebsite: body.schoolWebsite,
      schoolCountry: body.schoolCountry,
      schoolRegion: body.schoolRegion,
      curriculum: body.curriculum || [],
      annualFeesUsd: body.annualFeesUsd,
      studentCount: body.studentCount,
      deviceAccess: body.deviceAccess,
      schoolType: body.schoolType,
      recentNews: body.recentNews || [],
      aiPolicy: body.aiPolicy,
      strategicPriorities: body.strategicPriorities || [],
      researchSummary: body.researchSummary,
      status: "new",
      workspaceId: workspaceId || null,
    };

    const [created] = await db.insert(leads).values(newLead).returning();

    return NextResponse.json({ lead: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}

// PATCH /api/leads - Bulk update leads (OPTIMIZED: single query instead of N queries)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No lead IDs provided" },
        { status: 400 }
      );
    }

    // Get current workspace
    const workspaceId = await getCurrentWorkspaceId();

    // Build where conditions - only update leads in user's workspace
    const conditions = [inArray(leads.id, ids)];
    if (workspaceId) {
      conditions.push(eq(leads.workspaceId, workspaceId));
    }

    // OPTIMIZED: Single query with inArray instead of looping
    const results = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    return NextResponse.json({ leads: results });
  } catch (error) {
    console.error("Error updating leads:", error);
    return NextResponse.json(
      { error: "Failed to update leads" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads - Delete one or more leads
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "No lead IDs provided. Use ?ids=id1,id2,id3" },
        { status: 400 }
      );
    }

    const ids = idsParam.split(",").filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No valid lead IDs provided" },
        { status: 400 }
      );
    }

    // Get current workspace
    const workspaceId = await getCurrentWorkspaceId();

    // Build where conditions - only delete leads in user's workspace
    const conditions = [inArray(leads.id, ids)];
    if (workspaceId) {
      conditions.push(eq(leads.workspaceId, workspaceId));
    }

    // Delete leads (this will cascade delete related sequences due to FK constraints)
    const deleted = await db
      .delete(leads)
      .where(and(...conditions))
      .returning({ id: leads.id });

    console.log(`[API] DELETE /api/leads - Deleted ${deleted.length} leads`);

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      ids: deleted.map(d => d.id),
    });
  } catch (error) {
    console.error("Error deleting leads:", error);
    return NextResponse.json(
      { error: "Failed to delete leads" },
      { status: 500 }
    );
  }
}
