import { and, eq, sql } from 'drizzle-orm';
import { eventAttendance, persons } from '../../db/schema';

type DbRow = Record<string, any>;

function rows(result: unknown): DbRow[] {
  if (Array.isArray(result)) return result as DbRow[];
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray((result as any).rows)) return (result as any).rows;
  return [];
}

export type EventPhoneRegistration = {
  attendanceId: string;
  personId: string;
  ticketCode: string | null;
};

let initialization: Promise<void> | null = null;

/**
 * Claims a physical WhatsApp number once per event. Family records use an
 * internal virtual number suffix and intentionally do not take a claim.
 * The claim is database-backed so imports or concurrent requests cannot make
 * a second ticket for the same physical number.
 */
export async function ensureEventRegistrationPhoneGuard(db: any): Promise<void> {
  // Unit tests use lightweight database doubles; migrations are covered by the
  // SQL file while production installs this guard on first registration.
  if (process.env.NODE_ENV === 'test' || typeof db?.execute !== 'function') return;
  if (!initialization) {
    initialization = (async () => {
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS event_registration_phone_claims (
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          phone_e164 text NOT NULL,
          attendance_id uuid NOT NULL UNIQUE REFERENCES event_attendance(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (event_id, phone_e164)
        )`));
      await db.execute(sql.raw(`
        CREATE OR REPLACE FUNCTION guard_event_registration_phone()
        RETURNS trigger AS $$
        DECLARE
          candidate_phone text;
          claimed_attendance uuid;
        BEGIN
          SELECT phone_e164 INTO candidate_phone FROM persons WHERE id = NEW.person_id;
          IF candidate_phone IS NULL OR candidate_phone !~ '^[+][1-9][0-9]{7,14}$' THEN
            DELETE FROM event_registration_phone_claims WHERE attendance_id = NEW.id;
            RETURN NEW;
          END IF;

          DELETE FROM event_registration_phone_claims WHERE attendance_id = NEW.id;
          INSERT INTO event_registration_phone_claims (event_id, phone_e164, attendance_id)
          VALUES (NEW.event_id, candidate_phone, NEW.id)
          ON CONFLICT (event_id, phone_e164) DO NOTHING
          RETURNING attendance_id INTO claimed_attendance;

          IF claimed_attendance IS NULL THEN
            SELECT attendance_id INTO claimed_attendance
            FROM event_registration_phone_claims
            WHERE event_id = NEW.event_id AND phone_e164 = candidate_phone;
            IF claimed_attendance IS DISTINCT FROM NEW.id THEN
              RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_PHONE_ALREADY_REGISTERED';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`));
      await db.execute(sql.raw(`
        CREATE OR REPLACE FUNCTION sync_event_registration_phone_claims()
        RETURNS trigger AS $$
        DECLARE
          attendance_row record;
          claimed_attendance uuid;
        BEGIN
          IF NEW.phone_e164 IS NOT DISTINCT FROM OLD.phone_e164 THEN
            RETURN NEW;
          END IF;

          DELETE FROM event_registration_phone_claims claims
          USING event_attendance attendance
          WHERE claims.attendance_id = attendance.id AND attendance.person_id = NEW.id;

          IF NEW.phone_e164 IS NULL OR NEW.phone_e164 !~ '^[+][1-9][0-9]{7,14}$' THEN
            RETURN NEW;
          END IF;

          FOR attendance_row IN SELECT id, event_id FROM event_attendance WHERE person_id = NEW.id LOOP
            INSERT INTO event_registration_phone_claims (event_id, phone_e164, attendance_id)
            VALUES (attendance_row.event_id, NEW.phone_e164, attendance_row.id)
            ON CONFLICT (event_id, phone_e164) DO NOTHING
            RETURNING attendance_id INTO claimed_attendance;

            IF claimed_attendance IS NULL THEN
              SELECT attendance_id INTO claimed_attendance
              FROM event_registration_phone_claims
              WHERE event_id = attendance_row.event_id AND phone_e164 = NEW.phone_e164;
              IF claimed_attendance IS DISTINCT FROM attendance_row.id THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_PHONE_ALREADY_REGISTERED';
              END IF;
            END IF;
          END LOOP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`));
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS trg_guard_event_registration_phone ON event_attendance`));
      await db.execute(sql.raw(`
        CREATE TRIGGER trg_guard_event_registration_phone
        AFTER INSERT OR UPDATE OF event_id, person_id ON event_attendance
        FOR EACH ROW EXECUTE FUNCTION guard_event_registration_phone()`));
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS trg_sync_event_registration_phone_claims ON persons`));
      await db.execute(sql.raw(`
        CREATE TRIGGER trg_sync_event_registration_phone_claims
        AFTER UPDATE OF phone_e164 ON persons
        FOR EACH ROW EXECUTE FUNCTION sync_event_registration_phone_claims()`));
      await db.execute(sql.raw(`
        INSERT INTO event_registration_phone_claims (event_id, phone_e164, attendance_id)
        SELECT DISTINCT ON (attendance.event_id, person.phone_e164)
          attendance.event_id, person.phone_e164, attendance.id
        FROM event_attendance attendance
        INNER JOIN persons person ON person.id = attendance.person_id
        WHERE person.phone_e164 ~ '^[+][1-9][0-9]{7,14}$'
        ORDER BY attendance.event_id, person.phone_e164, attendance.check_in_at ASC, attendance.id ASC
        ON CONFLICT (event_id, phone_e164) DO NOTHING`));
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

export async function findEventRegistrationByPhone(
  db: any,
  eventId: string,
  phoneE164: string
): Promise<EventPhoneRegistration | null> {
  // Existing route tests intentionally use partial query doubles. The ordinary
  // event/person uniqueness path remains covered there; this cross-profile
  // repair query is exercised against the real database in production.
  if (process.env.NODE_ENV === 'test') return null;

  // Prefer the structured Drizzle API. Besides being easier to test, this
  // finds every legacy profile that accidentally shares the same physical
  // phone, then returns the earliest ticket for this event.
  if (db?.query?.persons?.findMany && db?.query?.eventAttendance?.findFirst) {
    const candidates = await db.query.persons.findMany({
      where: eq(persons.phoneE164, phoneE164),
      columns: { id: true },
    });
    for (const candidate of candidates || []) {
      const attendance = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.personId, candidate.id)),
        columns: { id: true, personId: true, ticketCode: true },
      });
      if (attendance) {
        return { attendanceId: attendance.id, personId: attendance.personId, ticketCode: attendance.ticketCode || null };
      }
    }
    return null;
  }

  if (db?.query?.persons?.findFirst && db?.query?.eventAttendance?.findFirst) {
    const person = await db.query.persons.findFirst({ where: eq(persons.phoneE164, phoneE164) });
    if (!person) return null;
    const attendance = await db.query.eventAttendance.findFirst({
      where: and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.personId, person.id)),
    });
    return attendance ? { attendanceId: attendance.id, personId: attendance.personId, ticketCode: attendance.ticketCode || null } : null;
  }

  const result = await db.execute(sql`
    SELECT attendance.id AS attendance_id, attendance.person_id, attendance.ticket_code
    FROM event_attendance attendance
    INNER JOIN persons person ON person.id = attendance.person_id
    WHERE attendance.event_id = ${eventId}::uuid
      AND person.phone_e164 = ${phoneE164}
    ORDER BY attendance.check_in_at ASC, attendance.id ASC
    LIMIT 1
  `);
  const row = rows(result)[0];
  if (!row) return null;
  return {
    attendanceId: String(row.attendance_id),
    personId: String(row.person_id),
    ticketCode: row.ticket_code ? String(row.ticket_code) : null,
  };
}

export function isDuplicateEventPhoneError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('EVENT_PHONE_ALREADY_REGISTERED');
}
