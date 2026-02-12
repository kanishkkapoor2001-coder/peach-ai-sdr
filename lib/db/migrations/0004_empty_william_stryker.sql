CREATE TYPE "public"."crm_activity_type" AS ENUM('email_sent', 'email_opened', 'email_clicked', 'email_replied', 'meeting_scheduled', 'meeting_completed', 'call_made', 'note_added', 'stage_changed', 'enriched', 'task_created', 'task_completed');--> statement-breakpoint
CREATE TYPE "public"."crm_stage" AS ENUM('lead', 'contacted', 'qualified', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'replied');--> statement-breakpoint
ALTER TYPE "public"."touchpoint_status" ADD VALUE 'bounced' BEFORE 'skipped';--> statement-breakpoint
ALTER TYPE "public"."touchpoint_status" ADD VALUE 'complained' BEFORE 'skipped';--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"activity_type" "crm_activity_type" NOT NULL,
	"subject" text,
	"body" text,
	"metadata" jsonb,
	"from_stage" text,
	"to_stage" text,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"job_title" text,
	"company_name" text,
	"company_website" text,
	"company_country" text,
	"company_region" text,
	"industry" text,
	"stage" "crm_stage" DEFAULT 'lead',
	"stage_changed_at" timestamp DEFAULT now(),
	"total_emails_sent" integer DEFAULT 0,
	"total_emails_opened" integer DEFAULT 0,
	"total_emails_clicked" integer DEFAULT 0,
	"total_replies" integer DEFAULT 0,
	"last_contacted_at" timestamp,
	"last_replied_at" timestamp,
	"linkedin_url" text,
	"linkedin_headline" text,
	"linkedin_connections" integer,
	"linkedin_about" text,
	"company_size" text,
	"company_funding" text,
	"company_revenue" text,
	"company_founded_year" integer,
	"company_description" text,
	"tech_stack" jsonb DEFAULT '[]'::jsonb,
	"competitors" jsonb DEFAULT '[]'::jsonb,
	"recent_news" jsonb DEFAULT '[]'::jsonb,
	"buying_signals" jsonb DEFAULT '[]'::jsonb,
	"decision_makers" jsonb DEFAULT '[]'::jsonb,
	"lead_score" integer,
	"score_reasons" jsonb DEFAULT '[]'::jsonb,
	"score_updated_at" timestamp,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"deal_value" integer,
	"deal_currency" text DEFAULT 'USD',
	"expected_close_date" timestamp,
	"lost_reason" text,
	"enriched_at" timestamp,
	"enrichment_source" text,
	"enrichment_status" text DEFAULT 'pending',
	"source" text,
	"campaign_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"crm_mode" text DEFAULT 'builtin',
	"visible_columns" jsonb DEFAULT '["firstName","lastName","email","companyName","jobTitle","stage","leadScore","lastContactedAt","totalReplies"]'::jsonb,
	"custom_field_definitions" jsonb DEFAULT '[]'::jsonb,
	"auto_add_on_reply" boolean DEFAULT true,
	"auto_add_on_meeting" boolean DEFAULT true,
	"default_stage" text DEFAULT 'lead',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"touchpoint_id" text NOT NULL,
	"event_type" "email_event_type" NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"clicked_url" text,
	"bounce_type" text,
	"bounce_reason" text,
	"country" text,
	"city" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD COLUMN "clicked_at" timestamp;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD COLUMN "tracking_id" text;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD COLUMN "open_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD COLUMN "click_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD COLUMN "clicked_links" jsonb;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_touchpoint_id_lead_touchpoints_id_fk" FOREIGN KEY ("touchpoint_id") REFERENCES "public"."lead_touchpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_activities_type_idx" ON "crm_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "crm_activities_occurred_at_idx" ON "crm_activities" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "crm_contacts_stage_idx" ON "crm_contacts" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "crm_contacts_lead_id_idx" ON "crm_contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_score_idx" ON "crm_contacts" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "email_events_touchpoint_id_idx" ON "email_events" USING btree ("touchpoint_id");--> statement-breakpoint
CREATE INDEX "email_events_event_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "email_events_occurred_at_idx" ON "email_events" USING btree ("occurred_at");