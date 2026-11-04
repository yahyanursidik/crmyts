-- Preserve every existing value; future registrations do not imply attendance.
ALTER TABLE event_attendance ALTER COLUMN check_in_at DROP NOT NULL;
ALTER TABLE event_attendance ALTER COLUMN check_in_at DROP DEFAULT;
