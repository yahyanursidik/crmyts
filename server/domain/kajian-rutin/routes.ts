import crypto from 'node:crypto';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';
import { verifyGoogleIdToken, isGoogleAuthConfigured } from '../../auth/google';
import { getDb } from '../../db/client';
import {
  events,
  eventAttendance,
  personRoles,
  persons,
  kajianRutinAttendance,
  kajianRutinSeries,
  kajianRutinSessions,
  kajianRutinAccounts,
  kajianRutinSpeakers,
} from '../../db/schema';
import { requirePermission, validateBody } from '../../http/middleware';
import { errorResponse, successResponse, ErrorCode } from '../../http/response';
import { Router } from '../../http/router';
import { PERMISSIONS } from '../../permissions/constants';
import { createJamaahPortalToken, generateQrToken, resolveJamaahSession } from './tokens';

const RECURRENCES = ['weekly', 'biweekly', 'monthly'] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const targetAudienceSchema = z.enum(['umum', 'ikhwan_only', 'akhwat_only', 'anak']);

const seriesCreateSchema = z.object({
  title: z.string().trim().min(3, 'Judul kajian rutin minimal 3 karakter').max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  speaker: z.string().trim().max(160).nullable().optional(),
  recurrence: z.enum(RECURRENCES).default('weekly'),
  dayOfWeek: z.number().int().min(0, 'Hari tidak valid').max(6, 'Hari tidak valid').nullable().optional(),
  startDate: z.string().regex(DATE_PATTERN, 'Tanggal mulai harus format YYYY-MM-DD').nullable().optional(),
  startTime: z.string().regex(TIME_PATTERN, 'Jam mulai harus format HH:mm').default('07:00'),
  endTime: z.string().regex(TIME_PATTERN, 'Jam selesai harus format HH:mm').nullable().optional(),
  locationName: z.string().trim().max(160).nullable().optional(),
  locationAddress: z.string().trim().max(400).nullable().optional(),
  targetAudience: targetAudienceSchema.default('umum'),
  quota: z.number().int().min(0, 'Kuota tidak valid').max(100000).nullable().optional(),
  posterUrl: z.string().url('Tautan poster tidak valid').max(600).nullable().optional().or(z.literal('')),
  checkInOpenMinutes: z.number().int().min(15, 'Minimal 15 menit sebelum mulai').max(1440).default(240),
  checkInCloseMinutes: z.number().int().min(15, 'Minimal 15 menit setelah selesai').max(1440).default(300),
  isActive: z.boolean().default(true),
});

const seriesUpdateSchema = seriesCreateSchema.partial().refine((v) => Object.keys(v).length > 0, 'Tidak ada perubahan.');

const sessionCreateSchema = z.object({
  sessionDate: z.string().regex(DATE_PATTERN, 'Tanggal sesi harus format YYYY-MM-DD').optional(),
  topic: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const sessionGenerateSchema = z.object({
  count: z.number().int().min(1, 'Minimal 1 sesi').max(12, 'Maksimal 12 sesi sekali generate').default(4),
});

const sessionUpdateSchema = z.object({
  sessionDate: z.string().regex(DATE_PATTERN, 'Tanggal sesi harus format YYYY-MM-DD').optional(),
  startTime: z.string().regex(TIME_PATTERN, 'Jam mulai harus format HH:mm').nullable().optional(),
  endTime: z.string().regex(TIME_PATTERN, 'Jam selesai harus format HH:mm').nullable().optional(),
  locationName: z.string().trim().max(160).nullable().optional(),
  speaker: z.string().trim().max(160).nullable().optional(),
  topic: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
}).refine((v) => Object.keys(v).length > 0, 'Tidak ada perubahan.');

const speakerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama pemateri minimal 2 karakter').max(160),
  notes: z.string().trim().max(500).optional().nullable().or(z.literal('')),
});

const portalProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(160).optional(),
  cityRegency: z.string().trim().max(160).optional().nullable(),
  province: z.string().trim().max(160).optional().nullable(),
  gender: z.enum(['ikhwan', 'akhwat']).optional().nullable(),
  educationLevel: z.string().trim().max(80).optional().nullable(),
}).refine((v) => Object.keys(v).length > 0, 'Tidak ada perubahan.');

const manualAttendanceSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(160),
  email: z.string().trim().email('Format email tidak valid').max(254).optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(24).optional().nullable().or(z.literal('')),
  note: z.string().trim().max(300).optional().nullable().or(z.literal('')),
});

const googleAuthSchema = z.object({
  credential: z.string().min(20, 'Kredensial Google tidak valid').max(4096),
  sessionId: z.string().uuid().optional().nullable(),
  token: z.string().trim().max(128).optional().nullable(),
});

const portalAbsenSchema = z.object({
  sessionId: z.string().uuid('Sesi kajian tidak valid'),
  token: z.string().trim().max(128).optional().nullable(),
  deviceInfo: z.string().trim().max(160).optional().nullable(),
});

const portalAbsenDaurahSchema = z.object({
  eventId: z.string().uuid('Kajian daurah tidak valid'),
});

let setupPromise: Promise<void> | null = null;
async function ensureKajianRutinTables() {
  if (!setupPromise) {
    setupPromise = (async () => {
      const db = getDb();
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_series (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        description text,
        speaker text,
        recurrence text NOT NULL DEFAULT 'weekly',
        day_of_week integer,
        start_date date,
        start_time text NOT NULL DEFAULT '07:00',
        end_time text,
        location_name text,
        location_address text,
        target_audience text NOT NULL DEFAULT 'umum',
        quota integer,
        poster_url text,
        check_in_open_minutes integer NOT NULL DEFAULT 240,
        check_in_close_minutes integer NOT NULL DEFAULT 300,
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_speakers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        notes text,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_speakers_name ON kajian_rutin_speakers (name)'));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        series_id uuid NOT NULL REFERENCES kajian_rutin_series(id) ON DELETE CASCADE,
        session_date date NOT NULL,
        start_at timestamptz NOT NULL,
        end_at timestamptz,
        start_time text,
        end_time text,
        location_name text,
        speaker text,
        topic text,
        notes text,
        status text NOT NULL DEFAULT 'scheduled',
        qr_token text NOT NULL,
        qr_rotated_at timestamptz,
        created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        google_sub text NOT NULL,
        email text NOT NULL,
        full_name text NOT NULL,
        picture_url text,
        phone text,
        gender text,
        city_regency text,
        province text,
        education_level text,
        last_login_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_attendance (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES kajian_rutin_sessions(id) ON DELETE CASCADE,
        series_id uuid NOT NULL REFERENCES kajian_rutin_series(id) ON DELETE CASCADE,
        account_id uuid REFERENCES kajian_rutin_accounts(id) ON DELETE SET NULL,
        google_sub text NOT NULL,
        email text,
        full_name text NOT NULL,
        picture_url text,
        phone text,
        source text NOT NULL DEFAULT 'qr_self_scan',
        status text NOT NULL DEFAULT 'present',
        note text,
        check_in_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now())`));
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS kajian_rutin_rate_limits (
        key text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL)`));
      await db.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_sessions_series_date ON kajian_rutin_sessions (series_id, session_date)'));
      await db.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_sessions_qr_token ON kajian_rutin_sessions (qr_token)'));
      await db.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_accounts_sub ON kajian_rutin_accounts (google_sub)'));
      await db.execute(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_session_sub ON kajian_rutin_attendance (session_id, google_sub)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_sessions_series ON kajian_rutin_sessions (series_id)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_sessions_start_at ON kajian_rutin_sessions (start_at)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_session ON kajian_rutin_attendance (session_id)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_series ON kajian_rutin_attendance (series_id)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_attendance_check_in ON kajian_rutin_attendance (check_in_at)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_accounts_email ON kajian_rutin_accounts (email)'));
      await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS idx_kajian_rutin_series_active ON kajian_rutin_series (is_active)'));
      // Kolom tambahan untuk deployment yang sudah berjalan.
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_series ADD COLUMN IF NOT EXISTS start_date date'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_series ADD COLUMN IF NOT EXISTS poster_url text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_sessions ADD COLUMN IF NOT EXISTS start_time text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_sessions ADD COLUMN IF NOT EXISTS end_time text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_sessions ADD COLUMN IF NOT EXISTS location_name text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_sessions ADD COLUMN IF NOT EXISTS speaker text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_accounts ADD COLUMN IF NOT EXISTS gender text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_accounts ADD COLUMN IF NOT EXISTS province text'));
      await db.execute(sql.raw('ALTER TABLE kajian_rutin_accounts ADD COLUMN IF NOT EXISTS education_level text'));
    })().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

