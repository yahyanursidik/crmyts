import { getDb } from "../../db/client";
import { sql } from "drizzle-orm";
let setupPromise: Promise<void> | null = null;
export async function ensureRoomTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      const db = getDb();
      await db.execute(
        sql.raw(`CREATE TABLE IF NOT EXISTS jamaah_room_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL,
        event_id uuid REFERENCES events(id) ON DELETE SET NULL, name text, email text, phone text,
        subject text NOT NULL, message text NOT NULL, wants_reply boolean NOT NULL DEFAULT false,
        publication_consent boolean NOT NULL DEFAULT false, anonymous_publication boolean NOT NULL DEFAULT true,
        status text NOT NULL DEFAULT 'new', internal_note text, response text,
        public_title text, public_text text, published_at timestamptz,
        updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`),
      );
      await db.execute(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS idx_jamaah_room_created ON jamaah_room_entries (created_at)",
        ),
      );
      await db.execute(
        sql.raw(
          "ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS public_title text",
        ),
      );
      await db.execute(
        sql.raw(
          "ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS public_text text",
        ),
      );
      await db.execute(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS idx_jamaah_room_status ON jamaah_room_entries (status)",
        ),
      );
      await db.execute(
        sql.raw(
          "CREATE INDEX IF NOT EXISTS idx_jamaah_room_published ON jamaah_room_entries (published_at)",
        ),
      );
      await db.execute(
        sql.raw(`CREATE TABLE IF NOT EXISTS jamaah_room_rate_limits (
        key text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL)`),
      );
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}
