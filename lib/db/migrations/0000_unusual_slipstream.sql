CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'generating', 'ready', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('email', 'linkedin_message', 'linkedin_connection', 'sms', 'whatsapp', 'phone_call');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'approved', 'researching', 'emails_generated', 'emailing', 'replied', 'meeting_booked', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."sequence_status" AS ENUM('draft', 'pending_review', 'approved', 'active', 'paused', 'completed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."touchpoint_status" AS ENUM('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"name" text NOT NULL,
	"description" text,
	"source" text,
	"source_query" text,
	"status" "campaign_status" DEFAULT 'draft',
	"total_leads" integer DEFAULT 0,
	"emails_generated" integer DEFAULT 0,
	"emails_approved" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"positive_replies" integer DEFAULT 0,
	"meetings" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"sequence_type" text DEFAULT 'ai',
	"ai_criteria" jsonb
);
--> statement-breakpoint
CREATE TABLE "company_context" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_website" text,
	"company_description" text,
	"industry" text,
	"value_propositions" jsonb DEFAULT '[]'::jsonb,
	"target_markets" jsonb DEFAULT '[]'::jsonb,
	"pain_points" jsonb DEFAULT '[]'::jsonb,
	"differentiators" jsonb DEFAULT '[]'::jsonb,
	"email_tone" text DEFAULT 'professional',
	"sender_name" text,
	"sender_title" text,
	"signature_block" text,
	"uploaded_documents" jsonb DEFAULT '[]'::jsonb,
	"ai_insights" jsonb,
	"website_scraped_at" timestamp,
	"website_content" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_history" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"job_title" text,
	"school_name" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'contacted',
	"lead_id" text,
	"first_contacted_at" timestamp,
	"last_contacted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_history_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"primary_angle" text,
	"secondary_angle" text,
	"tertiary_angle" text,
	"email_1_subject" text,
	"email_1_body" text,
	"email_1_sent_at" timestamp,
	"email_2_subject" text,
	"email_2_body" text,
	"email_2_sent_at" timestamp,
	"email_3_subject" text,
	"email_3_body" text,
	"email_3_sent_at" timestamp,
	"email_4_subject" text,
	"email_4_body" text,
	"email_4_sent_at" timestamp,
	"email_5_subject" text,
	"email_5_body" text,
	"email_5_sent_at" timestamp,
	"status" "sequence_status" DEFAULT 'draft',
	"current_email" integer DEFAULT 1,
	"next_send_at" timestamp,
	"stop_reason" text,
	"confidence_score" integer,
	"confidence_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"sequence_id" text,
	"direction" "message_direction" NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"html_body" text,
	"thread_id" text,
	"in_reply_to" text,
	"message_id" text,
	"ai_draft_reply" text,
	"ai_draft_approved" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"read_by" jsonb DEFAULT '[]'::jsonb,
	"assigned_to" text,
	"received_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_touchpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"touchpoint_template_id" text,
	"step_number" integer NOT NULL,
	"channel" "channel_type" NOT NULL,
	"subject" text,
	"body" text,
	"status" "touchpoint_status" DEFAULT 'pending',
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"replied_at" timestamp,
	"confidence_score" integer,
	"confidence_reason" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"linkedin_url" text,
	"phone" text,
	"job_title" text NOT NULL,
	"school_name" text NOT NULL,
	"school_website" text,
	"school_country" text,
	"school_region" text,
	"curriculum" jsonb DEFAULT '[]'::jsonb,
	"annual_fees_usd" integer,
	"student_count" integer,
	"device_access" text,
	"school_type" text,
	"recent_news" jsonb DEFAULT '[]'::jsonb,
	"ai_policy" text,
	"strategic_priorities" jsonb DEFAULT '[]'::jsonb,
	"research_summary" text,
	"person_insights" jsonb,
	"school_insights" jsonb,
	"lead_score" integer,
	"score_reasons" jsonb DEFAULT '[]'::jsonb,
	"status" "lead_status" DEFAULT 'new',
	"notion_company_id" text,
	"notion_contact_id" text,
	"campaign_id" text,
	"workspace_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_preps" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"rundown" text,
	"talking_points" jsonb DEFAULT '[]'::jsonb,
	"questions_to_ask" jsonb DEFAULT '[]'::jsonb,
	"potential_objections" jsonb DEFAULT '[]'::jsonb,
	"calendly_event_uri" text,
	"meeting_scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"end_time" timestamp,
	"event_name" text,
	"meeting_url" text,
	"prep_document" jsonb,
	"calendly_event_uri" text,
	"calendly_invitee_uri" text,
	"status" text DEFAULT 'scheduled',
	"notes" text,
	"outcome" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sending_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text NOT NULL,
	"warmup_start_date" timestamp DEFAULT now(),
	"sent_today" integer DEFAULT 0,
	"last_reset_date" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sending_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "sequence_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"generation_type" text DEFAULT 'manual',
	"ai_reasoning" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "touchpoint_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence_template_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"channel" "channel_type" NOT NULL,
	"delay_days" integer DEFAULT 0,
	"preferred_time_of_day" text,
	"subject" text,
	"body" text,
	"talking_points" jsonb DEFAULT '[]'::jsonb,
	"personalization_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#f97316',
	"default_from_name" text,
	"default_from_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD CONSTRAINT "lead_touchpoints_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_touchpoints" ADD CONSTRAINT "lead_touchpoints_touchpoint_template_id_touchpoint_templates_id_fk" FOREIGN KEY ("touchpoint_template_id") REFERENCES "public"."touchpoint_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_preps" ADD CONSTRAINT "meeting_preps_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_templates" ADD CONSTRAINT "sequence_templates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoint_templates" ADD CONSTRAINT "touchpoint_templates_sequence_template_id_sequence_templates_id_fk" FOREIGN KEY ("sequence_template_id") REFERENCES "public"."sequence_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_workspace_id_idx" ON "campaigns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sequences_lead_id_idx" ON "email_sequences" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sequences_status_idx" ON "email_sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sequences_confidence_idx" ON "email_sequences" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "lead_touchpoints_lead_id_idx" ON "lead_touchpoints" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_touchpoints_status_idx" ON "lead_touchpoints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lead_touchpoints_scheduled_idx" ON "lead_touchpoints" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_campaign_id_idx" ON "leads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "leads_workspace_id_idx" ON "leads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sequence_templates_campaign_id_idx" ON "sequence_templates" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "touchpoint_templates_sequence_id_idx" ON "touchpoint_templates" USING btree ("sequence_template_id");--> statement-breakpoint
CREATE INDEX "touchpoint_templates_step_idx" ON "touchpoint_templates" USING btree ("step_number");