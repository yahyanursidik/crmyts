CREATE TYPE "public"."donor_pipeline_stage_enum" AS ENUM('new_lead', 'contacted', 'interested', 'donated_once', 'regular_donor', 'loyal', 'dormant');--> statement-breakpoint
CREATE TABLE "donor_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"from_stage" "donor_pipeline_stage_enum",
	"to_stage" "donor_pipeline_stage_enum" NOT NULL,
	"reason" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazaar_booths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bazaar_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"zone" text DEFAULT 'Zona Utama' NOT NULL,
	"size" text DEFAULT '2x2 meter',
	"facilities" jsonb,
	"price_rupiah" integer DEFAULT 0 NOT NULL,
	"allowed_category" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazaar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"rules_and_terms" text,
	"default_fee_rupiah" integer DEFAULT 0 NOT NULL,
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"payment_instructions" text,
	"layout_zones" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazaar_tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bazaar_id" uuid NOT NULL,
	"booth_id" uuid,
	"person_id" uuid,
	"brand_name" text NOT NULL,
	"business_category" text DEFAULT 'kuliner' NOT NULL,
	"pic_name" text NOT NULL,
	"pic_phone" text NOT NULL,
	"pic_email" text,
	"pic_ktp_number" text,
	"social_media" text,
	"product_description" text,
	"electricity_needed" boolean DEFAULT false NOT NULL,
	"electricity_watts" integer DEFAULT 0,
	"special_requests" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"infaq_amount_rupiah" integer DEFAULT 0 NOT NULL,
	"payment_proof_url" text,
	"payment_verified_at" timestamp with time zone,
	"payment_verified_by" uuid,
	"rejection_reason" text,
	"admin_notes" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "donor_stage" "donor_pipeline_stage_enum" DEFAULT 'new_lead' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "ticket_code" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "registration_group_id" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "family_relationship" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_status" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_amount_rupiah" integer;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "payment_rejection_reason" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "vehicle_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "vehicle_plate_number" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "agreed_to_rules" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "registration_data" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "target_audience" text DEFAULT 'umum' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_ikhwan" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_akhwat" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_registration_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "car_parking_quota" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "motorcycle_parking_quota" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_rules" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "custom_venue_rules" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "price_rupiah" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "payment_instructions" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "form_config" jsonb;--> statement-breakpoint
ALTER TABLE "donor_stage_history" ADD CONSTRAINT "donor_stage_history_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_stage_history" ADD CONSTRAINT "donor_stage_history_changed_by_app_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_booths" ADD CONSTRAINT "bazaar_booths_bazaar_id_bazaar_events_id_fk" FOREIGN KEY ("bazaar_id") REFERENCES "public"."bazaar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_events" ADD CONSTRAINT "bazaar_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_tenants" ADD CONSTRAINT "bazaar_tenants_bazaar_id_bazaar_events_id_fk" FOREIGN KEY ("bazaar_id") REFERENCES "public"."bazaar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_tenants" ADD CONSTRAINT "bazaar_tenants_booth_id_bazaar_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."bazaar_booths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_tenants" ADD CONSTRAINT "bazaar_tenants_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bazaar_tenants" ADD CONSTRAINT "bazaar_tenants_payment_verified_by_app_users_id_fk" FOREIGN KEY ("payment_verified_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_donor_stage_hist_person" ON "donor_stage_history" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bazaar_booths_bazaar_code" ON "bazaar_booths" USING btree ("bazaar_id","code");--> statement-breakpoint
CREATE INDEX "idx_bazaar_booths_bazaar_id" ON "bazaar_booths" USING btree ("bazaar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bazaar_events_event_id" ON "bazaar_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_bazaar_tenants_bazaar_id" ON "bazaar_tenants" USING btree ("bazaar_id");--> statement-breakpoint
CREATE INDEX "idx_bazaar_tenants_status" ON "bazaar_tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bazaar_tenants_category" ON "bazaar_tenants" USING btree ("business_category");--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_payment_verified_by_app_users_id_fk" FOREIGN KEY ("payment_verified_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_persons_donor_stage" ON "persons" USING btree ("donor_stage");--> statement-breakpoint
CREATE INDEX "idx_attendance_reg_group" ON "event_attendance" USING btree ("registration_group_id");--> statement-breakpoint
CREATE INDEX "idx_events_target_audience" ON "events" USING btree ("target_audience");