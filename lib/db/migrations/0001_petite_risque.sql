ALTER TABLE "campaigns" ADD COLUMN "sender_rotation" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "preferred_domain_ids" jsonb DEFAULT '[]'::jsonb;