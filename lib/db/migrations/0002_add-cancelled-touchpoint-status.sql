ALTER TYPE "public"."touchpoint_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "sending_method" text DEFAULT 'resend';--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "smtp_password" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "smtp_secure" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "imap_host" text;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "imap_port" integer;--> statement-breakpoint
ALTER TABLE "sending_domains" ADD COLUMN "last_imap_sync" timestamp;