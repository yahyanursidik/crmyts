ALTER TABLE "event_attendance" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "referred_by_attendance_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_ticket_code_unique" ON "event_attendance" USING btree ("event_id","ticket_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_referral_code_unique" ON "event_attendance" USING btree ("event_id","referral_code");--> statement-breakpoint
CREATE INDEX "idx_attendance_referred_by" ON "event_attendance" USING btree ("referred_by_attendance_id");