function firstRows(result: unknown): Array<Record<string, unknown>> {
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return Array.isArray(result) ? result : [];
}

/** Konsumsi kuota rate limit sederhana per kunci (IP / akun). */
async function consumeRateLimit(key: string, maxHits: number, windowHours: number): Promise<boolean> {
  const result = await getDb().execute(sql`INSERT INTO kajian_rutin_rate_limits (key, hits, expires_at)
    VALUES (${key}, 1, now() + (${windowHours} * interval '1 hour'))
    ON CONFLICT (key) DO UPDATE SET hits = kajian_rutin_rate_limits.hits + 1
    WHERE kajian_rutin_rate_limits.expires_at < now() OR kajian_rutin_rate_limits.hits < ${maxHits}
    RETURNING hits`);
  return firstRows(result).length > 0;
}

function clientIp(ctx: { headers: Record<string, string | undefined> }): string {
  return ctx.headers['x-nf-client-connection-ip'] || ctx.headers['X-Nf-Client-Connection-Ip'] || 'unknown';
}

/** Konversi tanggal kalender WIB (YYYY-MM-DD) + jam WIB (HH:mm) menjadi Date absolut. */
export function computeWibDateTime(sessionDate: string, time: string): Date | null {
  if (!DATE_PATTERN.test(sessionDate) || !TIME_PATTERN.test(time)) return null;
  const date = new Date(`${sessionDate}T${time}:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === sessionDate ? date : null;
}

function wibToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00Z`).getTime() + days * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

function weekdayOfIso(dateIso: string): number {
  // Tengah hari WIB (12:00 +07:00 = 05:00 UTC) tetap pada tanggal kalender yang sama.
  return new Date(`${dateIso}T05:00:00Z`).getUTCDay();
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000
  );
}

interface SeriesWindowConfig {
  checkInOpenMinutes: number;
  checkInCloseMinutes: number;
}

function computeCheckInWindow(series: SeriesWindowConfig, startAt: Date, endAt: Date | null) {
  const effectiveEnd = endAt ?? new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
  return {
    openAt: new Date(startAt.getTime() - series.checkInOpenMinutes * 60_000),
    closeAt: new Date(effectiveEnd.getTime() + series.checkInCloseMinutes * 60_000),
  };
}

function serializeSeries(row: typeof kajianRutinSeries.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    speaker: row.speaker,
    recurrence: row.recurrence,
    dayOfWeek: row.dayOfWeek,
    startDate: row.startDate ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    locationName: row.locationName,
    locationAddress: row.locationAddress,
    targetAudience: row.targetAudience,
    quota: row.quota,
    posterUrl: row.posterUrl ?? null,
    checkInOpenMinutes: row.checkInOpenMinutes,
    checkInCloseMinutes: row.checkInCloseMinutes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeSession(row: typeof kajianRutinSessions.$inferSelect) {
  return {
    id: row.id,
    seriesId: row.seriesId,
    sessionDate: row.sessionDate,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt ? row.endAt.toISOString() : null,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    locationName: row.locationName ?? null,
    speaker: row.speaker ?? null,
    topic: row.topic,
    notes: row.notes,
    status: row.status,
    qrToken: row.qrToken,
    qrRotatedAt: row.qrRotatedAt ? row.qrRotatedAt.toISOString() : null,
  };
}

async function loadSessionWithSeries(sessionId: string) {
  const [row] = await getDb()
    .select({ session: kajianRutinSessions, series: kajianRutinSeries })
    .from(kajianRutinSessions)
    .innerJoin(kajianRutinSeries, eq(kajianRutinSessions.seriesId, kajianRutinSeries.id))
    .where(eq(kajianRutinSessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/** Validasi konteks QR: sesi harus ada, token cocok, seri aktif, sesi tidak dibatalkan. */
async function validateQrContext(
  sessionId: string,
  token: string
): Promise<{ ok: true; data: NonNullable<Awaited<ReturnType<typeof loadSessionWithSeries>>> } | { ok: false; code: 'NOT_FOUND' | 'INVALID_TOKEN' | 'UNAVAILABLE'; message: string }> {
  const row = await loadSessionWithSeries(sessionId);
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Sesi kajian rutin tidak ditemukan.' };
  if (row.session.qrToken !== token) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'QR tidak valid atau sudah diganti panitia. Minta QR terbaru.' };
  }
  if (!row.series.isActive || row.session.status === 'cancelled') {
    return { ok: false, code: 'UNAVAILABLE', message: 'Absensi untuk kajian ini sedang tidak tersedia.' };
  }
  return { ok: true, data: row };
}

async function findExistingAttendance(sessionId: string, googleSub: string) {
  const [row] = await getDb()
    .select()
    .from(kajianRutinAttendance)
    .where(and(eq(kajianRutinAttendance.sessionId, sessionId), eq(kajianRutinAttendance.googleSub, googleSub)))
    .limit(1);
  return row ?? null;
}

// ===================== KAJIAN DAURAH (event satu kali) =====================

/**
 * Jendela absen mandiri daurah: mulai 12 jam sebelum mulai sampai 12 jam
 * setelah perkiraan selesai (endAt, atau +3 jam bila tidak diisi).
 */
function computeDaurahCheckInWindow(startAt: Date, endAt: Date | null) {
  const effectiveEnd = endAt ?? new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
  return {
    openAt: new Date(startAt.getTime() - 12 * 60 * 60 * 1000),
    closeAt: new Date(effectiveEnd.getTime() + 12 * 60 * 60 * 1000),
  };
}

async function resolvePersonIdsByEmail(email: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: persons.id })
    .from(persons)
    .where(sql`lower(${persons.email}) = ${email}`)
    .limit(10);
  return rows.map((row) => row.id);
}

/** Cocokkan kehadiran daurah lewat person yang emailnya sama, atau email yang tersimpan di data registrasi. */
function daurahMatchCondition(personIds: string[], email: string) {
  const emailMatch = sql`${eventAttendance.registrationData}->>'email' = ${email}`;
  return personIds.length ? or(inArray(eventAttendance.personId, personIds), emailMatch) : emailMatch;
}

/**
 * Sinkronkan peserta kajian rutin ke Direktori Jamaah: cocokkan lewat email;
 * bila belum ada, buat person baru minimal dengan profil portal jamaah.
 * Data jamaah yang sudah ada tidak pernah ditimpa — hanya kolom kosong yang diisi.
 */
