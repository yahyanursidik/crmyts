CREATE TABLE IF NOT EXISTS event_registration_phone_claims (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  attendance_id uuid NOT NULL UNIQUE REFERENCES event_attendance(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, phone_e164)
);
--> statement-breakpoint
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
    SELECT attendance_id INTO claimed_attendance FROM event_registration_phone_claims
    WHERE event_id = NEW.event_id AND phone_e164 = candidate_phone;
    IF claimed_attendance IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_PHONE_ALREADY_REGISTERED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_guard_event_registration_phone ON event_attendance;
CREATE TRIGGER trg_guard_event_registration_phone
AFTER INSERT OR UPDATE OF event_id, person_id ON event_attendance
FOR EACH ROW EXECUTE FUNCTION guard_event_registration_phone();
--> statement-breakpoint
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
      SELECT attendance_id INTO claimed_attendance FROM event_registration_phone_claims
      WHERE event_id = attendance_row.event_id AND phone_e164 = NEW.phone_e164;
      IF claimed_attendance IS DISTINCT FROM attendance_row.id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_PHONE_ALREADY_REGISTERED';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_sync_event_registration_phone_claims ON persons;
CREATE TRIGGER trg_sync_event_registration_phone_claims
AFTER UPDATE OF phone_e164 ON persons
FOR EACH ROW EXECUTE FUNCTION sync_event_registration_phone_claims();
--> statement-breakpoint
INSERT INTO event_registration_phone_claims (event_id, phone_e164, attendance_id)
SELECT DISTINCT ON (attendance.event_id, person.phone_e164)
  attendance.event_id, person.phone_e164, attendance.id
FROM event_attendance attendance
INNER JOIN persons person ON person.id = attendance.person_id
WHERE person.phone_e164 ~ '^[+][1-9][0-9]{7,14}$'
ORDER BY attendance.event_id, person.phone_e164, attendance.check_in_at ASC, attendance.id ASC
ON CONFLICT (event_id, phone_e164) DO NOTHING;
