ALTER TABLE "sending_domains" ADD COLUMN "warmup_schedule" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "daily_limit" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "spf_status" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "dkim_status" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "dkim_selector" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "dmarc_status" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "dmarc_policy" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "mx_status" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "blacklist_status" jsonb;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "is_blacklisted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "health_score" integer;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "health_status" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "last_health_check" timestamp;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "health_recommendations" jsonb;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "current_delay_ms" integer DEFAULT 60000;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "bounce_count_today" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "complaint_count_today" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "last_bounce_at" timestamp;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "is_paused" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "paused_at" timestamp;