async function syncPersonFromJamaah(input: {
  fullName: string;
  email: string;
  gender?: string | null;
  cityRegency?: string | null;
  province?: string | null;
  educationLevel?: string | null;
}): Promise<void> {
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: persons.id, cityRegency: persons.cityRegency, province: persons.province, gender: persons.gender, educationLevel: persons.educationLevel })
      .from(persons)
      .where(sql`lower(${persons.email}) = ${input.email}`)
      .limit(1);
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (!existing.cityRegency && input.cityRegency) patch.cityRegency = input.cityRegency;
      if (!existing.province && input.province) patch.province = input.province;
      if (!existing.gender && (input.gender === 'ikhwan' || input.gender === 'akhwat')) patch.gender = input.gender;
      if (!existing.educationLevel && input.educationLevel) patch.educationLevel = input.educationLevel;
      if (Object.keys(patch).length > 0) {
        await db.update(persons).set({ ...patch, updatedAt: new Date() }).where(eq(persons.id, existing.id));
      }
      return;
    }
    const [created] = await db
      .insert(persons)
      .values({
        fullName: input.fullName,
        email: input.email,
        gender: input.gender === 'ikhwan' || input.gender === 'akhwat' ? input.gender : null,
        cityRegency: input.cityRegency || null,
        province: input.province || null,
        educationLevel: input.educationLevel || null,
        sourceCode: 'kajian_rutin_portal',
      })
      .onConflictDoNothing()
      .returning({ id: persons.id });
    if (created) {
      await db.insert(personRoles).values({ personId: created.id, roleCode: 'jamaah' }).onConflictDoNothing();
    }
  } catch (error) {
    console.error('[Kajian Rutin Person Sync Error]:', error);
  }
}

async function getAccountById(accountId: string) {
  const [account] = await getDb()
    .select()
    .from(kajianRutinAccounts)
    .where(eq(kajianRutinAccounts.id, accountId))
    .limit(1);
  return account ?? null;
}

const wibWindowFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatWibWindow(date: Date): string {
  return `${wibWindowFormatter.format(date)} WIB`;
}

