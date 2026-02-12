import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmContacts, crmActivities, leads, leadTouchpoints, inboxMessages, emailSequences } from "@/lib/db/schema";
import { eq, desc, asc, sql, and, or, ilike } from "drizzle-orm";

/**
 * GET /api/crm/contacts
 *
 * Fetch all CRM contacts with optional filtering and sorting
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stage = searchParams.get("stage");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    let query = db.select().from(crmContacts);

    // Build conditions
    const conditions = [];

    if (stage && stage !== "all") {
      conditions.push(eq(crmContacts.stage, stage as any));
    }

    if (search) {
      conditions.push(
        or(
          ilike(crmContacts.firstName, `%${search}%`),
          ilike(crmContacts.lastName, `%${search}%`),
          ilike(crmContacts.email, `%${search}%`),
          ilike(crmContacts.companyName, `%${search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Apply sorting
    const sortColumn = crmContacts[sortBy as keyof typeof crmContacts] || crmContacts.createdAt;
    if (sortOrder === "asc") {
      query = query.orderBy(asc(sortColumn as any)) as any;
    } else {
      query = query.orderBy(desc(sortColumn as any)) as any;
    }

    const contacts = await query;

    // Get stage counts
    const stageCounts = await db
      .select({
        stage: crmContacts.stage,
        count: sql<number>`count(*)::int`,
      })
      .from(crmContacts)
      .groupBy(crmContacts.stage);

    const stageCountMap: Record<string, number> = {};
    for (const sc of stageCounts) {
      if (sc.stage) {
        stageCountMap[sc.stage] = sc.count;
      }
    }

    return NextResponse.json({
      contacts,
      stageCounts: stageCountMap,
      total: contacts.length,
    });
  } catch (error) {
    console.error("[CRM Contacts] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/contacts
 *
 * Create a new CRM contact manually or from a lead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, ...contactData } = body;

    // If creating from a lead, auto-populate all data
    if (leadId) {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      // Check if contact already exists for this lead
      const [existingContact] = await db
        .select()
        .from(crmContacts)
        .where(eq(crmContacts.leadId, leadId))
        .limit(1);

      if (existingContact) {
        return NextResponse.json({
          contact: existingContact,
          message: "Contact already exists for this lead"
        });
      }

      // Get engagement metrics from lead touchpoints
      const touchpoints = await db
        .select()
        .from(leadTouchpoints)
        .where(eq(leadTouchpoints.leadId, leadId));

      let totalSent = 0;
      let totalOpened = 0;
      let totalClicked = 0;
      let totalReplied = 0;
      let lastContacted: Date | null = null;
      let lastReplied: Date | null = null;

      for (const tp of touchpoints) {
        if (tp.sentAt) {
          totalSent++;
          if (!lastContacted || tp.sentAt > lastContacted) {
            lastContacted = tp.sentAt;
          }
        }
        if (tp.openedAt) totalOpened++;
        if (tp.clickedAt) totalClicked++;
        if (tp.repliedAt) {
          totalReplied++;
          if (!lastReplied || tp.repliedAt > lastReplied) {
            lastReplied = tp.repliedAt;
          }
        }
      }

      // Create CRM contact with auto-populated data
      const [newContact] = await db
        .insert(crmContacts)
        .values({
          leadId: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          companyName: lead.schoolName,
          companyWebsite: lead.schoolWebsite,
          companyCountry: lead.schoolCountry,
          companyRegion: lead.schoolRegion,
          linkedinUrl: lead.linkedinUrl,
          stage: lead.status === "replied" ? "contacted" :
                 lead.status === "meeting_booked" ? "meeting_scheduled" : "lead",
          totalEmailsSent: totalSent,
          totalEmailsOpened: totalOpened,
          totalEmailsClicked: totalClicked,
          totalReplies: totalReplied,
          lastContactedAt: lastContacted,
          lastRepliedAt: lastReplied,
          leadScore: lead.leadScore,
          scoreReasons: lead.scoreReasons || [],
          source: contactData.source || "lead",
          campaignId: lead.campaignId,
          enrichmentStatus: "pending",
        })
        .returning();

      // Log activity
      await db.insert(crmActivities).values({
        contactId: newContact.id,
        activityType: "stage_changed",
        subject: "Contact created",
        toStage: newContact.stage || "lead",
        metadata: { source: "lead_import", leadId },
      });

      return NextResponse.json({ contact: newContact });
    }

    // Manual creation
    const [newContact] = await db
      .insert(crmContacts)
      .values({
        ...contactData,
        enrichmentStatus: "pending",
      })
      .returning();

    // Log activity
    await db.insert(crmActivities).values({
      contactId: newContact.id,
      activityType: "stage_changed",
      subject: "Contact created manually",
      toStage: newContact.stage || "lead",
    });

    return NextResponse.json({ contact: newContact });
  } catch (error) {
    console.error("[CRM Contacts] Create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create contact" },
      { status: 500 }
    );
  }
}
