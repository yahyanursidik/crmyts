CREATE TABLE IF NOT EXISTS jamaah_room_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  wants_reply boolean NOT NULL DEFAULT false,
  publication_consent boolean NOT NULL DEFAULT false,
  anonymous_publication boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'new',
  internal_note text,
  response text,
  public_title text,
  public_text text,
  published_at timestamptz,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_created ON jamaah_room_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_status ON jamaah_room_entries (status);
CREATE INDEX IF NOT EXISTS idx_jamaah_room_published ON jamaah_room_entries (published_at);
CREATE TABLE IF NOT EXISTS jamaah_room_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