export function registerKajianRutinRoutes(router: Router) {
  // ===================== ADMIN: SERI KAJIAN RUTIN =====================

  router.get('/api/kajian-rutin/series', requirePermission(PERMISSIONS.EVENTS_VIEW, async (ctx) => {
    await ensureKajianRutinTables();
    const db = getDb();
    const rows = await db.select().from(kajianRutinSeries).orderBy(desc(kajianRutinSeries.isActive), asc(kajianRutinSeries.title));
    const todayWib = wibToday();

    const sessionStats = await db
      .select({
        seriesId: kajianRutinSessions.seriesId,
        total: sql<number>`cast(count(*) as int)`,
        nextDate: sql<string | null>`min(case when ${kajianRutinSessions.sessionDate} >= ${todayWib}::date and ${kajianRutinSessions.status} = 'scheduled' then ${kajianRutinSessions.sessionDate} end)`,
      })
      .from(kajianRutinSessions)
      .groupBy(kajianRutinSessions.seriesId);
    const sessionMap = new Map(sessionStats.map((s) => [s.seriesId, s]));

    const attendanceStats = await db
      .select({
        seriesId: kajianRutinAttendance.seriesId,
        total: sql<number>`cast(count(*) as int)`,
        lastCheckIn: sql<string | null>`max(${kajianRutinAttendance.checkInAt})`,
      })
      .from(kajianRutinAttendance)
      .groupBy(kajianRutinAttendance.seriesId);
    const attendanceMap = new Map(attendanceStats.map((s) => [s.seriesId, s]));

    const items = rows.map((row) => ({
      ...serializeSeries(row),
      totalSessions: Number(sessionMap.get(row.id)?.total || 0),
      nextSessionDate: sessionMap.get(row.id)?.nextDate || null,
      totalAttendance: Number(attendanceMap.get(row.id)?.total || 0),
      lastAttendanceAt: attendanceMap.get(row.id)?.lastCheckIn
        ? new Date(String(attendanceMap.get(row.id)!.lastCheckIn)).toISOString()
        : null,
    }));
    return successResponse(items, { requestId: ctx.requestId, total: items.length }, 200, { 'Cache-Control': 'no-store' });
  }));

  router.post('/api/kajian-rutin/series', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(seriesCreateSchema, async (ctx, body) => {
      await ensureKajianRutinTables();
      const db = getDb();
      const [created] = await db.insert(kajianRutinSeries).values({
        title: body.title,
        description: body.description || null,
        speaker: body.speaker || null,
        recurrence: body.recurrence,
        dayOfWeek: body.dayOfWeek ?? null,
        startDate: body.startDate || null,
        startTime: body.startTime,
        endTime: body.endTime || null,
        locationName: body.locationName || null,
        locationAddress: body.locationAddress || null,
        targetAudience: body.targetAudience,
        quota: body.quota ?? null,
        posterUrl: body.posterUrl || null,
        checkInOpenMinutes: body.checkInOpenMinutes,
        checkInCloseMinutes: body.checkInCloseMinutes,
        isActive: body.isActive,
        createdBy: ctx.user!.id,
      }).returning();
      if (!created) return errorResponse('INTERNAL_ERROR', 'Kajian rutin belum dapat disimpan.', 500, ctx.requestId);

      // Bila tanggal mulai diisi, langsung terbitkan sesi pertama + QR.
      if (created.startDate) {
        const startAt = computeWibDateTime(created.startDate, created.startTime);
        if (startAt) {
          const endAt = created.endTime ? computeWibDateTime(created.startDate, created.endTime) : null;
          await db.insert(kajianRutinSessions).values({
            seriesId: created.id,
            sessionDate: created.startDate,
            startAt,
            endAt: endAt ?? null,
            qrToken: generateQrToken(),
            createdBy: ctx.user!.id,
          }).onConflictDoNothing();
        }
      }
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_series_create', entityType: 'kajian_rutin_series',
          entityId: created.id, afterJson: { title: created.title, recurrence: created.recurrence }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(serializeSeries(created), { requestId: ctx.requestId }, 201, { 'Cache-Control': 'no-store' });
    })));

  router.patch('/api/kajian-rutin/series/:id', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(seriesUpdateSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID kajian rutin tidak valid.', 400, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const db = getDb();
      const [before] = await db.select().from(kajianRutinSeries).where(eq(kajianRutinSeries.id, ctx.params.id!)).limit(1);
      if (!before) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);
      const [updated] = await db.update(kajianRutinSeries).set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.speaker !== undefined ? { speaker: body.speaker || null } : {}),
        ...(body.recurrence !== undefined ? { recurrence: body.recurrence } : {}),
        ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek ?? null } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate || null } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime || null } : {}),
        ...(body.locationName !== undefined ? { locationName: body.locationName || null } : {}),
        ...(body.locationAddress !== undefined ? { locationAddress: body.locationAddress || null } : {}),
        ...(body.targetAudience !== undefined ? { targetAudience: body.targetAudience } : {}),
        ...(body.quota !== undefined ? { quota: body.quota ?? null } : {}),
        ...(body.posterUrl !== undefined ? { posterUrl: body.posterUrl || null } : {}),
        ...(body.checkInOpenMinutes !== undefined ? { checkInOpenMinutes: body.checkInOpenMinutes } : {}),
        ...(body.checkInCloseMinutes !== undefined ? { checkInCloseMinutes: body.checkInCloseMinutes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        updatedAt: new Date(),
      }).where(eq(kajianRutinSeries.id, before.id)).returning();
      if (!updated) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_series_update', entityType: 'kajian_rutin_series',
          entityId: before.id, beforeJson: { isActive: before.isActive, title: before.title },
          afterJson: { isActive: updated.isActive, title: updated.title }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(serializeSeries(updated), { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
    })));

  router.delete('/api/kajian-rutin/series/:id', requirePermission(PERMISSIONS.EVENTS_MANAGE, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian rutin tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const db = getDb();
    const [before] = await db.select().from(kajianRutinSeries).where(eq(kajianRutinSeries.id, ctx.params.id!)).limit(1);
    if (!before) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);
    await db.delete(kajianRutinSeries).where(eq(kajianRutinSeries.id, before.id));
    try {
      await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_series_delete', entityType: 'kajian_rutin_series',
        entityId: before.id, beforeJson: { title: before.title }, requestId: ctx.requestId });
    } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
    return successResponse({ deleted: true }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
  }));

  // ===================== ADMIN: SESI & QR =====================

  router.get('/api/kajian-rutin/series/:id/sessions', requirePermission(PERMISSIONS.EVENTS_VIEW, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian rutin tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const db = getDb();
    const [series] = await db.select().from(kajianRutinSeries).where(eq(kajianRutinSeries.id, ctx.params.id!)).limit(1);
    if (!series) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);
    const sessions = await db
      .select({
        session: kajianRutinSessions,
        attendanceCount: sql<number>`cast(count(${kajianRutinAttendance.id}) as int)`,
      })
      .from(kajianRutinSessions)
      .leftJoin(kajianRutinAttendance, eq(kajianRutinAttendance.sessionId, kajianRutinSessions.id))
      .where(eq(kajianRutinSessions.seriesId, series.id))
      .groupBy(kajianRutinSessions.id)
      .orderBy(desc(kajianRutinSessions.sessionDate));
    const items = sessions.map(({ session, attendanceCount }) => ({
      ...serializeSession(session),
      attendanceCount: Number(attendanceCount || 0),
    }));
    return successResponse(
      { series: serializeSeries(series), sessions: items },
      { requestId: ctx.requestId, total: items.length },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }));

  router.post('/api/kajian-rutin/series/:id/sessions', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(sessionCreateSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID kajian rutin tidak valid.', 400, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const db = getDb();
      const [series] = await db.select().from(kajianRutinSeries).where(eq(kajianRutinSeries.id, ctx.params.id!)).limit(1);
      if (!series) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);

      let sessionDate = body.sessionDate;
      if (!sessionDate) {
        // Tanpa tanggal eksplisit: pakai tanggal sesi berikutnya yang belum ada.
        let cursor = addDaysIso(wibToday(), 1);
        for (let i = 0; i < 60; i += 1) {
          if (series.dayOfWeek === null || weekdayOfIso(cursor) === series.dayOfWeek) {
            const [existing] = await db.select({ id: kajianRutinSessions.id })
              .from(kajianRutinSessions)
              .where(and(eq(kajianRutinSessions.seriesId, series.id), eq(kajianRutinSessions.sessionDate, cursor)))
              .limit(1);
            if (!existing) { sessionDate = cursor; break; }
          }
          cursor = addDaysIso(cursor, 1);
        }
        if (!sessionDate) {
          return errorResponse('VALIDATION_ERROR', 'Tanggal sesi berikutnya tidak ditemukan. Isi tanggal secara manual.', 400, ctx.requestId);
        }
      }

      const startAt = computeWibDateTime(sessionDate, series.startTime);
      if (!startAt) return errorResponse('VALIDATION_ERROR', 'Tanggal atau jam kajian tidak valid.', 400, ctx.requestId);
      const endAt = series.endTime ? computeWibDateTime(sessionDate, series.endTime) : null;

      const [created] = await db.insert(kajianRutinSessions).values({
        seriesId: series.id,
        sessionDate,
        startAt,
        endAt: endAt ?? null,
        topic: body.topic || null,
        notes: body.notes || null,
        qrToken: generateQrToken(),
        createdBy: ctx.user!.id,
      }).onConflictDoNothing().returning();
      if (!created) {
        return errorResponse('CONFLICT', `Sesi untuk tanggal ${sessionDate} sudah ada.`, 409, ctx.requestId);
      }
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_session_create', entityType: 'kajian_rutin_session',
          entityId: created.id, afterJson: { sessionDate, seriesId: series.id }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(serializeSession(created), { requestId: ctx.requestId }, 201, { 'Cache-Control': 'no-store' });
    })));

  router.post('/api/kajian-rutin/series/:id/sessions/generate', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(sessionGenerateSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID kajian rutin tidak valid.', 400, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const db = getDb();
      const [series] = await db.select().from(kajianRutinSeries).where(eq(kajianRutinSeries.id, ctx.params.id!)).limit(1);
      if (!series) return errorResponse('NOT_FOUND', 'Kajian rutin tidak ditemukan.', 404, ctx.requestId);

      const existing = await db.select({ sessionDate: kajianRutinSessions.sessionDate })
        .from(kajianRutinSessions)
        .where(eq(kajianRutinSessions.seriesId, series.id))
        .orderBy(asc(kajianRutinSessions.sessionDate));
      const existingSet = new Set(existing.map((row) => row.sessionDate));
      const requestedCount = body.count ?? 4;

      const anchor = existing[0]?.sessionDate ?? series.startDate ?? null;
      const dayOfWeek = series.dayOfWeek ?? (existing.length ? weekdayOfIso(existing[existing.length - 1]!.sessionDate) : null);
      if (dayOfWeek === null) {
        return errorResponse('VALIDATION_ERROR', 'Atur hari kajian terlebih dahulu sebelum generate sesi otomatis.', 400, ctx.requestId);
      }
      const intervalWeeks = series.recurrence === 'weekly' ? 1 : series.recurrence === 'biweekly' ? 2 : 4;

      const todayWib = wibToday();
      // Mulai mencari dari tanggal mulai seri bila masih di masa depan.
      let cursor = series.startDate && series.startDate > todayWib ? series.startDate : addDaysIso(todayWib, 1);
      const planned: string[] = [];
      for (let i = 0; i < 400 && planned.length < requestedCount; i += 1) {
        if (weekdayOfIso(cursor) === dayOfWeek) {
          const inCycle = anchor ? Math.floor(daysBetweenIso(anchor, cursor) / 7) % intervalWeeks === 0 : true;
          if (inCycle && !existingSet.has(cursor)) planned.push(cursor);
        }
        cursor = addDaysIso(cursor, 1);
      }
      if (!planned.length) {
        return errorResponse('VALIDATION_ERROR', 'Tidak menemukan tanggal baru dalam 40 hari ke depan. Coba tambah sesi manual.', 400, ctx.requestId);
      }

      const values = planned.map((sessionDate) => ({
        seriesId: series.id,
        sessionDate,
        startAt: computeWibDateTime(sessionDate, series.startTime)!,
        endAt: series.endTime ? computeWibDateTime(sessionDate, series.endTime) : null,
        qrToken: generateQrToken(),
        createdBy: ctx.user!.id,
      })).filter((row) => row.startAt instanceof Date && !Number.isNaN(row.startAt.getTime()));

      const created = await db.insert(kajianRutinSessions).values(values).onConflictDoNothing().returning();
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_sessions_generate', entityType: 'kajian_rutin_series',
          entityId: series.id, afterJson: { generated: created.length, dates: planned }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(
        { generated: created.map(serializeSession), plannedDates: planned },
        { requestId: ctx.requestId, total: created.length },
        201,
        { 'Cache-Control': 'no-store' }
      );
    })));

  router.patch('/api/kajian-rutin/sessions/:id', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(sessionUpdateSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID sesi tidak valid.', 400, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const db = getDb();
      const row = await loadSessionWithSeries(ctx.params.id!);
      if (!row) return errorResponse('NOT_FOUND', 'Sesi tidak ditemukan.', 404, ctx.requestId);
      const before = row.session;
      const series = row.series;

      // Jadwal fleksibel: tanggal/jam/lokasi/pemateri boleh berbeda dari seri.
      const effectiveDate = body.sessionDate ?? before.sessionDate;
      const effectiveStartTime = body.startTime !== undefined ? body.startTime : before.startTime;
      const seriesStartTime = effectiveStartTime || series.startTime;
      const startAt = computeWibDateTime(effectiveDate, seriesStartTime);
      if (!startAt) return errorResponse('VALIDATION_ERROR', 'Tanggal atau jam kajian tidak valid.', 400, ctx.requestId);
      const effectiveEndTime = body.endTime !== undefined ? body.endTime : before.endTime;
      const endAt = effectiveEndTime ? computeWibDateTime(effectiveDate, effectiveEndTime) : null;

      const [updated] = await db.update(kajianRutinSessions).set({
        sessionDate: effectiveDate,
        startAt,
        endAt: endAt ?? null,
        startTime: effectiveStartTime ?? null,
        endTime: effectiveEndTime ?? null,
        ...(body.locationName !== undefined ? { locationName: body.locationName || null } : {}),
        ...(body.speaker !== undefined ? { speaker: body.speaker || null } : {}),
        ...(body.topic !== undefined ? { topic: body.topic || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date(),
      }).where(eq(kajianRutinSessions.id, before.id)).returning();
      if (!updated) return errorResponse('NOT_FOUND', 'Sesi tidak ditemukan.', 404, ctx.requestId);
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_session_update', entityType: 'kajian_rutin_session',
          entityId: before.id, beforeJson: { status: before.status, sessionDate: before.sessionDate },
          afterJson: { status: updated.status, sessionDate: updated.sessionDate }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(serializeSession(updated), { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
    })));

  router.post('/api/kajian-rutin/sessions/:id/rotate-qr', requirePermission(PERMISSIONS.EVENTS_MANAGE, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID sesi tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const db = getDb();
    const [updated] = await db.update(kajianRutinSessions)
      .set({ qrToken: generateQrToken(), qrRotatedAt: new Date(), updatedAt: new Date() })
      .where(eq(kajianRutinSessions.id, ctx.params.id!))
      .returning();
    if (!updated) return errorResponse('NOT_FOUND', 'Sesi tidak ditemukan.', 404, ctx.requestId);
    try {
      await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_qr_rotate', entityType: 'kajian_rutin_session',
        entityId: updated.id, requestId: ctx.requestId });
    } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
    return successResponse(serializeSession(updated), { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
  }));

  // ===================== ADMIN: ABSENSI =====================

  router.get('/api/kajian-rutin/sessions/:id/attendance', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_SUMMARY, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID sesi tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const row = await loadSessionWithSeries(ctx.params.id!);
    if (!row) return errorResponse('NOT_FOUND', 'Sesi tidak ditemukan.', 404, ctx.requestId);
    const items = await getDb()
      .select({
        id: kajianRutinAttendance.id,
        fullName: kajianRutinAttendance.fullName,
        email: kajianRutinAttendance.email,
        phone: kajianRutinAttendance.phone,
        source: kajianRutinAttendance.source,
        status: kajianRutinAttendance.status,
        note: kajianRutinAttendance.note,
        checkInAt: kajianRutinAttendance.checkInAt,
      })
      .from(kajianRutinAttendance)
      .where(eq(kajianRutinAttendance.sessionId, row.session.id))
      .orderBy(asc(kajianRutinAttendance.checkInAt));
    const window = computeCheckInWindow(row.series, row.session.startAt, row.session.endAt);
    return successResponse(
      {
        session: serializeSession(row.session),
        series: serializeSeries(row.series),
        items: items.map((item) => ({ ...item, checkInAt: item.checkInAt.toISOString() })),
        checkInWindow: { openAt: window.openAt.toISOString(), closeAt: window.closeAt.toISOString() },
      },
      { requestId: ctx.requestId, total: items.length },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }));

  router.post('/api/kajian-rutin/sessions/:id/attendance', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE,
    validateBody(manualAttendanceSchema, async (ctx, body) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success) {
        return errorResponse('VALIDATION_ERROR', 'ID sesi tidak valid.', 400, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const row = await loadSessionWithSeries(ctx.params.id!);
      if (!row) return errorResponse('NOT_FOUND', 'Sesi tidak ditemukan.', 404, ctx.requestId);
      const db = getDb();
      const [created] = await db.insert(kajianRutinAttendance).values({
        sessionId: row.session.id,
        seriesId: row.series.id,
        googleSub: `manual:${crypto.randomUUID()}`,
        email: body.email || null,
        fullName: body.fullName,
        phone: body.phone || null,
        source: 'manual_input',
        status: 'present',
        note: body.note || null,
      }).onConflictDoNothing().returning();
      if (!created) return errorResponse('CONFLICT', 'Peserta tersebut sudah tercatat hadir pada sesi ini.', 409, ctx.requestId);
      try {
        await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_attendance_manual', entityType: 'kajian_rutin_attendance',
          entityId: created.id, afterJson: { fullName: created.fullName, sessionId: row.session.id }, requestId: ctx.requestId });
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(
        { id: created.id, fullName: created.fullName, email: created.email, checkInAt: created.checkInAt.toISOString(), source: created.source },
        { requestId: ctx.requestId },
        201,
        { 'Cache-Control': 'no-store' }
      );
    })));

  router.delete('/api/kajian-rutin/attendance/:id', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE, async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success) {
      return errorResponse('VALIDATION_ERROR', 'ID absensi tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const db = getDb();
    const [before] = await db.select().from(kajianRutinAttendance).where(eq(kajianRutinAttendance.id, ctx.params.id!)).limit(1);
    if (!before) return errorResponse('NOT_FOUND', 'Data absensi tidak ditemukan.', 404, ctx.requestId);
    await db.delete(kajianRutinAttendance).where(eq(kajianRutinAttendance.id, before.id));
    try {
      await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_attendance_delete', entityType: 'kajian_rutin_attendance',
        entityId: before.id, beforeJson: { fullName: before.fullName, sessionId: before.sessionId }, requestId: ctx.requestId });
    } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
    return successResponse({ deleted: true }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
  }));

  // ===================== ADMIN: MASTER PEMATERI / USTADZ =====================

  router.get('/api/kajian-rutin/speakers', requirePermission(PERMISSIONS.EVENTS_VIEW, async (ctx) => {
    await ensureKajianRutinTables();
    const rows = await getDb()
      .select({ id: kajianRutinSpeakers.id, name: kajianRutinSpeakers.name, notes: kajianRutinSpeakers.notes })
      .from(kajianRutinSpeakers)
      .orderBy(asc(kajianRutinSpeakers.name))
      .limit(500);
    return successResponse(rows, { requestId: ctx.requestId, total: rows.length }, 200, { 'Cache-Control': 'no-store' });
  }));

  router.post('/api/kajian-rutin/speakers', requirePermission(PERMISSIONS.EVENTS_MANAGE,
    validateBody(speakerCreateSchema, async (ctx, body) => {
      await ensureKajianRutinTables();
      const db = getDb();
      const [existing] = await db
        .select({ id: kajianRutinSpeakers.id, name: kajianRutinSpeakers.name, notes: kajianRutinSpeakers.notes })
        .from(kajianRutinSpeakers)
        .where(sql`lower(${kajianRutinSpeakers.name}) = ${body.name.toLowerCase()}`)
        .limit(1);
      if (existing) {
        return successResponse(existing, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
      }
      const [created] = await db.insert(kajianRutinSpeakers).values({
        name: body.name,
        notes: body.notes || null,
        createdBy: ctx.user!.id,
      }).onConflictDoNothing().returning({ id: kajianRutinSpeakers.id, name: kajianRutinSpeakers.name, notes: kajianRutinSpeakers.notes });
      const result = created ?? { id: '', name: body.name, notes: body.notes || null };
      try {
        if (created) {
          await logAuditEvent({ actorUserId: ctx.user!.id, action: 'kajian_rutin_speaker_create', entityType: 'kajian_rutin_speaker',
            entityId: created.id, afterJson: { name: created.name }, requestId: ctx.requestId });
        }
      } catch (error) { console.error('[Kajian Rutin Audit Error]', error); }
      return successResponse(result, { requestId: ctx.requestId }, created ? 201 : 200, { 'Cache-Control': 'no-store' });
    })));

  // ===================== PUBLIK: QR SCAN + LOGIN GOOGLE + ABSEN =====================

  router.get('/api/public/kajian-rutin/scan', async (ctx) => {
    const sessionId = ctx.query.sesi || ctx.query.sessionId || '';
    const token = ctx.query.t || ctx.query.token || '';
    if (!z.string().uuid().safeParse(sessionId).success || !token) {
      return errorResponse('VALIDATION_ERROR', 'Tautan QR tidak valid.', 400, ctx.requestId);
    }
    await ensureKajianRutinTables();
    const result = await validateQrContext(sessionId, token);
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TOKEN' ? 403 : 409;
      const code = result.code === 'NOT_FOUND' ? 'NOT_FOUND' : result.code === 'INVALID_TOKEN' ? 'FORBIDDEN' : 'CONFLICT';
      return errorResponse(code, result.message, status, ctx.requestId);
    }
    const { session, series } = result.data;
    const window = computeCheckInWindow(series, session.startAt, session.endAt);
    const now = Date.now();
    return successResponse(
      {
        session: {
          id: session.id,
          sessionDate: session.sessionDate,
          startAt: session.startAt.toISOString(),
          endAt: session.endAt ? session.endAt.toISOString() : null,
          topic: session.topic,
          status: session.status,
        },
        series: {
          id: series.id,
          title: series.title,
          speaker: series.speaker,
          locationName: series.locationName,
          startTime: series.startTime,
          endTime: series.endTime,
          posterUrl: series.posterUrl ?? null,
        },
        checkInWindow: {
          openAt: window.openAt.toISOString(),
          closeAt: window.closeAt.toISOString(),
          isOpen: now >= window.openAt.getTime() && now <= window.closeAt.getTime(),
        },
      },
      { requestId: ctx.requestId },
      200,
      { 'Cache-Control': 'no-store' }
    );
  });

  router.post('/api/public/kajian-rutin/auth/google',
    validateBody(googleAuthSchema, async (ctx, body) => {
      if (!isGoogleAuthConfigured()) {
        return errorResponse('CONFIG_MISSING', 'Login Google belum diaktifkan. Hubungi panitia/admin YTS.', 503, ctx.requestId);
      }
      await ensureKajianRutinTables();
      const ip = clientIp(ctx);
      if (ip !== 'unknown') {
        const hour = Math.floor(Date.now() / 3_600_000);
        const allowed = await consumeRateLimit(`auth:${ip}:${hour}`, 12, 2);
        if (!allowed) {
          return errorResponse('RATE_LIMITED', 'Terlalu banyak percobaan login. Coba lagi nanti.', 429, ctx.requestId);
        }
      }

      const verified = await verifyGoogleIdToken(body.credential);
      if (!verified.ok) {
        const status = verified.reason === 'CONFIG_MISSING' ? 503 : verified.reason === 'EXPIRED' ? 401 : 400;
        const code: ErrorCode =
          verified.reason === 'CONFIG_MISSING'
            ? 'CONFIG_MISSING'
            : verified.reason === 'EXPIRED'
              ? 'UNAUTHENTICATED'
              : 'VALIDATION_ERROR';
        return errorResponse(code, verified.message, status, ctx.requestId);
      }
      const profile = verified.profile;

      const db = getDb();
      const [account] = await db.insert(kajianRutinAccounts)
        .values({
          googleSub: profile.sub,
          email: profile.email,
          fullName: profile.name,
          pictureUrl: profile.picture,
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: kajianRutinAccounts.googleSub,
          set: {
            email: profile.email,
            fullName: profile.name,
            pictureUrl: profile.picture,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!account) return errorResponse('INTERNAL_ERROR', 'Akun belum dapat disimpan. Coba lagi.', 500, ctx.requestId);

      let scanContext: Record<string, unknown> | null = null;
      let scanError: string | null = null;
      if (body.sessionId) {
        if (body.token) {
          const result = await validateQrContext(body.sessionId, body.token);
          if (result.ok) {
            const { session, series } = result.data;
            const window = computeCheckInWindow(series, session.startAt, session.endAt);
            scanContext = {
              session: {
                id: session.id,
                sessionDate: session.sessionDate,
                startAt: session.startAt.toISOString(),
                endAt: session.endAt ? session.endAt.toISOString() : null,
                topic: session.topic,
                status: session.status,
              },
              series: { id: series.id, title: series.title, speaker: series.speaker, locationName: series.locationName },
              checkInWindow: {
                openAt: window.openAt.toISOString(),
                closeAt: window.closeAt.toISOString(),
                isOpen: Date.now() >= window.openAt.getTime() && Date.now() <= window.closeAt.getTime(),
              },
            };
          } else {
            scanError = result.message;
          }
        } else {
          scanError = 'Tautan QR tidak lengkap.';
        }
      }

      const alreadyAbsen = body.sessionId ? await findExistingAttendance(body.sessionId, profile.sub) : null;

      return successResponse(
        {
          token: createJamaahPortalToken({ accountId: account.id, sub: account.googleSub, email: account.email, name: account.fullName }),
          profile: {
            name: account.fullName,
            email: account.email,
            pictureUrl: account.pictureUrl,
          },
          scan: scanContext,
          scanError,
          alreadyAbsen: body.sessionId && alreadyAbsen
            ? { sessionId: body.sessionId, checkInAt: alreadyAbsen.checkInAt.toISOString() }
            : null,
        },
        { requestId: ctx.requestId },
        200,
        { 'Cache-Control': 'no-store' }
      );
    }));

  router.get('/api/public/kajian-rutin/portal/sessions', async (ctx) => {
    const session = resolveJamaahSession(ctx.headers);
    if (!session) return errorResponse('UNAUTHENTICATED', 'Silakan login dengan Google terlebih dahulu.', 401, ctx.requestId);
    await ensureKajianRutinTables();
    const db = getDb();
    const rows = await db
      .select({ session: kajianRutinSessions, series: kajianRutinSeries })
      .from(kajianRutinSessions)
      .innerJoin(kajianRutinSeries, eq(kajianRutinSessions.seriesId, kajianRutinSeries.id))
      .where(and(
        eq(kajianRutinSeries.isActive, true),
        eq(kajianRutinSessions.status, 'scheduled'),
        gte(kajianRutinSessions.startAt, new Date(Date.now() - 7 * 86_400_000))
      ))
      .orderBy(asc(kajianRutinSessions.startAt))
      .limit(80);

    const myAttendance = await db
      .select({ sessionId: kajianRutinAttendance.sessionId, checkInAt: kajianRutinAttendance.checkInAt })
      .from(kajianRutinAttendance)
      .where(eq(kajianRutinAttendance.googleSub, session.sub));
    const attendanceMap = new Map(myAttendance.map((row) => [row.sessionId, row.checkInAt.toISOString()]));

    const now = Date.now();
    const openNow: Array<Record<string, unknown>> = [];
    const upcoming: Array<Record<string, unknown>> = [];
    for (const { session: sesi, series } of rows) {
      const window = computeCheckInWindow(series, sesi.startAt, sesi.endAt);
      const item = {
        sessionId: sesi.id,
        sessionDate: sesi.sessionDate,
        startAt: sesi.startAt.toISOString(),
        endAt: sesi.endAt ? sesi.endAt.toISOString() : null,
        topic: sesi.topic,
        seriesId: series.id,
        seriesTitle: series.title,
        speaker: sesi.speaker || series.speaker,
        locationName: sesi.locationName || series.locationName,
        startTime: sesi.startTime || series.startTime,
        endTime: sesi.endTime || series.endTime,
        posterUrl: series.posterUrl ?? null,
        windowOpenAt: window.openAt.toISOString(),
        windowCloseAt: window.closeAt.toISOString(),
        isOpen: now >= window.openAt.getTime() && now <= window.closeAt.getTime(),
        alreadyAbsen: attendanceMap.get(sesi.id) || null,
      };
      if (item.isOpen) openNow.push(item);
      else if (sesi.startAt.getTime() > now && upcoming.length < 6) upcoming.push(item);
    }
    return successResponse({ openNow, upcoming }, { requestId: ctx.requestId }, 200, { 'Cache-Control': 'no-store' });
  });

  router.get('/api/public/kajian-rutin/portal/me', async (ctx) => {
    const session = resolveJamaahSession(ctx.headers);
    if (!session) return errorResponse('UNAUTHENTICATED', 'Silakan login dengan Google terlebih dahulu.', 401, ctx.requestId);
    await ensureKajianRutinTables();
    const db = getDb();
    const [account] = await db.select().from(kajianRutinAccounts).where(eq(kajianRutinAccounts.id, session.accountId)).limit(1);
    const history = await db
      .select({
        id: kajianRutinAttendance.id,
        sessionId: kajianRutinAttendance.sessionId,
        sessionDate: kajianRutinSessions.sessionDate,
        startAt: kajianRutinSessions.startAt,
        seriesTitle: kajianRutinSeries.title,
        checkInAt: kajianRutinAttendance.checkInAt,
        source: kajianRutinAttendance.source,
      })
      .from(kajianRutinAttendance)
      .innerJoin(kajianRutinSessions, eq(kajianRutinAttendance.sessionId, kajianRutinSessions.id))
      .innerJoin(kajianRutinSeries, eq(kajianRutinAttendance.seriesId, kajianRutinSeries.id))
      .where(eq(kajianRutinAttendance.googleSub, session.sub))
      .orderBy(desc(kajianRutinAttendance.checkInAt))
      .limit(20);
    return successResponse(
      {
        profile: {
          name: account?.fullName || session.name,
          email: account?.email || session.email,
          pictureUrl: account?.pictureUrl || null,
          gender: account?.gender ?? null,
          cityRegency: account?.cityRegency ?? null,
          province: account?.province ?? null,
          educationLevel: account?.educationLevel ?? null,
        },
        totalAbsen: history.length,
        history: history.map((row) => ({
          ...row,
          startAt: row.startAt.toISOString(),
          checkInAt: row.checkInAt.toISOString(),
        })),
      },
      { requestId: ctx.requestId },
      200,
      { 'Cache-Control': 'no-store' }
    );
  });

  // ---- Perbarui profil jamaah (nama, domisili, gender, pendidikan terakhir) ----

  router.patch('/api/public/kajian-rutin/portal/profile',
    validateBody(portalProfileSchema, async (ctx, body) => {
      const session = resolveJamaahSession(ctx.headers);
      if (!session) return errorResponse('UNAUTHENTICATED', 'Silakan login dengan Google terlebih dahulu.', 401, ctx.requestId);
      await ensureKajianRutinTables();
      const db = getDb();
      const [updated] = await db.update(kajianRutinAccounts).set({
        ...(body.fullName !== undefined && body.fullName ? { fullName: body.fullName } : {}),
        ...(body.cityRegency !== undefined ? { cityRegency: body.cityRegency || null } : {}),
        ...(body.province !== undefined ? { province: body.province || null } : {}),
        ...(body.gender !== undefined ? { gender: body.gender || null } : {}),
        ...(body.educationLevel !== undefined ? { educationLevel: body.educationLevel || null } : {}),
        updatedAt: new Date(),
      }).where(eq(kajianRutinAccounts.id, session.accountId)).returning();
      if (!updated) return errorResponse('NOT_FOUND', 'Akun tidak ditemukan.', 404, ctx.requestId);
      return successResponse(
        {
          profile: {
            name: updated.fullName,
            email: updated.email,
            pictureUrl: updated.pictureUrl,
            gender: updated.gender,
            cityRegency: updated.cityRegency,
            province: updated.province,
            educationLevel: updated.educationLevel,
          },
        },
        { requestId: ctx.requestId },
        200,
        { 'Cache-Control': 'no-store' }
      );
    }));

  router.post('/api/public/kajian-rutin/portal/absen',
    validateBody(portalAbsenSchema, async (ctx, body) => {
      const session = resolveJamaahSession(ctx.headers);
      if (!session) return errorResponse('UNAUTHENTICATED', 'Sesi berakhir. Silakan login ulang dengan Google.', 401, ctx.requestId);
      await ensureKajianRutinTables();
      const ip = clientIp(ctx);
      if (ip !== 'unknown') {
        const hour = Math.floor(Date.now() / 3_600_000);
        const allowed = await consumeRateLimit(`absen:${session.sub}:${hour}`, 30, 2);
        if (!allowed) {
          return errorResponse('RATE_LIMITED', 'Terlalu banyak permintaan absen. Tunggu beberapa saat.', 429, ctx.requestId);
        }
      }

      const row = await loadSessionWithSeries(body.sessionId);
      if (!row) return errorResponse('NOT_FOUND', 'Sesi kajian tidak ditemukan.', 404, ctx.requestId);
      const { session: sesi, series } = row;
      if (!series.isActive || sesi.status === 'cancelled') {
        return errorResponse('FORBIDDEN', 'Absensi kajian ini sedang ditutup panitia.', 403, ctx.requestId);
      }
      if (body.token && sesi.qrToken !== body.token) {
        return errorResponse('FORBIDDEN', 'QR tidak valid atau sudah diganti panitia. Minta QR terbaru.', 403, ctx.requestId);
      }

      const window = computeCheckInWindow(series, sesi.startAt, sesi.endAt);
      const now = new Date();
      if (now < window.openAt || now > window.closeAt) {
        return errorResponse(
          'FORBIDDEN',
          now < window.openAt
            ? `Absensi kajian ini belum dibuka. Pendaftaran hadir bisa dilakukan mulai ${formatWibWindow(window.openAt)}. Sampai jumpa di kajian!`
            : `Absensi kajian ini sudah ditutup pada ${formatWibWindow(window.closeAt)}. Sampai jumpa di kajian berikutnya!`,
          403,
          ctx.requestId
        );
      }

      const existing = await findExistingAttendance(sesi.id, session.sub);
      if (existing) {
        return successResponse(
          { alreadyAbsen: true, attendance: { id: existing.id, checkInAt: existing.checkInAt.toISOString(), source: existing.source } },
          { requestId: ctx.requestId },
          200,
          { 'Cache-Control': 'no-store' }
        );
      }

      const db = getDb();
      // Ambil profil terbaru dari database agar perubahan profil langsung terpakai.
      const account = await getAccountById(session.accountId);
      const attendeeName = account?.fullName || session.name;
      const [created] = await db.insert(kajianRutinAttendance).values({
        sessionId: sesi.id,
        seriesId: series.id,
        accountId: session.accountId,
        googleSub: session.sub,
        email: session.email.toLowerCase(),
        fullName: attendeeName,
        source: body.token ? 'qr_self_scan' : 'portal_self_scan',
        status: 'present',
        note: body.deviceInfo || null,
      }).onConflictDoNothing().returning();
      if (!created) {
        const again = await findExistingAttendance(sesi.id, session.sub);
        return successResponse(
          { alreadyAbsen: true, attendance: again ? { id: again.id, checkInAt: again.checkInAt.toISOString(), source: again.source } : null },
          { requestId: ctx.requestId },
          200,
          { 'Cache-Control': 'no-store' }
        );
      }
      // Catat peserta ke Direktori Jamaah (cocok lewat email, buat baru bila belum ada).
      await syncPersonFromJamaah({
        fullName: attendeeName,
        email: session.email.toLowerCase(),
        gender: account?.gender ?? null,
        cityRegency: account?.cityRegency ?? null,
        province: account?.province ?? null,
        educationLevel: account?.educationLevel ?? null,
      });
      return successResponse(
        {
          alreadyAbsen: false,
          attendance: { id: created.id, checkInAt: created.checkInAt.toISOString(), source: created.source },
          session: { id: sesi.id, sessionDate: sesi.sessionDate, startAt: sesi.startAt.toISOString(), topic: sesi.topic },
          series: { id: series.id, title: series.title, speaker: series.speaker, locationName: series.locationName },
        },
        { requestId: ctx.requestId },
        201,
        { 'Cache-Control': 'no-store' }
      );
    }));

  // ---- Portal daurah: daftar event + status tiket saya ----

  router.get('/api/public/kajian-rutin/portal/daurah', async (ctx) => {
    const session = resolveJamaahSession(ctx.headers);
    if (!session) return errorResponse('UNAUTHENTICATED', 'Silakan login dengan Google terlebih dahulu.', 401, ctx.requestId);
    const db = getDb();
    const email = session.email.toLowerCase();

    const upcoming = await db
      .select({
        id: events.id,
        title: events.title,
        speaker: events.speaker,
        startAt: events.startAt,
        endAt: events.endAt,
        locationName: events.locationName,
        deliveryMode: events.deliveryMode,
        targetAudience: events.targetAudience,
        isRegistrationOpen: events.isRegistrationOpen,
        status: events.status,
      })
      .from(events)
      .where(and(
        inArray(events.status, ['scheduled', 'ongoing']),
        gte(events.startAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      ))
      .orderBy(asc(events.startAt))
      .limit(15);

    const personIds = await resolvePersonIdsByEmail(email);
    const eventIds = upcoming.map((event) => event.id);
    const myRows = eventIds.length
      ? await db
          .select({
            id: eventAttendance.id,
            eventId: eventAttendance.eventId,
            ticketCode: eventAttendance.ticketCode,
            status: eventAttendance.status,
            checkInAt: eventAttendance.checkInAt,
          })
          .from(eventAttendance)
          .where(and(inArray(eventAttendance.eventId, eventIds), daurahMatchCondition(personIds, email)))
      : [];
    const ticketByEvent = new Map<string, (typeof myRows)[number]>();
    for (const row of myRows) {
      const existing = ticketByEvent.get(row.eventId);
      if (!existing || row.checkInAt.getTime() > existing.checkInAt.getTime()) {
        ticketByEvent.set(row.eventId, row);
      }
    }

    const now = Date.now();
    const items = upcoming.map((event) => {
      const ticket = ticketByEvent.get(event.id) || null;
      const window = computeDaurahCheckInWindow(event.startAt, event.endAt);
      return {
        id: event.id,
        title: event.title,
        speaker: event.speaker,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt ? event.endAt.toISOString() : null,
        locationName: event.locationName,
        deliveryMode: event.deliveryMode,
        targetAudience: event.targetAudience,
        isRegistrationOpen: event.isRegistrationOpen,
        status: event.status,
        myTicket: ticket
          ? {
              id: ticket.id,
              ticketCode: ticket.ticketCode,
              status: ticket.status,
              checkInAt: ticket.checkInAt ? ticket.checkInAt.toISOString() : null,
            }
          : null,
        canSelfCheckin:
          Boolean(ticket) && now >= window.openAt.getTime() && now <= window.closeAt.getTime(),
        windowOpenAt: window.openAt.toISOString(),
        windowCloseAt: window.closeAt.toISOString(),
      };
    });

    const history = await db
      .select({
        id: eventAttendance.id,
        eventId: events.id,
        title: events.title,
        eventStartAt: events.startAt,
        ticketCode: eventAttendance.ticketCode,
        checkInAt: eventAttendance.checkInAt,
      })
      .from(eventAttendance)
      .innerJoin(events, eq(eventAttendance.eventId, events.id))
      .where(and(daurahMatchCondition(personIds, email), eq(eventAttendance.status, 'attended'), sql`${events.startAt} < now()`))
      .orderBy(desc(eventAttendance.checkInAt))
      .limit(8);

    return successResponse(
      {
        events: items,
        history: history.map((row) => ({
          id: row.id,
          eventId: row.eventId,
          title: row.title,
          eventStartAt: row.eventStartAt.toISOString(),
          ticketCode: row.ticketCode,
          checkInAt: row.checkInAt ? row.checkInAt.toISOString() : null,
        })),
      },
      { requestId: ctx.requestId, total: items.length },
      200,
      { 'Cache-Control': 'no-store' }
    );
  });

  // ---- Portal daurah: absen mandiri (check-in) pada event terdaftar ----

  router.post('/api/public/kajian-rutin/portal/absen-daurah',
    validateBody(portalAbsenDaurahSchema, async (ctx, body) => {
      const session = resolveJamaahSession(ctx.headers);
      if (!session) return errorResponse('UNAUTHENTICATED', 'Sesi berakhir. Silakan login ulang dengan Google.', 401, ctx.requestId);
      await ensureKajianRutinTables();
      const ip = clientIp(ctx);
      if (ip !== 'unknown') {
        const hour = Math.floor(Date.now() / 3_600_000);
        const allowed = await consumeRateLimit(`absen-daurah:${session.sub}:${hour}`, 30, 2);
        if (!allowed) {
          return errorResponse('RATE_LIMITED', 'Terlalu banyak permintaan absen. Tunggu beberapa saat.', 429, ctx.requestId);
        }
      }

      const db = getDb();
      const [event] = await db
        .select({
          id: events.id,
          title: events.title,
          speaker: events.speaker,
          startAt: events.startAt,
          endAt: events.endAt,
          locationName: events.locationName,
          status: events.status,
        })
        .from(events)
        .where(eq(events.id, body.eventId))
        .limit(1);
      if (!event) return errorResponse('NOT_FOUND', 'Kajian daurah tidak ditemukan.', 404, ctx.requestId);
      if (event.status === 'cancelled') {
        return errorResponse('FORBIDDEN', 'Kajian ini telah dibatalkan panitia.', 403, ctx.requestId);
      }

      const window = computeDaurahCheckInWindow(event.startAt, event.endAt);
      const now = new Date();
      if (now < window.openAt || now > window.closeAt) {
        return errorResponse(
          'FORBIDDEN',
          now < window.openAt
            ? `Absensi kajian ini belum dibuka. Check-in bisa dilakukan mulai ${formatWibWindow(window.openAt)}.`
            : `Absensi kajian ini sudah ditutup pada ${formatWibWindow(window.closeAt)}. Sampai jumpa di kajian berikutnya!`,
          403,
          ctx.requestId
        );
      }

      const email = session.email.toLowerCase();
      const personIds = await resolvePersonIdsByEmail(email);
      const [mine] = await db
        .select()
        .from(eventAttendance)
        .where(and(eq(eventAttendance.eventId, event.id), daurahMatchCondition(personIds, email)))
        .orderBy(desc(eventAttendance.checkInAt))
        .limit(1);
      if (!mine) {
        return errorResponse(
          'NOT_FOUND',
          `Anda belum terdaftar pada “${event.title}” dengan email ${email}. Silakan daftar terlebih dahulu lewat halaman kajian, atau gunakan email yang sama saat mendaftar.`,
          404,
          ctx.requestId
        );
      }
      if (mine.status === 'attended') {
        return successResponse(
          {
            alreadyAbsen: true,
            attendance: { id: mine.id, ticketCode: mine.ticketCode, checkInAt: (mine.checkInAt ?? now).toISOString() },
          },
          { requestId: ctx.requestId },
          200,
          { 'Cache-Control': 'no-store' }
        );
      }

      const existingRegData = (mine.registrationData as Record<string, unknown>) || {};
      const [updated] = await db
        .update(eventAttendance)
        .set({
          status: 'attended',
          checkInAt: now,
          registrationData: {
            ...existingRegData,
            selfCheckinAt: now.toISOString(),
            selfCheckinPortal: 'kajian-rutin',
          },
        })
        .where(eq(eventAttendance.id, mine.id))
        .returning();
      if (!updated) return errorResponse('INTERNAL_ERROR', 'Gagal menyimpan absensi. Coba lagi.', 500, ctx.requestId);

      return successResponse(
        {
          alreadyAbsen: false,
          attendance: { id: updated.id, ticketCode: updated.ticketCode, checkInAt: now.toISOString() },
          event: {
            id: event.id,
            title: event.title,
            speaker: event.speaker,
            startAt: event.startAt.toISOString(),
            locationName: event.locationName,
          },
        },
        { requestId: ctx.requestId },
        201,
        { 'Cache-Control': 'no-store' }
      );
    }));
}
