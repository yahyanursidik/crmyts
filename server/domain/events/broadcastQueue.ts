import { createHash, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { eventAttendance } from '../../db/schema';
import { getBroadcastDailyQuota, reserveBroadcastEmailSlot } from '../../email/broadcastQuota';
import { sendEventAnnouncementEmail } from '../../email/service';
import { formatEventDateTimeWib, type EventEmailEvent } from './emailNotifications';

const MAX_BATCH_SIZE = 100;

type Attendance = {
  id: string;
  ticketCode?: string | null;
  registrationData?: Record<string, any> | null;
  person?: { id?: string; email?: string | null; fullName?: string | null } | null;
};

type DbRow = Record<string, any>;

function rows(result: unknown): DbRow[] {
  if (Array.isArray(result)) return result as DbRow[];
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray((result as any).rows)) return (result as any).rows;
  return [];
}

function count(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export type EventBroadcastTemplate = { id: string; name: string; subject: string; message: string; updatedAt: string };
export type QueuedEventBroadcastSummary = {
  id: string;
  subject: string;
  createdAt: string;
  status: 'queued' | 'running' | 'completed' | 'paused' | 'cancelled';
  intendedRecipients: number;
  attemptedCount: number;
  unattemptedCount: number;
  providerAcceptedCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  failedCount: number;
  noNegativeSignalCount: number;
  duplicateSkippedCount: number;
  batchSize: number;
};

export async function ensureEventBroadcastQueueTables(db: any): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_email_templates (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      subject text NOT NULL,
      message text NOT NULL,
      created_by uuid REFERENCES app_users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_email_broadcast_campaigns (
      id uuid PRIMARY KEY,
      event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      template_id uuid REFERENCES event_email_templates(id) ON DELETE SET NULL,
      content_key text NOT NULL,
      subject text NOT NULL,
      message text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      batch_size integer NOT NULL DEFAULT 100,
      target_count integer NOT NULL DEFAULT 0,
      duplicate_skipped_count integer NOT NULL DEFAULT 0,
      created_by uuid REFERENCES app_users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      last_dispatched_at timestamptz,
      completed_at timestamptz
    )`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS event_email_broadcast_recipients (
      id uuid PRIMARY KEY,
      campaign_id uuid NOT NULL REFERENCES event_email_broadcast_campaigns(id) ON DELETE CASCADE,
      attendance_id uuid NOT NULL REFERENCES event_attendance(id) ON DELETE CASCADE,
      email text NOT NULL,
      recipient_name text NOT NULL,
      ticket_code text,
      message_id text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      attempts integer NOT NULL DEFAULT 0,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      processing_started_at timestamptz,
      sent_at timestamptz,
      opened_at timestamptz,
      clicked_at timestamptz,
      bounced_at timestamptz,
      unsubscribed_at timestamptz,
      UNIQUE(campaign_id, email)
    )`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_event_email_campaign_event_created ON event_email_broadcast_campaigns(event_id, created_at DESC)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_event_email_recipient_pending ON event_email_broadcast_recipients(campaign_id, status, created_at)`));
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_event_email_recipient_message_id ON event_email_broadcast_recipients(message_id)`));
}

function recentlySentSameContent(attendance: Attendance, key: string): boolean {
  const history = attendance.registrationData?.emailNotifications?.broadcastHistory;
  if (!Array.isArray(history)) return false;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.some((item: any) => item?.key === key && new Date(item.sentAt || item.createdAt || 0).getTime() >= cutoff);
}

export async function listEventEmailTemplates(db: any): Promise<EventBroadcastTemplate[]> {
  await ensureEventBroadcastQueueTables(db);
  const result = await db.execute(sql`SELECT id, name, subject, message, updated_at FROM event_email_templates ORDER BY updated_at DESC LIMIT 50`);
  return rows(result).map((row) => ({ id: row.id, name: row.name, subject: row.subject, message: row.message, updatedAt: new Date(row.updated_at).toISOString() }));
}

