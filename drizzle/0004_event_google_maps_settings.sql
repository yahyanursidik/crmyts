ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "location_address" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "google_maps_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "location_directions" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "show_google_maps" boolean DEFAULT true NOT NULL;
