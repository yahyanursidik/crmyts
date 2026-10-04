import crypto from 'node:crypto';
import { z } from 'zod';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';
import { getBroadcastDailyQuota, reserveBroadcastEmailSlot } from '../../email/broadcastQuota';
import { renderEmailLayout, sendEmail } from '../../email/service';
import { getDb } from '../../db/client';
import {
  events,
  eventAttendance,
  kajianRutinAttendance,
  kajianRutinSeries,
  kajianRutinSessions,
  persons,
} from '../../db/schema';
import { requirePermission, validateBody } from '../../http/middleware';
import { errorResponse, successResponse } from '../../http/response';
import { Router } from '../../http/router';
import { PERMISSIONS } from '../../permissions/constants';

/**
 * Broadcast email kajian terpadu: sumber /events (daurah) & /kajian-rutin.
 * Bertahap H-8 dan H-1 sebelum kajian, plus doa pasca-kehadiran; dikirim per
 * batch dengan ukuran paling aman mengikuti sisa kuota harian Mailketing.
 */

const TEMPLATE_KEYS = ['reminder', 'post'] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

interface KajianTemplate {
  key: TemplateKey;
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATES: Record<TemplateKey, KajianTemplate> = {
  reminder: {
    key: 'reminder',
    subject: 'Pengingat Kajian {{judul}} — {{tanggal}}, {{jam}} WIB',
    body: `Assalamu'alaikum warahmatullahi wabarakatuh, {{nama}},

Semoga Bapak/Ibu selalu dalam lindungan dan keberkahan Allah. Kami sampaikan pengingat jadwal majelis ilmu:

{{judul}}
Pemateri: {{pemateri}}
Waktu: {{tanggal}}, {{jam}} WIB
Lokasi: {{lokasi}}

Mari sempurnakan niat menuntut ilmu, hadir lebih awal, dan bawa keluarga bila memungkinkan. Sampai jumpa di majelis!

Barakallahu fiik,
Panitia Kajian Yayasan Tarbiyah Sunnah`,
  },
  post: {
    key: 'post',
    subject: 'Jazaakumullahu khairan — Terima kasih telah hadir di {{judul}}',
    body: `Assalamu'alaikum warahmatullahi wabarakatuh, {{nama}},

Alhamdulillah, Anda telah menghadiri kajian "{{judul}}" pada {{tanggal}}, {{jam}} WIB.

Jazaakumullahu khairan atas kehadiran dan waktunya. Semoga Allah bermanfaatkan setiap ilmu yang Anda peroleh, menjadikannya ilmu yang bermanfaat, menjaga istiqamah Anda, dan mempertemukan kita kembali di majelis-majelis ilmu. Aamiin yaa Rabbal 'aalamin.

Bila ada kekurangan penatauan majelis, kami memohon husnuzhan dan masukan yang membangun melalui Ruang Jamaah.

Wassalamu'alaikum warahmatullahi wabarakatuh,
Yayasan Tarbiyah Sunnah`,
  },
};

const SAMPLE_VARIABLES = {
  nama: 'Ahmad Fulan',
  judul: 'Kajian Ahad Pagi — Fiqih Ibadah',
  pemateri: 'Ust. Fulan bin Fulan',
  tanggal: 'Ahad, 12 Oktober 2026',
  jam: '07:00 – 09:00',
  lokasi: 'Masjid Tarbiyah Sunnah, Bandung',
};

const STAGE_OFFSETS: Record<string, number> = { h8: 8 * 60, h1: 1 * 60 };
const SAFE_BATCH_CEILING = 100;

let setupPromise: Promise<void> | null = null;
async function ensureBroadcastTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      const db = getDb();
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_email_broadcast_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source text NOT NULL,
        target_id uuid NOT NULL,
        target_type text NOT NULL,
        stage text NOT NULL,
        batch_id text NOT NULL,
        recipient_email text NOT NULL,
        recipient_name text,
        status text NOT NULL,
        error text,
        sent_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_email_log_target ON kajian_email_broadcast_log (source, target_id, target_type, stage)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_email_log_sent_at ON kajian_email_broadcast_log (sent_at)'));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_email_templates (
        key text PRIMARY KEY,
        subject text NOT NULL,
        body text NOT NULL,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now())`));
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBody(body: string, variables: Record<string, string>): string {
  let html = escapeHtml(body);
  for (const [key, value] of Object.entries(variables)) {
    html = html.split(`{{${key}}}`).join(escapeHtml(value));
  }
  const paragraphs = html
    .split(/\n{2,}/)
    .map((part) => `<p style="margin:0 0 14px;">${part.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return paragraphs;
}

