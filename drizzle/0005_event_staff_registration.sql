ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "quota_staff" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "quota_staff_ikhwan" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "quota_staff_akhwat" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_staff_registration_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "staff_registration_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_events_staff_registration_token" ON "events" USING btree ("staff_registration_token") WHERE "staff_registration_token" IS NOT NULL;
