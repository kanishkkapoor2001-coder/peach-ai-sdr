import { NextRequest, NextResponse } from "next/server";
import { db, meetings, leads } from "@/lib/db";
import { eq, desc, and, sql, SQL } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const leadId = searchParams.get("leadId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const conditions: SQL[] = [];

    if (status && status !== "all") {
      conditions.push(eq(meetings.status, status));
    }

    if (leadId) {
      conditions.push(eq(meetings.leadId, leadId));
    }

    const [result, statsResult] = await Promise.all([
      db
        .select({
          meeting: meetings,
          lead: leads,
        })
        .from(meetings)
        .innerJoin(leads, eq(meetings.leadId, leads.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(meetings.scheduledAt))
        .limit(limit),
      db
        .select({
          status: meetings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(meetings)
        .groupBy(meetings.status),
    ]);

    const stats = {
      total: 0,
      scheduled: 0,
      completed: 0,
      canceled: 0,
      no_show: 0,
    };

    statsResult.forEach((row) => {
      const statusKey = row.status as keyof typeof stats;
      if (statusKey in stats) {
        stats[statusKey] = row.count;
      }
      stats.total += row.count;
    });

    return NextResponse.json({
      meetings: result.map(({ meeting, lead }) => ({
        ...meeting,
        lead: {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          schoolName: lead.schoolName,
          schoolCountry: lead.schoolCountry,
          jobTitle: lead.jobTitle,
        },
      })),
      stats,
    });
  } catch (error) {
    console.error("[Meetings] Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingId, status, notes, outcome } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (outcome !== undefined) {
      updateData.outcome = outcome;
    }

    const [updated] = await db
      .update(meetings)
      .set(updateData)
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (status === "completed") {
      await db
        .update(leads)
        .set({ status: "won", updatedAt: new Date() })
        .where(eq(leads.id, updated.leadId));
    }

    return NextResponse.json({ success: true, meeting: updated });
  } catch (error) {
    console.error("[Meetings] Error updating meeting:", error);
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID required" },
        { status: 400 }
      );
    }

    const [canceled] = await db
      .update(meetings)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!canceled) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    await db
      .update(leads)
      .set({ status: "replied", updatedAt: new Date() })
      .where(eq(leads.id, canceled.leadId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Meetings] Error canceling meeting:", error);
    return NextResponse.json(
      { error: "Failed to cancel meeting" },
      { status: 500 }
    );
  }
}