export async function saveEventEmailTemplate(db: any, input: { name: string; subject: string; message: string; createdBy?: string }): Promise<EventBroadcastTemplate> {
  await ensureEventBroadcastQueueTables(db);
  const id = randomUUID();
  const result = await db.execute(sql`
    INSERT INTO event_email_templates (id, name, subject, message, created_by)
    VALUES (${id}::uuid, ${input.name}, ${input.subject}, ${input.message}, ${input.createdBy || null}::uuid)
    RETURNING id, name, subject, message, updated_at
  `);
  const row = rows(result)[0];
  return { id: row.id, name: row.name, subject: row.subject, message: row.message, updatedAt: new Date(row.updated_at).toISOString() };
}

export async function createQueuedEventBroadcast(
  db: any,
  event: EventEmailEvent,
  input: { subject: string; message: string; batchSize?: number; templateId?: string; createdBy?: string }
): Promise<{ campaignId: string; targetCount: number; duplicateSkippedCount: number; skippedNoEmail: number; batchSize: number }> {
  await ensureEventBroadcastQueueTables(db);
  const attendances: Attendance[] = await db.query.eventAttendance.findMany({ where: eq(eventAttendance.eventId, event.id), with: { person: true } });
  const contentKey = createHash('sha256').update(`${event.id}\n${input.subject}\n${input.message}`).digest('hex');
  const recentRows = rows(await db.execute(sql`
    SELECT lower(recipients.email) AS email
    FROM event_email_broadcast_recipients recipients
    INNER JOIN event_email_broadcast_campaigns campaigns ON campaigns.id = recipients.campaign_id
    WHERE campaigns.event_id = ${event.id}::uuid
      AND campaigns.content_key = ${contentKey}
      AND campaigns.created_at >= now() - interval '24 hours'
      AND recipients.status IN ('queued', 'processing', 'sent', 'bounced', 'unsubscribed')
  `));
  const recentlyQueuedEmails = new Set(recentRows.map((row) => String(row.email || '').toLowerCase()).filter(Boolean));
  const eligible = new Map<string, Attendance>();
  let skippedNoEmail = 0;
  let duplicateSkippedCount = 0;
  for (const attendance of attendances) {
    const email = attendance.person?.email?.trim().toLowerCase();
    if (!email) { skippedNoEmail++; continue; }
    if (eligible.has(email)) { duplicateSkippedCount++; continue; }
    if (recentlyQueuedEmails.has(email)) { duplicateSkippedCount++; continue; }
    if (recentlySentSameContent(attendance, contentKey)) { duplicateSkippedCount++; continue; }
    eligible.set(email, attendance);
  }

  const campaignId = randomUUID();
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(25, Math.trunc(input.batchSize || MAX_BATCH_SIZE)));
  await db.execute(sql`
    INSERT INTO event_email_broadcast_campaigns (id, event_id, template_id, content_key, subject, message, batch_size, target_count, duplicate_skipped_count, created_by)
    VALUES (${campaignId}::uuid, ${event.id}::uuid, ${input.templateId || null}::uuid, ${contentKey}, ${input.subject}, ${input.message}, ${batchSize}, ${eligible.size}, ${duplicateSkippedCount}, ${input.createdBy || null}::uuid)
  `);
  const values = [...eligible.entries()].map(([email, attendance]) => sql`(
    ${randomUUID()}::uuid, ${campaignId}::uuid, ${attendance.id}::uuid, ${email}, ${attendance.person?.fullName || 'Jamaah YTS'}, ${attendance.ticketCode || null}, ${`yts-${randomUUID()}`}
  )`);
  if (values.length) {
    await db.execute(sql`
      INSERT INTO event_email_broadcast_recipients (id, campaign_id, attendance_id, email, recipient_name, ticket_code, message_id)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (campaign_id, email) DO NOTHING
    `);
  }
  return { campaignId, targetCount: eligible.size, duplicateSkippedCount, skippedNoEmail, batchSize };
}

