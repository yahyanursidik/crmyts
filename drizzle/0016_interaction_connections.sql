ALTER TABLE interactions ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_interactions_event ON interactions(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related ON tasks(related_type,related_id);
