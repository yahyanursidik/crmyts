import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgDialect } from 'drizzle-orm/pg-core';
import { prepareEnvironment, saveReport } from './access-runtime';
import { loadBroadcastOverview } from '../server/domain/automation/kajianBroadcastOverview';

if (process.argv[process.argv.indexOf('--environment') + 1] !== 'staging') throw new Error('Verifikasi fixture broadcast khusus staging.');
const pool = prepareEnvironment('staging');
const client = await pool.connect();
const dialect = new PgDialect();
const adapter = { execute: async (query: any) => { const compiled = dialect.sqlToQuery(query); return client.query(compiled.sql, compiled.params); } };
let passed = 0;
function check(condition: unknown, name: string) { assert.ok(condition, name); passed++; }
try {
  await client.query('BEGIN');
  const now = Date.now(); const started = performance.now();
  const before = await loadBroadcastOverview(adapter as any, now, 10);
  const elapsed = performance.now() - started;
  check(before.length <= 40, 'Bounded target count');
  check(elapsed < 10000, 'Overview aggregate completes within 10 seconds');
  check(!/recipient_email|registrationData|fullName/.test(JSON.stringify(before)), 'No recipient contacts in overview');
  const participant = (await client.query(`SELECT a.event_id,lower(btrim(coalesce(nullif(p.email,''),a.registration_data->>'email',''))) AS email
    FROM event_attendance a JOIN events e ON e.id=a.event_id LEFT JOIN persons p ON p.id=a.person_id
    WHERE e.title LIKE 'UAT YTS %' AND e.status='scheduled' AND e.start_at>now() AND e.start_at<now()+interval '10 days'
    AND position('@' in coalesce(p.email,a.registration_data->>'email',''))>0
    AND NOT EXISTS (SELECT 1 FROM kajian_email_broadcast_log l WHERE l.source='event' AND l.target_id=e.id AND lower(btrim(l.recipient_email))=lower(btrim(coalesce(p.email,a.registration_data->>'email',''))) AND l.stage IN ('h8','h1') AND l.status='sent')
    LIMIT 1`)).rows[0];
  check(Boolean(participant), 'Isolated UAT recipient available');
  const previous = before.find((row) => row.source === 'event' && row.targetId === participant.event_id)!;
  check(Boolean(previous), 'UAT event included in horizon');
  for (let index = 0; index < 2; index++) await client.query(`INSERT INTO kajian_email_broadcast_log(source,target_id,target_type,stage,batch_id,recipient_email,status) VALUES('event',$1,'reminder','h8',$2,$3,'sent')`, [participant.event_id, `rollback-uat-${randomUUID()}`, index ? participant.email.toUpperCase() : participant.email]);
  const after = (await loadBroadcastOverview(adapter as any, now, 10)).find((row) => row.source === 'event' && row.targetId === participant.event_id)!;
  check(after.reminderTotal === previous.reminderTotal, 'Delivery logs do not duplicate recipients');
  check(after.h8Pending === previous.h8Pending - 1, 'H-8 delivery counted once despite duplicate log/case variants');
  check(after.h1Pending === previous.h1Pending, 'H-1 remains independent from H-8');
  check(after.postPending === previous.postPending, 'Post attendance stage remains independent');
  await client.query('ROLLBACK');
  const restored = (await loadBroadcastOverview(adapter as any, now, 10)).find((row) => row.source === 'event' && row.targetId === participant.event_id)!;
  check(restored.h8Pending === previous.h8Pending, 'Synthetic log rows rolled back');
  const report = { checkedAt: new Date().toISOString(), environment: 'staging', passed, failed: 0, aggregateMilliseconds: Math.round(elapsed), syntheticRowsRolledBack: true, messagesSent: 0 };
  saveReport('staging-broadcast-overview-verification.json', report); console.log(JSON.stringify(report));
} finally {
  await client.query('ROLLBACK').catch(() => {}); client.release(); await pool.end();
}
