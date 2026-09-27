import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { logAuditEvent } from '../../audit/service';
import { getServerEnv } from '../../config/env';
import { getDb } from '../../db/client';
import { events, jamaahRoomEntries } from '../../db/schema';
import { requirePermission, validateBody } from '../../http/middleware';
import { errorResponse, successResponse } from '../../http/response';
import { Router } from '../../http/router';
import { PERMISSIONS } from '../../permissions/constants';

export const ROOM_CATEGORIES = ['saran', 'masukan', 'kebutuhan', 'pertanyaan', 'ide', 'cerita', 'pengalaman'] as const;
export const ROOM_STATUSES = ['new', 'reviewing', 'responded', 'closed'] as const;

export const roomSubmissionSchema = z.object({
  category: z.enum(ROOM_CATEGORIES),
  eventId: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).nullable().optional(),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{9,20}$/, 'Nomor telepon tidak valid')
    .refine((value) => value.replace(/\D/g, '').length >= 9, 'Nomor telepon terlalu pendek')
    .nullable().optional().or(z.literal('')),
  subject: z.string().trim().min(5, 'Judul minimal 5 karakter').max(160),
  message: z.string().trim().min(20, 'Isi minimal 20 karakter').max(4000),
  wantsReply: z.boolean().default(false),
  publicationConsent: z.boolean().default(false),
  anonymousPublication: z.boolean().default(true),
  website: z.string().max(200).default(''),
}).superRefine((value, ctx) => {
  if (value.wantsReply && !value.email && !value.phone) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: 'Isi email atau nomor telepon agar tim YTS dapat membalas.' });
  }
  if (value.publicationConsent && !['cerita', 'pengalaman'].includes(value.category)) {
    ctx.addIssue({ code: 'custom', path: ['publicationConsent'], message: 'Izin publikasi hanya tersedia untuk cerita atau pengalaman.' });
  }
});

const roomUpdateSchema = z.object({
  status: z.enum(ROOM_STATUSES).optional(),
  internalNote: z.string().trim().max(3000).nullable().optional(),
  response: z.string().trim().max(3000).nullable().optional(),
  publicTitle: z.string().trim().max(160).nullable().optional(),
  publicText: z.string().trim().max(4000).nullable().optional(),
  published: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan.');

const roomBulkReviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(25).refine((ids) => new Set(ids).size === ids.length, 'ID pesan tidak boleh berulang.'),
});

export function parseRoomDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) || new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) !== value ? null : date;
}

export function containsContactDetail(value: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) return true;
  const candidates = value.match(/\+?\d[\d\s().-]{7,}\d/g) || [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15 &&
      (digits.startsWith('0') || digits.startsWith('62') || candidate.trimStart().startsWith('+'));
  });
}

