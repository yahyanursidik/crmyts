ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS response_recorded_at timestamptz;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS reply_channel text;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS submission_key uuid;
ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS submission_digest text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_jamaah_room_submission ON jamaah_room_entries(submission_key);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_person ON jamaah_room_entries(person_id);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_owner ON jamaah_room_entries(owner_user_id);
CREATE TABLE IF NOT EXISTS jamaah_room_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_id uuid NOT NULL REFERENCES jamaah_room_entries(id) ON DELETE CASCADE,
 actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
 action text NOT NULL, content text, details jsonb,
 interaction_id uuid REFERENCES interactions(id) ON DELETE SET NULL,
 task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_activity_entry ON jamaah_room_activity(entry_id,created_at);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_activity_interaction ON jamaah_room_activity(interaction_id);
