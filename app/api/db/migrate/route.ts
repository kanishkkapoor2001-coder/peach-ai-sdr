import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/db/migrate
 *
 * Run CRM database migrations
 */
export async function POST() {
  try {
    // Create CRM enums if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE crm_stage AS ENUM('lead', 'contacted', 'qualified', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE crm_activity_type AS ENUM('email_sent', 'email_opened', 'email_clicked', 'email_replied', 'meeting_scheduled', 'meeting_completed', 'call_made', 'note_added', 'stage_changed', 'enriched', 'task_created', 'task_completed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create crm_contacts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_contacts (
        id text PRIMARY KEY,
        lead_id text REFERENCES leads(id) ON DELETE SET NULL,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text NOT NULL,
        phone text,
        job_title text,
        company_name text,
        company_website text,
        company_country text,
        company_region text,
        industry text,
        stage crm_stage DEFAULT 'lead',
        stage_changed_at timestamp DEFAULT now(),
        total_emails_sent integer DEFAULT 0,
        total_emails_opened integer DEFAULT 0,
        total_emails_clicked integer DEFAULT 0,
        total_replies integer DEFAULT 0,
        last_contacted_at timestamp,
        last_replied_at timestamp,
        linkedin_url text,
        linkedin_headline text,
        linkedin_connections integer,
        linkedin_about text,
        company_size text,
        company_funding text,
        company_revenue text,
        company_founded_year integer,
        company_description text,
        tech_stack jsonb DEFAULT '[]'::jsonb,
        competitors jsonb DEFAULT '[]'::jsonb,
        recent_news jsonb DEFAULT '[]'::jsonb,
        buying_signals jsonb DEFAULT '[]'::jsonb,
        decision_makers jsonb DEFAULT '[]'::jsonb,
        lead_score integer,
        score_reasons jsonb DEFAULT '[]'::jsonb,
        score_updated_at timestamp,
        custom_fields jsonb DEFAULT '{}'::jsonb,
        notes text,
        tags jsonb DEFAULT '[]'::jsonb,
        deal_value integer,
        deal_currency text DEFAULT 'USD',
        expected_close_date timestamp,
        lost_reason text,
        enriched_at timestamp,
        enrichment_source text,
        enrichment_status text DEFAULT 'pending',
        source text,
        campaign_id text REFERENCES campaigns(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Create crm_activities table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_activities (
        id text PRIMARY KEY,
        contact_id text NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
        activity_type crm_activity_type NOT NULL,
        subject text,
        body text,
        metadata jsonb,
        from_stage text,
        to_stage text,
        occurred_at timestamp DEFAULT now(),
        created_at timestamp DEFAULT now()
      );
    `);

    // Create crm_settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_settings (
        id text PRIMARY KEY,
        crm_mode text DEFAULT 'builtin',
        visible_columns jsonb DEFAULT '["firstName","lastName","email","companyName","jobTitle","stage","leadScore","lastContactedAt","totalReplies"]'::jsonb,
        custom_field_definitions jsonb DEFAULT '[]'::jsonb,
        auto_add_on_reply boolean DEFAULT true,
        auto_add_on_meeting boolean DEFAULT true,
        default_stage text DEFAULT 'lead',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON crm_contacts(email);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_contacts_stage_idx ON crm_contacts(stage);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_contacts_lead_id_idx ON crm_contacts(lead_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_contacts_score_idx ON crm_contacts(lead_score);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_activities_contact_id_idx ON crm_activities(contact_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_activities_type_idx ON crm_activities(activity_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_activities_occurred_at_idx ON crm_activities(occurred_at);`);

    return NextResponse.json({ success: true, message: "CRM tables created successfully" });
  } catch (error) {
    console.error("[DB Migrate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