function rowsFrom(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

async function loadTemplates(): Promise<Record<TemplateKey, KajianTemplate>> {
  await ensureBroadcastTables();
  const result = { ...DEFAULT_TEMPLATES } as Record<TemplateKey, KajianTemplate>;
  const rows = rowsFrom(await getDb().execute(sql`SELECT key, subject, body FROM kajian_email_templates`));
  for (const row of rows) {
    const key = String(row.key);
    if ((TEMPLATE_KEYS as readonly string[]).includes(key)) {
      result[key as TemplateKey] = { key: key as TemplateKey, subject: String(row.subject), body: String(row.body) };
    }
  }
  return result;
}

const wibFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const wibTimeFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface BroadcastTarget {
  source: 'event' | 'rutin';
  targetId: string;
  title: string;
  speaker: string | null;
  startAt: Date;
  endAt: Date | null;
  locationName: string | null;
}

async function loadTarget(source: 'event' | 'rutin', targetId: string): Promise<BroadcastTarget | null> {
  const db = getDb();
  if (source === 'event') {
    const [row] = await db
      .select({ id: events.id, title: events.title, speaker: events.speaker, startAt: events.startAt, endAt: events.endAt, locationName: events.locationName })
      .from(events)
      .where(eq(events.id, targetId))
      .limit(1);
    return row ? { source, targetId: row.id, title: row.title, speaker: row.speaker, startAt: row.startAt, endAt: row.endAt, locationName: row.locationName } : null;
  }
  const [row] = await db
    .select({
      id: kajianRutinSessions.id,
      sessionDate: kajianRutinSessions.sessionDate,
      startAt: kajianRutinSessions.startAt,
      endAt: kajianRutinSessions.endAt,
      topic: kajianRutinSessions.topic,
      sessionSpeaker: kajianRutinSessions.speaker,
      location: kajianRutinSessions.locationName,
      seriesTitle: kajianRutinSeries.title,
      seriesSpeaker: kajianRutinSeries.speaker,
      seriesLocation: kajianRutinSeries.locationName,
      seriesId: kajianRutinSeries.id,
    })
    .from(kajianRutinSessions)
    .innerJoin(kajianRutinSeries, eq(kajianRutinSessions.seriesId, kajianRutinSeries.id))
    .where(eq(kajianRutinSessions.id, targetId))
    .limit(1);
  if (!row) return null;
  return {
    source,
    targetId: row.id,
    title: row.seriesTitle,
    speaker: row.sessionSpeaker || row.seriesSpeaker,
    startAt: row.startAt,
    endAt: row.endAt,
    locationName: row.location || row.seriesLocation,
  };
}

interface Recipient {
  email: string;
  name: string;
}

async function loadRecipients(target: BroadcastTarget, targetType: 'reminder' | 'post'): Promise<Recipient[]> {
  const db = getDb();
  const map = new Map<string, Recipient>();
  if (target.source === 'event') {
    const rows = await db
      .select({
        status: eventAttendance.status,
        email: persons.email,
        fullName: persons.fullName,
        regData: eventAttendance.registrationData,
      })
      .from(eventAttendance)
      .leftJoin(persons, eq(eventAttendance.personId, persons.id))
      .where(eq(eventAttendance.eventId, target.targetId));
    for (const row of rows) {
      if (targetType === 'post' && row.status !== 'attended') continue;
      const regEmail = (row.regData as Record<string, unknown> | null)?.email;
      const email = String(row.email || regEmail || '').trim().toLowerCase();
      if (!email || !email.includes('@') || map.has(email)) continue;
      const regName = (row.regData as Record<string, unknown> | null)?.fullName;
      map.set(email, { email, name: row.fullName || (typeof regName === 'string' ? regName : '') || email.split('@')[0] || email });
    }
    return Array.from(map.values());
  }
  // Kajian rutin: pengingat ditujukan kepada seluruh peserta setia seri ini;
  // doa pasca-hadir khusus peserta yang absen pada sesi tersebut.
  const [session] = await db
    .select({ seriesId: kajianRutinSessions.seriesId })
    .from(kajianRutinSessions)
    .where(eq(kajianRutinSessions.id, target.targetId))
    .limit(1);
  if (!session) return [];
  const rows = await db
    .select({ email: kajianRutinAttendance.email, fullName: kajianRutinAttendance.fullName })
    .from(kajianRutinAttendance)
    .where(
      targetType === 'post'
        ? eq(kajianRutinAttendance.sessionId, target.targetId)
        : eq(kajianRutinAttendance.seriesId, session.seriesId)
    );
  for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || map.has(email)) continue;
    map.set(email, { email, name: row.fullName || email.split('@')[0] || email });
  }
  return Array.from(map.values());
}

