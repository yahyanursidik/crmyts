-- Additive: preserve every historical attendance/contact and leave uncertain links empty.
ALTER TABLE kajian_rutin_attendance ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_session_person ON kajian_rutin_attendance(session_id, person_id);
CREATE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_person ON kajian_rutin_attendance(person_id);