async function claimBatch(db: any, campaignId: string, limit: number): Promise<DbRow[]> {
  // Recover an interrupted serverless invocation only after its send window has elapsed.
  await db.execute(sql`
    UPDATE event_email_broadcast_recipients SET status = 'queued', processing_started_at = NULL
    WHERE campaign_id = ${campaignId}::uuid AND status = 'processing' AND processing_started_at < now() - interval '20 minutes'
  `);
  const result = await db.execute(sql`
    WITH selected AS (
      SELECT id FROM event_email_broadcast_recipients
      WHERE campaign_id = ${campaignId}::uuid AND status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE event_email_broadcast_recipients recipients
    SET status = 'processing', attempts = attempts + 1, processing_started_at = now()
    FROM selected WHERE recipients.id = selected.id
    RETURNING recipients.*
  `);
  return rows(result);
}

export async function processQueuedEventBroadcast(db: any, event: EventEmailEvent, campaignId: string): Promise<{ processed: number; sent: number; failed: number; quotaReached: boolean; remainingToday: number }> {
  await ensureEventBroadcastQueueTables(db);
  const campaignRows = rows(await db.execute(sql`SELECT * FROM event_email_broadcast_campaigns WHERE id = ${campaignId}::uuid AND event_id = ${event.id}::uuid LIMIT 1`));
  const campaign = campaignRows[0];
  if (!campaign || ['paused', 'cancelled', 'completed'].includes(campaign.status)) return { processed: 0, sent: 0, failed: 0, quotaReached: false, remainingToday: (await getBroadcastDailyQuota(db)).remainingToday };
  const claimed = await claimBatch(db, campaignId, Math.min(MAX_BATCH_SIZE, count(campaign.batch_size) || MAX_BATCH_SIZE));
  if (!claimed.length) {
    await db.execute(sql`UPDATE event_email_broadcast_campaigns SET status = 'completed', completed_at = COALESCE(completed_at, now()) WHERE id = ${campaignId}::uuid AND status NOT IN ('paused', 'cancelled')`);
    return { processed: 0, sent: 0, failed: 0, quotaReached: false, remainingToday: (await getBroadcastDailyQuota(db)).remainingToday };
  }

  let sent = 0;
  let failed = 0;
  let quotaReached = false;
  let quota = await getBroadcastDailyQuota(db);
  for (let index = 0; index < claimed.length; index += 10) {
    const group = claimed.slice(index, index + 10);
    await Promise.all(group.map(async (recipient) => {
      const reserved = await reserveBroadcastEmailSlot(db);
      if (!reserved) {
        quotaReached = true;
        await db.execute(sql`UPDATE event_email_broadcast_recipients SET status = 'queued', processing_started_at = NULL WHERE id = ${recipient.id}::uuid AND status = 'processing'`);
        return;
      }
      quota = reserved;
      const delivery = await sendEventAnnouncementEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.recipient_name,
        subject: campaign.subject,
        message: campaign.message,
        eventTitle: event.title,
        speaker: event.speaker,
        startAtFormatted: formatEventDateTimeWib(event.startAt),
        locationName: event.locationName || 'Masjid Tarbiyah Sunnah',
        ticketCode: recipient.ticket_code || '-',
        messageId: recipient.message_id,
      });
      if (delivery.success) {
        sent++;
        await db.execute(sql`UPDATE event_email_broadcast_recipients SET status = 'sent', message_id = ${delivery.messageId || recipient.message_id}, sent_at = now(), processing_started_at = NULL WHERE id = ${recipient.id}::uuid`);
      } else {
        failed++;
        await db.execute(sql`UPDATE event_email_broadcast_recipients SET status = 'failed', error = ${String(delivery.error || 'Pengiriman gagal').slice(0, 300)}, processing_started_at = NULL WHERE id = ${recipient.id}::uuid`);
      }
    }));
  }
  await db.execute(sql`UPDATE event_email_broadcast_campaigns SET status = 'running', started_at = COALESCE(started_at, now()), last_dispatched_at = now() WHERE id = ${campaignId}::uuid`);
  return { processed: sent + failed, sent, failed, quotaReached, remainingToday: quota.remainingToday };
}

