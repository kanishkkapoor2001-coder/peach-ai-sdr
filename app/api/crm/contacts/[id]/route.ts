import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crmContacts, crmActivities, leadTouchpoints, inboxMessages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/crm/contacts/[id]
 *
 * Get a single CRM contact with full details including activity history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [contact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, id))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get activity history
    const activities = await db
      .select()
      .from(crmActivities)
      .where(eq(crmActivities.contactId, id))
      .orderBy(desc(crmActivities.occurredAt))
      .limit(50);

    // Get email history if linked to a lead
    let emails: any[] = [];
    if (contact.leadId) {
      // Get touchpoints (sent emails)
      const touchpoints = await db
        .select()
        .from(leadTouchpoints)
        .where(eq(leadTouchpoints.leadId, contact.leadId))
        .orderBy(desc(leadTouchpoints.sentAt));

      // Get inbox messages (replies)
      const messages = await db
        .select()
        .from(inboxMessages)
        .where(eq(inboxMessages.leadId, contact.leadId))
        .orderBy(desc(inboxMessages.receivedAt));

      // Combine and format
      emails = [
        ...touchpoints
          .filter(tp => tp.sentAt)
          .map(tp => ({
            id: tp.id,
            type: "sent",
            subject: tp.subject,
            body: tp.body,
            date: tp.sentAt,
            status: tp.status,
            openedAt: tp.openedAt,
            clickedAt: tp.clickedAt,
          })),
        ...messages.map(m => ({
          id: m.id,
          type: m.direction,
          subject: m.subject,
          body: m.body,
          date: m.receivedAt,
          from: m.fromEmail,
          to: m.toEmail,
        })),
      ].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
    }

    return NextResponse.json({
      contact,
      activities,
      emails,
    });
  } catch (error) {
    console.error("[CRM Contact] Get error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crm/contacts/[id]
 *
 * Update a CRM contact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { stage: newStage, ...updates } = body;

    // Get current contact
    const [currentContact] = await db
      .select()
      .from(crmContacts)
      .where(eq(crmContacts.id, id))
      .limit(1);

    if (!currentContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If stage changed, log activity
    if (newStage && newStage !== currentContact.stage) {
      await db.insert(crmActivities).values({
        contactId: id,
        activityType: "stage_changed",
        subject: `Stage changed to ${newStage}`,
        fromStage: currentContact.stage,
        toStage: newStage,
      });
      updates.stage = newStage;
      updates.stageChangedAt = new Date();
    }

    // Update contact
    const [updatedContact] = await db
      .update(crmContacts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(crmContacts.id, id))
      .returning();

    return NextResponse.json({ contact: updatedContact });
  } catch (error) {
    console.error("[CRM Contact] Update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/contacts/[id]
 *
 * Delete a CRM contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.delete(crmContacts).where(eq(crmContacts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CRM Contact] Delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete contact" },
      { status: 500 }
    );
  }
}