async function sentEmailsFor(source: string, targetId: string, targetType: string, stage: string): Promise<Set<string>> {
  const rows = rowsFrom(
    await getDb().execute(sql`SELECT recipient_email FROM kajian_email_broadcast_log
      WHERE source = ${source} AND target_id = ${targetId}::uuid AND target_type = ${targetType} AND stage = ${stage} AND status = 'sent'`)
  );
  return new Set(rows.map((row) => String(row.recipient_email).toLowerCase()));
}

const sendSchema = z.object({
  source: z.enum(['event', 'rutin']),
  targetId: z.string().uuid(),
  targetType: z.enum(['reminder', 'post']),
  stage: z.enum(['h8', 'h1', 'manual', 'post']).optional(),
  batchSize: z.number().int().min(1).max(500).optional(),
});

const templateSaveSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string().trim().min(3, 'Subjek minimal 3 karakter').max(200),
  body: z.string().trim().min(10, 'Isi template minimal 10 karakter').max(4000),
});

export function registerKajianBroadcastRoutes(router: Router) {
  // Ringkasan kuota + jadwal kajian terdekat dari kedua sumber.
  router.get('/api/automation/kajian-broadcast/overview', requirePermission(PERMISSIONS.BROADCAST_HISTORY, async (ctx) => {
    await ensureBroadcastTables();
    const db = getDb();
    const days = Math.min(30, Math.max(1, Number.parseInt(ctx.query.days || '10', 10) || 10));
    const horizon = new Date(Date.now() + days * 86_400_000);
    const now = Date.now();

    const eventRows = await db
      .select({ id: events.id, title: events.title, speaker: events.speaker, startAt: events.startAt, locationName: events.locationName })
      .from(events)
      .where(and(inArray(events.status, ['scheduled', 'ongoing']), gte(events.startAt, new Date(now - 24 * 3_600_000))))
      .orderBy(events.startAt)
      .limit(20);
    const rutinRows = await db
      .select({
        id: kajianRutinSessions.id,
        startAt: kajianRutinSessions.startAt,
        topic: kajianRutinSessions.topic,
        seriesTitle: kajianRutinSeries.title,
        speaker: sql<string | null>`coalesce(${kajianRutinSessions.speaker}, ${kajianRutinSeries.speaker})`,
        locationName: sql<string | null>`coalesce(${kajianRutinSessions.locationName}, ${kajianRutinSeries.locationName})`,
      })
      .from(kajianRutinSessions)
      .innerJoin(kajianRutinSeries, eq(kajianRutinSessions.seriesId, kajianRutinSeries.id))
      .where(and(eq(kajianRutinSessions.status, 'scheduled'), eq(kajianRutinSeries.isActive, true), gte(kajianRutinSessions.startAt, new Date(now - 12 * 3_600_000))))
      .orderBy(kajianRutinSessions.startAt)
      .limit(20);

    const targets: Array<{ source: 'event' | 'rutin'; targetId: string }> = [
      ...eventRows.map((row) => ({ source: 'event' as const, targetId: row.id })),
      ...rutinRows.map((row) => ({ source: 'rutin' as const, targetId: row.id })),
    ];

    const quota = await getBroadcastDailyQuota();
    const items: Array<Record<string, unknown>> = [];
    for (const target of targets) {
      const loaded = await loadTarget(target.source, target.targetId);
      if (!loaded || loaded.startAt.getTime() > horizon.getTime()) continue;
      const reminderRecipients = await loadRecipients(loaded, 'reminder');
      const postRecipients = await loadRecipients(loaded, 'post');
      const sentReminder = await sentEmailsFor(loaded.source, loaded.targetId, 'reminder', 'reminder');
      const sentPost = await sentEmailsFor(loaded.source, loaded.targetId, 'post', 'post');

      const stages = ['h8', 'h1'].map((stage) => {
        const dueAt = new Date(loaded.startAt.getTime() - STAGE_OFFSETS[stage]! * 60_000);
        let status: string;
        if (sentReminder.size > 0) status = 'sent';
        else if (now >= dueAt.getTime() && now < loaded.startAt.getTime()) status = 'due';
        else if (now >= loaded.startAt.getTime()) status = 'closed';
        else status = 'not_due';
        return { key: stage, label: stage === 'h8' ? 'H-8 Jam' : 'H-1 Jam', dueAt: dueAt.toISOString(), status, pending: Math.max(0, reminderRecipients.length - sentReminder.size) };
      });
      const postPending = postRecipients.filter((r) => !sentPost.has(r.email)).length;
      const postStatus = sentPost.size > 0 ? 'sent' : now >= loaded.startAt.getTime() ? 'due' : 'not_due';

      items.push({
        source: loaded.source,
        targetId: loaded.targetId,
        title: loaded.title,
        speaker: loaded.speaker,
        startAt: loaded.startAt.toISOString(),
        locationName: loaded.locationName,
        reminderTotal: reminderRecipients.length,
        reminderPending: Math.max(0, reminderRecipients.length - sentReminder.size),
        postTotal: postRecipients.length,
        postPending,
        stages,
        post: { status: postStatus, pending: postPending },
        recommendedBatch: Math.max(1, Math.min(Math.max(reminderRecipients.length - sentReminder.size, 1), quota.remainingToday || 1, SAFE_BATCH_CEILING)),
      });
    }
    return successResponse(
      { quota, items },
      { requestId: ctx.requestId, total: items.length },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }));

  router.get('/api/automation/kajian-broadcast/templates', requirePermission(PERMISSIONS.BROADCAST_HISTORY, async (ctx) => {
    const templates = await loadTemplates();
    return successResponse(
      { templates: TEMPLATE_KEYS.map((key) => ({ ...templates[key], variables: Object.keys(SAMPLE_VARIABLES) })) },
      { requestId: ctx.requestId },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }));

  router.put('/api/automation/kajian-broadcast/templates', requirePermission(PERMISSIONS.BROADCAST_DRAFT,
    validateBody(templateSaveSchema, async (ctx, body) => {
      await ensureBroadcastTables();
      const db = getDb();
      await db.execute(sql`
        INSERT INTO kajian_email_templates (key, subject, body, updated_by, updated_at)
        VALUES (${body.key}, ${body.subject}, ${body.body}, ${ctx.user!.id}, now())
        ON CONFLICT (key) DO UPDATE SET subject = ${body.subject}, body = ${body.body}, updated_by = ${ctx.user!.id}, updated_at = now()`);
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_broadcast_template_save', entityType: 'kajian_email_template',
          entityId: body.key, afterJson: { key: body.key }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Broadcast Audit Error]', error); }
      return successResponse({ saved: true }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
    })));

  router.post('/api/automation/kajian-broadcast/preview', requirePermission(PERMISSIONS.BROADCAST_DRAFT,
    validateBody(templateSaveSchema.omit({ key: true }).extend({ key: z.enum(TEMPLATE_KEYS) }), async (ctx, body) => {
      const html = renderBody(body.body, SAMPLE_VARIABLES);
      const subject = body.subject.split('{{judul}}').join(SAMPLE_VARIABLES.judul).split('{{tanggal}}').join(SAMPLE_VARIABLES.tanggal);
      return successResponse(
        { subject, html: renderEmailLayout(subject, html), variables: SAMPLE_VARIABLES },
        { requestId: ctx.requestId },
        200,
        { 'Cache-Control': 'no-store' }
      );
    })));

  router.get('/api/automation/kajian-broadcast/log', requirePermission(PERMISSIONS.BROADCAST_HISTORY, async (ctx) => {
    await ensureBroadcastTables();
    const limit = Math.min(200, Math.max(1, Number.parseInt(ctx.query.limit || '100', 10) || 100));
    const rows = rowsFrom(
      await getDb().execute(sql`SELECT id, source, target_type, stage, batch_id, recipient_email, recipient_name, status, error, sent_at
        FROM kajian_email_broadcast_log ORDER BY sent_at DESC LIMIT ${limit}`)
    );
    const items = rows.map((row) => ({
      id: String(row.id),
      source: String(row.source),
      targetType: String(row.target_type),
      stage: String(row.stage),
      batchId: String(row.batch_id),
      recipientEmail: String(row.recipient_email),
      recipientName: row.recipient_name ? String(row.recipient_name) : null,
      status: String(row.status),
      error: row.error ? String(row.error) : null,
      sentAt: new Date(String(row.sent_at)).toISOString(),
    }));
    return successResponse(items, { requestId: ctx.requestId, total: items.length }, 200, { 'Cache-Control': 'no-store' });
  }));

  router.post('/api/automation/kajian-broadcast/send', requirePermission(PERMISSIONS.BROADCAST_DRAFT,
    validateBody(sendSchema, async (ctx, body) => {
      await ensureBroadcastTables();
      const target = await loadTarget(body.source, body.targetId);
      if (!target) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

      const stage = body.stage || (body.targetType === 'post' ? 'post' : 'manual');
      const templates = await loadTemplates();
      const template = templates[body.targetType === 'post' ? 'post' : 'reminder'];

      const allRecipients = await loadRecipients(target, body.targetType);
      if (!allRecipients.length) {
        return errorResponse('VALIDATION_ERROR', 'Tidak ada penerima dengan alamat email pada kajian ini.', 400, ctx.requestId);
      }
      const alreadySent = body.stage === 'manual' ? new Set<string>() : await sentEmailsFor(body.source, body.targetId, body.targetType, stage);
      const pending = allRecipients.filter((r) => !alreadySent.has(r.email));
      if (!pending.length) {
        return successResponse(
          { batchId: null, sent: 0, failed: 0, skippedAll: true, quota: await getBroadcastDailyQuota() },
          { requestId: ctx.requestId },
          200,
          { 'Cache-Control': 'no-store' }
        );
      }

      const quota = await getBroadcastDailyQuota();
      // Ukuran batch paling aman: sisa penerima, sisa kuota harian, dibatasi 100.
      const recommended = Math.max(1, Math.min(pending.length, quota.remainingToday || 0, SAFE_BATCH_CEILING));
      const batchSize = Math.min(body.batchSize ?? recommended, pending.length, quota.remainingToday || 0, 500);
      if (batchSize < 1) {
        return errorResponse('RATE_LIMITED', 'Kuota harian email broadcast sudah habis. Coba lagi besok atau naikkan MAILKETING_BROADCAST_DAILY_LIMIT.', 429, ctx.requestId);
      }

      const batchId = crypto.randomUUID().slice(0, 8).toUpperCase();
      const tanggal = wibFormat.format(target.startAt);
      const jam = wibTimeFormat.format(target.startAt);
      const batch = pending.slice(0, batchSize);

      let sent = 0;
      let failed = 0;
      let quotaExhausted = false;
      for (const recipient of batch) {
        const reservation = await reserveBroadcastEmailSlot();
        if (!reservation) {
          quotaExhausted = true;
          break;
        }
        const variables = {
          nama: recipient.name,
          judul: target.title,
          pemateri: target.speaker || 'Pemateri YTS',
          tanggal,
          jam,
          lokasi: target.locationName || 'Akan diinformasikan',
        };
        const html = renderBody(template.body, variables);
        const subject = template.subject.split('{{judul}}').join(target.title).split('{{tanggal}}').join(tanggal).split('{{nama}}').join(recipient.name);
        const result = await sendEmail({ to: recipient.email, subject, html });
        await getDb().execute(sql`
          INSERT INTO kajian_email_broadcast_log (source, target_id, target_type, stage, batch_id, recipient_email, recipient_name, status, error)
          VALUES (${body.source}, ${body.targetId}::uuid, ${body.targetType}, ${stage}, ${batchId}, ${recipient.email}, ${recipient.name}, ${result.success ? 'sent' : 'failed'}, ${result.error || null})`);
        if (result.success) sent += 1;
        else failed += 1;
      }

      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_broadcast_send', entityType: 'kajian_email_broadcast',
          entityId: body.targetId, afterJson: { source: body.source, targetType: body.targetType, stage, batchId, sent, failed }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Broadcast Audit Error]', error); }

      return successResponse(
        {
          batchId,
          sent,
          failed,
          remainingRecipients: Math.max(0, pending.length - sent - failed),
          quotaStopped: quotaExhausted,
          recommendedBatch: recommended,
          quota: await getBroadcastDailyQuota(),
        },
        { requestId: ctx.requestId },
        200,
        { 'Cache-Control': 'no-store' }
      );
    })));
}
