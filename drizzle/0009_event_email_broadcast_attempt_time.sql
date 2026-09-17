ALTER TABLE event_email_broadcast_recipients
ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;