export async function listQueuedEventBroadcasts(db: any, eventId: string): Promise<QueuedEventBroadcastSummary[]> {
  await ensureEventBroadcastQueueTables(db);
  const result = await db.execute(sql`
    SELECT c.id, c.subject, c.created_at, c.status, c.target_count, c.duplicate_skipped_count, c.batch_size,
      count(r.id) FILTER (WHERE r.status <> 'queued')::int AS attempted_count,
      count(r.id) FILTER (WHERE r.status = 'queued')::int AS unattempted_count,
      count(r.id) FILTER (WHERE r.status = 'sent')::int AS provider_accepted_count,
      count(r.id) FILTER (WHERE r.opened_at IS NOT NULL)::int AS opened_count,
      count(r.id) FILTER (WHERE r.clicked_at IS NOT NULL)::int AS clicked_count,
      count(r.id) FILTER (WHERE r.status = 'bounced')::int AS bounced_count,
      count(r.id) FILTER (WHERE r.status = 'unsubscribed')::int AS unsubscribed_count,
      count(r.id) FILTER (WHERE r.status IN ('failed', 'bounced'))::int AS failed_count
    FROM event_email_broadcast_campaigns c
    LEFT JOIN event_email_broadcast_recipients r ON r.campaign_id = c.id
    WHERE c.event_id = ${eventId}::uuid
    GROUP BY c.id ORDER BY c.created_at DESC LIMIT 10
  `);
  return rows(result).map((row) => {
    const accepted = count(row.provider_accepted_count);
    const bounced = count(row.bounced_count);
    const unsubscribed = count(row.unsubscribed_count);
    return {
      id: row.id, subject: row.subject, createdAt: new Date(row.created_at).toISOString(), status: row.status,
      intendedRecipients: count(row.target_count), attemptedCount: count(row.attempted_count), unattemptedCount: count(row.unattempted_count),
      providerAcceptedCount: accepted, openedCount: count(row.opened_count), clickedCount: count(row.clicked_count), bouncedCount: bounced,
      unsubscribedCount: unsubscribed, failedCount: count(row.failed_count), noNegativeSignalCount: Math.max(0, accepted - bounced - unsubscribed),
      duplicateSkippedCount: count(row.duplicate_skipped_count), batchSize: count(row.batch_size),
    } as QueuedEventBroadcastSummary;
  });
}

export async function processPendingEventBroadcasts(db: any): Promise<void> {
  await ensureEventBroadcastQueueTables(db);
  const campaigns = rows(await db.execute(sql`SELECT id, event_id FROM event_email_broadcast_campaigns WHERE status IN ('queued', 'running') ORDER BY created_at ASC LIMIT 12`));
  for (const campaign of campaigns) {
    const event = await db.query.events.findFirst({ where: sql`id = ${campaign.event_id}::uuid` });
    if (event) await processQueuedEventBroadcast(db, event, campaign.id);
    const quota = await getBroadcastDailyQuota(db);
    if (quota.remainingToday === 0) break;
  }
}

export async function recordQueuedBroadcastWebhook(db: any, payload: { type: 'emailopen' | 'emailclick' | 'bounce' | 'unsubscribe'; messageId: string; occurredAt?: string }): Promise<void> {
  await ensureEventBroadcastQueueTables(db);
  const when = payload.occurredAt || new Date().toISOString();
  if (payload.type === 'emailopen') await db.execute(sql`UPDATE event_email_broadcast_recipients SET opened_at = COALESCE(opened_at, ${when}::timestamptz) WHERE message_id = ${payload.messageId}`);
  if (payload.type === 'emailclick') await db.execute(sql`UPDATE event_email_broadcast_recipients SET opened_at = COALESCE(opened_at, ${when}::timestamptz), clicked_at = COALESCE(clicked_at, ${when}::timestamptz) WHERE message_id = ${payload.messageId}`);
  if (payload.type === 'bounce') await db.execute(sql`UPDATE event_email_broadcast_recipients SET status = 'bounced', bounced_at = COALESCE(bounced_at, ${when}::timestamptz) WHERE message_id = ${payload.messageId}`);
  if (payload.type === 'unsubscribe') await db.execute(sql`UPDATE event_email_broadcast_recipients SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, ${when}::timestamptz) WHERE message_id = ${payload.messageId}`);
}