let setupPromise: Promise<void> | null = null;
async function ensureRoomTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      const db = getDb();
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS jamaah_room_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL,
        event_id uuid REFERENCES events(id) ON DELETE SET NULL, name text, email text, phone text,
        subject text NOT NULL, message text NOT NULL, wants_reply boolean NOT NULL DEFAULT false,
        publication_consent boolean NOT NULL DEFAULT false, anonymous_publication boolean NOT NULL DEFAULT true,
        status text NOT NULL DEFAULT 'new', internal_note text, response text,
        public_title text, public_text text, published_at timestamptz,
        updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_jamaah_room_created ON jamaah_room_entries (created_at)'));
      await db.execute(sql.raw('ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS public_title text'));
      await db.execute(sql.raw('ALTER TABLE jamaah_room_entries ADD COLUMN IF NOT EXISTS public_text text'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_jamaah_room_status ON jamaah_room_entries (status)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_jamaah_room_published ON jamaah_room_entries (published_at)'));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS jamaah_room_rate_limits (
        key text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL)`));
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

function firstRows(result: unknown): Array<{ hits: number }> {
  if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: Array<{ hits: number }> }).rows;
  return Array.isArray(result) ? result : [];
}

export function registerJamaahRoomRoutes(router: Router) {
  router.get('/api/public/jamaah-room/event/:id', async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian tidak valid.', 400, ctx.requestId);
    }
    const [event] = await getDb().select({ id: events.id, title: events.title }).from(events)
      .where(eq(events.id, ctx.params.id!)).limit(1);
    if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);
    return successResponse(event, { requestId: ctx.requestId });
  });

  router.post('/api/public/jamaah-room', validateBody(roomSubmissionSchema, async (ctx, body) => {
    if (body.website) return successResponse({ received: true }, { requestId: ctx.requestId }, 201);
    await ensureRoomTables();
    const db = getDb();
    const ip = ctx.headers['x-nf-client-connection-ip'] || ctx.headers['X-Nf-Client-Connection-Ip'];
    if (ip) {
      if (Math.random() < 0.01) await db.execute(sql`DELETE FROM jamaah_room_rate_limits WHERE expires_at < now()`);
      const hour = Math.floor(Date.now() / 3_600_000);
      const key = createHash('sha256').update(`${getServerEnv().AUTH_SECRET}:${ip}:${hour}`).digest('hex');
      const result = await db.execute(sql`INSERT INTO jamaah_room_rate_limits (key, hits, expires_at)
        VALUES (${key}, 1, now() + interval '2 hours')
        ON CONFLICT (key) DO UPDATE SET hits = jamaah_room_rate_limits.hits + 1
        WHERE jamaah_room_rate_limits.hits < 5 RETURNING hits`);
      if (firstRows(result).length === 0) {
        return errorResponse('RATE_LIMITED', 'Terlalu banyak kiriman. Silakan coba kembali dalam satu jam.', 429, ctx.requestId);
      }
    }
    if (body.eventId) {
      const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, body.eventId)).limit(1);
      if (!event) return errorResponse('NOT_FOUND', 'Kajian yang dipilih tidak ditemukan.', 404, ctx.requestId);
    }
    const [entry] = await db.insert(jamaahRoomEntries).values({
      category: body.category,
      eventId: body.eventId || null,
      name: body.name || null,
      email: body.email || null,
      phone: body.phone || null,
      subject: body.subject,
      message: body.message,
      wantsReply: body.wantsReply,
      publicationConsent: body.publicationConsent,
      anonymousPublication: body.anonymousPublication,
    }).returning({ id: jamaahRoomEntries.id });
    if (!entry) return errorResponse('INTERNAL_ERROR', 'Pesan belum dapat disimpan. Silakan coba lagi.', 500, ctx.requestId);
    return successResponse({ received: true, reference: entry.id.slice(0, 8).toUpperCase() }, { requestId: ctx.requestId }, 201, { 'Cache-Control': 'no-store' });
  }));

  router.get('/api/public/jamaah-room/stories', async (ctx) => {
    await ensureRoomTables();
    const db = getDb();
    const stories = await db.select({
      id: jamaahRoomEntries.id, subject: jamaahRoomEntries.publicTitle,
      message: jamaahRoomEntries.publicText, name: jamaahRoomEntries.name,
      anonymousPublication: jamaahRoomEntries.anonymousPublication,
      publishedAt: jamaahRoomEntries.publishedAt, eventTitle: events.title,
    }).from(jamaahRoomEntries).leftJoin(events, eq(jamaahRoomEntries.eventId, events.id))
      .where(and(isNotNull(jamaahRoomEntries.publishedAt), eq(jamaahRoomEntries.publicationConsent, true),
        isNotNull(jamaahRoomEntries.publicTitle), isNotNull(jamaahRoomEntries.publicText)))
      .orderBy(desc(jamaahRoomEntries.publishedAt)).limit(12);
    return successResponse(stories.map(({ name, anonymousPublication, ...story }) => ({
      ...story, displayName: !anonymousPublication && name && !containsContactDetail(name) ? name : 'Jamaah YTS',
    })), { requestId: ctx.requestId }, 200, { 'Cache-Control': 'public, max-age=60' });
  });

  router.get('/api/jamaah-room', requirePermission(PERMISSIONS.INTERACTIONS_VIEW, async (ctx) => {
    const page = Math.min(1000, Math.max(1, Number.parseInt(ctx.query.page || '1', 10) || 1));
    const pageSize = 25;
    const status = ROOM_STATUSES.find((value) => value === ctx.query.status);
    const category = ROOM_CATEGORIES.find((value) => value === ctx.query.category);
    const search = ctx.query.search?.trim().slice(0, 100);
    const queue = ctx.query.queue || 'all';
    if (!['all', 'reply', 'curation'].includes(queue)) {
      return errorResponse('VALIDATION_ERROR', 'Antrean tidak valid.', 400, ctx.requestId);
    }
    const eventId = ctx.query.eventId;
    if (eventId && !z.string().uuid().safeParse(eventId).success) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian tidak valid.', 400, ctx.requestId);
    }
    const from = ctx.query.from ? parseRoomDate(ctx.query.from) : null;
    const to = ctx.query.to ? parseRoomDate(ctx.query.to) : null;
    if ((ctx.query.from && !from) || (ctx.query.to && !to) || (from && to && from > to)) {
      return errorResponse('VALIDATION_ERROR', 'Rentang tanggal tidak valid.', 400, ctx.requestId);
    }
    await ensureRoomTables();
    const db = getDb();
    const order = ctx.query.order === 'oldest' ? asc(jamaahRoomEntries.createdAt) : desc(jamaahRoomEntries.createdAt);
    const where = and(
      status ? eq(jamaahRoomEntries.status, status) : undefined,
      category ? eq(jamaahRoomEntries.category, category) : undefined,
      eventId ? eq(jamaahRoomEntries.eventId, eventId) : undefined,
      from ? gte(jamaahRoomEntries.createdAt, from) : undefined,
      to ? lt(jamaahRoomEntries.createdAt, new Date(to.getTime() + 24 * 60 * 60 * 1000)) : undefined,
      queue === 'reply' ? and(eq(jamaahRoomEntries.wantsReply, true), inArray(jamaahRoomEntries.status, ['new', 'reviewing'])) : undefined,
      queue === 'curation' ? and(inArray(jamaahRoomEntries.category, ['cerita', 'pengalaman']), eq(jamaahRoomEntries.publicationConsent, true), isNull(jamaahRoomEntries.publishedAt), inArray(jamaahRoomEntries.status, ['new', 'reviewing', 'responded'])) : undefined,
      search ? or(ilike(jamaahRoomEntries.subject, `%${search}%`), ilike(jamaahRoomEntries.message, `%${search}%`), ilike(jamaahRoomEntries.name, `%${search}%`), ilike(events.title, `%${search}%`)) : undefined,
    );
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(jamaahRoomEntries)
      .leftJoin(events, eq(jamaahRoomEntries.eventId, events.id)).where(where);
    const items = await db.select({
      id: jamaahRoomEntries.id, category: jamaahRoomEntries.category, eventId: jamaahRoomEntries.eventId,
      eventTitle: events.title, name: jamaahRoomEntries.name, subject: jamaahRoomEntries.subject,
      preview: sql<string>`left(${jamaahRoomEntries.message}, 150)`,
      wantsReply: jamaahRoomEntries.wantsReply, status: jamaahRoomEntries.status,
      publicationConsent: jamaahRoomEntries.publicationConsent,
      publishedAt: jamaahRoomEntries.publishedAt, createdAt: jamaahRoomEntries.createdAt,
    }).from(jamaahRoomEntries).leftJoin(events, eq(jamaahRoomEntries.eventId, events.id))
      .where(where).orderBy(order, desc(jamaahRoomEntries.id)).limit(pageSize).offset((page - 1) * pageSize);
    const summary = await db.select({ status: jamaahRoomEntries.status, count: sql<number>`count(*)::int` })
      .from(jamaahRoomEntries).groupBy(jamaahRoomEntries.status);
    const eventOptions = await db.selectDistinct({ id: events.id, title: events.title }).from(jamaahRoomEntries)
      .innerJoin(events, eq(jamaahRoomEntries.eventId, events.id)).orderBy(asc(events.title));
    return successResponse({ items, summary, eventOptions }, { requestId: ctx.requestId, page, pageSize, total: count?.total || 0 }, 200, { 'Cache-Control': 'no-store' });
  }));

  router.get('/api/jamaah-room/:id', requirePermission(PERMISSIONS.INTERACTIONS_VIEW, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID pesan tidak valid.', 400, ctx.requestId);
    }
    await ensureRoomTables();
    const [entry] = await getDb().select({
      id: jamaahRoomEntries.id, category: jamaahRoomEntries.category, eventId: jamaahRoomEntries.eventId,
      eventTitle: events.title, name: jamaahRoomEntries.name, email: jamaahRoomEntries.email,
      phone: jamaahRoomEntries.phone, subject: jamaahRoomEntries.subject, message: jamaahRoomEntries.message,
      wantsReply: jamaahRoomEntries.wantsReply, publicationConsent: jamaahRoomEntries.publicationConsent,
      anonymousPublication: jamaahRoomEntries.anonymousPublication, status: jamaahRoomEntries.status,
      internalNote: jamaahRoomEntries.internalNote, response: jamaahRoomEntries.response,
      publicTitle: jamaahRoomEntries.publicTitle, publicText: jamaahRoomEntries.publicText,
      publishedAt: jamaahRoomEntries.publishedAt, createdAt: jamaahRoomEntries.createdAt,
      updatedAt: jamaahRoomEntries.updatedAt,
    }).from(jamaahRoomEntries).leftJoin(events, eq(jamaahRoomEntries.eventId, events.id))
      .where(eq(jamaahRoomEntries.id, ctx.params.id!)).limit(1);
    if (!entry) return errorResponse('NOT_FOUND', 'Pesan tidak ditemukan.', 404, ctx.requestId);
    return successResponse(entry, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
  }));

  router.patch('/api/jamaah-room/bulk-review', requirePermission(PERMISSIONS.INTERACTIONS_CREATE,
    validateBody(roomBulkReviewSchema, async (ctx, body) => {
      await ensureRoomTables();
      const db = getDb();
      const before = await db.select({ id: jamaahRoomEntries.id, status: jamaahRoomEntries.status })
        .from(jamaahRoomEntries).where(and(inArray(jamaahRoomEntries.id, body.ids), eq(jamaahRoomEntries.status, 'new')));
      if (!before.length) return successResponse({ updated: 0 }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
      const updated = await db.update(jamaahRoomEntries).set({ status: 'reviewing', updatedBy: ctx.user!.id, updatedAt: new Date() })
        .where(and(inArray(jamaahRoomEntries.id, before.map((entry) => entry.id)), eq(jamaahRoomEntries.status, 'new')))
        .returning({ id: jamaahRoomEntries.id });
      await Promise.all(updated.map(async (entry) => {
        try {
          await logAuditEvent({ actorUserId: ctx.user!.id, action: 'jamaah_room_update', entityType: 'jamaah_room_entry',
            entityId: entry.id, beforeJson: { status: 'new' }, afterJson: { status: 'reviewing' }, requestId: ctx.requestId });
        } catch (error) { console.error('[Jamaah Room Audit Error]', error); }
      }));
      return successResponse({ updated: updated.length }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
    })));

  router.patch('/api/jamaah-room/:id', requirePermission(PERMISSIONS.INTERACTIONS_CREATE,
    validateBody(roomUpdateSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID pesan tidak valid.', 400, ctx.requestId);
      }
      await ensureRoomTables();
      const db = getDb();
      const entryId = ctx.params.id!;
      const [before] = await db.select().from(jamaahRoomEntries).where(eq(jamaahRoomEntries.id, entryId)).limit(1);
      if (!before) return errorResponse('NOT_FOUND', 'Pesan tidak ditemukan.', 404, ctx.requestId);
      if (body.published && (!before.publicationConsent || !['cerita', 'pengalaman'].includes(before.category))) {
        return errorResponse('FORBIDDEN', 'Cerita hanya dapat diterbitkan dengan izin publikasi dari jamaah.', 403, ctx.requestId);
      }
      const publicTitle = body.publicTitle !== undefined ? body.publicTitle : before.publicTitle;
      const publicText = body.publicText !== undefined ? body.publicText : before.publicText;
      if ((body.status ?? before.status) === 'responded' && !(body.response !== undefined ? body.response : before.response)?.trim()) {
        return errorResponse('VALIDATION_ERROR', 'Catat ringkasan tanggapan sebelum menandai sudah ditanggapi.', 400, ctx.requestId);
      }
      if ((body.published || before.publishedAt) && (body.published !== false) &&
        (!publicTitle || publicTitle.length < 5 || !publicText || publicText.length < 20)) {
        return errorResponse('VALIDATION_ERROR', 'Isi judul dan teks cerita publik terlebih dahulu.', 400, ctx.requestId);
      }
      if ((body.published || before.publishedAt) && body.published !== false &&
        containsContactDetail(`${publicTitle || ''} ${publicText || ''}`)) {
        return errorResponse('VALIDATION_ERROR', 'Hapus alamat email atau nomor telepon dari versi publik cerita.', 400, ctx.requestId);
      }
      const [updated] = await db.update(jamaahRoomEntries).set({
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.internalNote !== undefined ? { internalNote: body.internalNote } : {}),
        ...(body.response !== undefined ? { response: body.response } : {}),
        ...(body.publicTitle !== undefined ? { publicTitle: body.publicTitle } : {}),
        ...(body.publicText !== undefined ? { publicText: body.publicText } : {}),
        ...(body.published !== undefined ? { publishedAt: body.published ? before.publishedAt || new Date() : null } : {}),
        updatedBy: ctx.user!.id, updatedAt: new Date(),
      }).where(eq(jamaahRoomEntries.id, before.id)).returning();
      if (!updated) return errorResponse('NOT_FOUND', 'Pesan tidak ditemukan.', 404, ctx.requestId);
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'jamaah_room_update', entityType: 'jamaah_room_entry',
          entityId: before.id, beforeJson: { status: before.status, published: Boolean(before.publishedAt) },
          afterJson: { status: updated.status, published: Boolean(updated.publishedAt) }, requestId: ctx.requestId });
      } catch (error) { console.error('[Jamaah Room Audit Error]', error); }
      return successResponse(updated, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
    })));
}
