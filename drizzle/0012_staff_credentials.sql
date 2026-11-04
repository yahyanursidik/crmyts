-- Additive migration. Existing profiles and role assignments are preserved.
-- Apply on an isolated branch first; provision the first password with auth:bootstrap.
CREATE TABLE IF NOT EXISTS "app_user_credentials" (
  "user_id" uuid PRIMARY KEY REFERENCES "app_users"("id") ON DELETE CASCADE,
  "password_hash" text NOT NULL,
  "session_version" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "foundation_settings" (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
