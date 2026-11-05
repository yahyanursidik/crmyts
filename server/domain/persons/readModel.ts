import { sql, type SQL } from 'drizzle-orm';
import type { getDb } from '../../db/client';

function canonicalPhone(value: SQL) {
  const digits = sql`regexp_replace(coalesce(${value},''),'[^0-9]','','g')`;
  return sql`CASE WHEN coalesce(${value},'') ~ '[a-zA-Z]' THEN NULL WHEN ${digits} LIKE '08%' THEN '62'||substring(${digits} FROM 2) WHEN ${digits} LIKE '8%' THEN '62'||${digits} ELSE nullif(${digits},'') END`;
}
export function routineContactMatch(
  email: SQL,
  phone: SQL,
  attendanceEmail = sql`a.email`,
  attendancePhone = sql`a.phone`,
) {
  return sql`((nullif(btrim(${email}),'') IS NOT NULL AND lower(btrim(${email}))=lower(btrim(${attendanceEmail}))) OR (${canonicalPhone(phone)}=${canonicalPhone(attendancePhone)}))`;
}

/** A presence is one event/session, never merely a registration or an excused absence. */
export function attendedActivityRows(ids?: string[]) {
  const scope = ids
    ? sql`p.id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`,`,
      )})`
    : sql`true`;
  return sql`
    SELECT p.id AS person_id,e.id AS activity_id,'event' AS source,e.title,e.start_at,NULL::uuid AS series_id
    FROM persons p JOIN event_attendance a ON a.person_id=p.id JOIN events e ON e.id=a.event_id
    WHERE a.status='attended' AND ${scope}
    UNION
    SELECT p.id,s.id,'routine',r.title,s.start_at,r.id
    FROM persons p JOIN kajian_rutin_attendance a ON ${routineContactMatch(sql`p.email`, sql`p.phone_e164`)}
    JOIN kajian_rutin_sessions s ON s.id=a.session_id JOIN kajian_rutin_series r ON r.id=a.series_id
    WHERE a.status='present' AND ${scope}
  `;
}

export interface AttendanceSummary {
  personId: string;
  count: number;
  eventId: string;
  source: string;
  eventTitle: string;
  startAt: Date | string;
  seriesId: string | null;
}
export async function loadAttendanceSummary(
  db: Pick<ReturnType<typeof getDb>, 'execute'>,
  ids: string[],
) {
  if (!ids.length) return new Map<string, AttendanceSummary>();
  const result = await db.execute(sql`
    WITH activity AS (${attendedActivityRows(ids)}),
      totals AS (SELECT person_id,count(*)::int AS count FROM activity GROUP BY person_id),
      latest AS (SELECT DISTINCT ON (person_id) * FROM activity ORDER BY person_id,start_at DESC,activity_id)
    SELECT t.person_id AS "personId",t.count,l.activity_id AS "eventId",l.source,l.title AS "eventTitle",l.start_at AS "startAt",l.series_id AS "seriesId"
    FROM totals t JOIN latest l ON l.person_id=t.person_id
  `);
  const rows = (
    Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows || []
  ) as AttendanceSummary[];
  return new Map(rows.map((row) => [row.personId, row]));
}
