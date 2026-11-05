import { sql } from 'drizzle-orm';
import type { getDb } from '../../db/client';

export interface BroadcastOverviewCount {
  source: 'event' | 'rutin'; targetId: string; title: string; speaker: string | null;
  startAt: Date | string; locationName: string | null;
  reminderTotal: number; h8Pending: number; h1Pending: number;
  postTotal: number; postPending: number;
}

/** One bounded aggregate instead of fetching recipients repeatedly for every event. */
export async function loadBroadcastOverview(db: Pick<ReturnType<typeof getDb>, 'execute'>, now: number, days: number): Promise<BroadcastOverviewCount[]> {
  const horizon = new Date(now + days * 86_400_000);
  const result = await db.execute(sql`
    WITH event_targets AS (
      SELECT id AS target_id, title, speaker, start_at, location_name FROM events
      WHERE status IN ('scheduled', 'ongoing') AND start_at >= ${new Date(now - 24 * 3_600_000)} AND start_at <= ${horizon}
      ORDER BY start_at LIMIT 20
    ), rutin_targets AS (
      SELECT s.id AS target_id, s.series_id, r.title, coalesce(s.speaker,r.speaker) AS speaker,
        s.start_at, coalesce(s.location_name,r.location_name) AS location_name
      FROM kajian_rutin_sessions s JOIN kajian_rutin_series r ON r.id=s.series_id
      WHERE s.status='scheduled' AND r.is_active AND s.start_at >= ${new Date(now - 12 * 3_600_000)} AND s.start_at <= ${horizon}
      ORDER BY s.start_at LIMIT 20
    ), targets AS (
      SELECT 'event' AS source, target_id, title, speaker, start_at, location_name FROM event_targets
      UNION ALL SELECT 'rutin', target_id, title, speaker, start_at, location_name FROM rutin_targets
    ), event_contacts AS (
      SELECT t.target_id, lower(btrim(coalesce(nullif(p.email,''),a.registration_data->>'email',''))) AS email,
        a.status='attended' AS is_post
      FROM event_targets t JOIN event_attendance a ON a.event_id=t.target_id LEFT JOIN persons p ON p.id=a.person_id
    ), event_recipients AS (
      SELECT 'event' AS source, target_id, email, bool_or(is_post) AS is_post FROM event_contacts
      WHERE position('@' in email)>0 GROUP BY target_id,email
    ), rutin_recipients AS (
      SELECT 'rutin' AS source, t.target_id, lower(btrim(a.email)) AS email, bool_or(a.session_id=t.target_id) AS is_post
      FROM rutin_targets t JOIN kajian_rutin_attendance a ON a.series_id=t.series_id
      WHERE position('@' in btrim(a.email))>0 GROUP BY t.target_id,lower(btrim(a.email))
    ), recipients AS (
      SELECT * FROM event_recipients UNION ALL SELECT * FROM rutin_recipients
    ), sent AS (
      SELECT l.source,l.target_id,lower(btrim(l.recipient_email)) AS email,
        bool_or(l.target_type='reminder' AND l.stage='h8') AS h8,
        bool_or(l.target_type='reminder' AND l.stage='h1') AS h1,
        bool_or(l.target_type='post' AND l.stage='post') AS post
      FROM kajian_email_broadcast_log l JOIN targets t ON t.source=l.source AND t.target_id=l.target_id
      WHERE l.status='sent' GROUP BY l.source,l.target_id,lower(btrim(l.recipient_email))
    )
    SELECT t.source,t.target_id AS "targetId",t.title,t.speaker,t.start_at AS "startAt",t.location_name AS "locationName",
      count(r.email)::int AS "reminderTotal",
      count(r.email) FILTER(WHERE NOT coalesce(s.h8,false))::int AS "h8Pending",
      count(r.email) FILTER(WHERE NOT coalesce(s.h1,false))::int AS "h1Pending",
      count(r.email) FILTER(WHERE r.is_post)::int AS "postTotal",
      count(r.email) FILTER(WHERE r.is_post AND NOT coalesce(s.post,false))::int AS "postPending"
    FROM targets t LEFT JOIN recipients r ON r.source=t.source AND r.target_id=t.target_id
    LEFT JOIN sent s ON s.source=r.source AND s.target_id=r.target_id AND s.email=r.email
    GROUP BY t.source,t.target_id,t.title,t.speaker,t.start_at,t.location_name ORDER BY t.start_at
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows || [];
  return rows as BroadcastOverviewCount[];
}

export function overviewDeliveryState(total: number, pending: number, now: number, dueAt: number, startAt?: number): 'sent' | 'due' | 'closed' | 'not_due' {
  if (total > 0 && pending === 0) return 'sent';
  if (startAt !== undefined && now >= startAt) return 'closed';
  return now >= dueAt ? 'due' : 'not_due';
}
