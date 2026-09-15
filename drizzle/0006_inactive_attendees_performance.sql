-- Supports the retention dashboard's latest-attendance and per-person greeting lookups.
CREATE INDEX IF NOT EXISTS "idx_attendance_status_person_check_in"
  ON "event_attendance" USING btree ("status", "person_id", "check_in_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_interactions_person_occurred_at"
  ON "interactions" USING btree ("person_id", "occurred_at" DESC);
