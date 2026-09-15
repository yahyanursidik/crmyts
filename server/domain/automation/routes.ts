import crypto from 'crypto';
import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  events,
  eventAttendance,
  donations,
  donationPrograms,
  waqfCases,
  interactions,
  tasks,
  emailCampaigns,
  emailBlacklist,
  DripRecipient,
  DripCampaignStats,
} from '../../db/schema';
import { asc, eq, and, desc, gte, isNotNull, ne, sql, or } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';
import { sendEmail, renderEmailLayout } from '../../email/service';
import { getBroadcastDailyQuota, reserveBroadcastEmailSlot } from '../../email/broadcastQuota';
import { formatEventDateTimeWib } from '../events/emailNotifications';

export type { DripRecipient, DripCampaignStats };

export interface DripEmailCampaign {
  id: string;
  title: string;
  subject: string;
  bodyHtml: string;
  dailyQuota: number;
  totalDays: number;
  currentDay: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  filterGender: 'all' | 'ikhwan' | 'akhwat';
  createdAt: string;
  updatedAt: string;
  lastDispatchedAt?: string | null;
  stats: DripCampaignStats;
  recipients: DripRecipient[];
}

export const DEFAULT_CAMPAIGN_ID = '00000000-0000-7000-8000-000000000001';

/**
 * Ensures email_campaigns table exists and seeds the default warm-up campaign if empty.
 * Runs idempotently across serverless cold starts.
 */
const memoryFallbackCampaigns = new Map<string, DripEmailCampaign>();

/**
 * In-memory fallback and helper utilities for Global Email Blacklist & Suppression Registry.
 */
const memoryFallbackBlacklist = new Map<string, {
  id: string;
  email: string;
  reason: string;
  notes?: string | null;
  sourceCampaignId?: string | null;
  personId?: string | null;
  createdAt: string;
}>();

export async function ensureEmailBlacklistTable(db: any): Promise<void> {
  try {
    if (typeof db.execute === 'function') {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_blacklist (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text NOT NULL,
          reason text DEFAULT 'already_sent' NOT NULL,
          notes text,
          source_campaign_id uuid,
          person_id uuid,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          created_by uuid REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_email_blacklist_email ON email_blacklist(email);
        CREATE INDEX IF NOT EXISTS idx_email_blacklist_reason ON email_blacklist(reason);
        CREATE INDEX IF NOT EXISTS idx_email_blacklist_created_at ON email_blacklist(created_at);
      `);
    }
  } catch {
    // Soft fail for unit test mocks
  }
}

export async function getBlacklistedEmailsSet(db: any): Promise<Set<string>> {
  const set = new Set<string>();
  for (const email of memoryFallbackBlacklist.keys()) {
    set.add(email.toLowerCase().trim());
  }

  if (db.query?.emailBlacklist?.findMany) {
    try {
      const rows = await db.query.emailBlacklist.findMany({
        columns: { email: true },
      });
      for (const r of rows) {
        if (r.email) set.add(r.email.toLowerCase().trim());
      }
    } catch {
      // Soft fail
    }
  }
  return set;
}

export async function addEmailToBlacklist(
  db: any,
  params: {
    email: string;
    reason?: string;
    notes?: string | null;
    sourceCampaignId?: string | null;
    personId?: string | null;
    userId?: string | null;
  }
): Promise<any> {
  const cleanEmail = params.email.toLowerCase().trim();
  const newId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const entry = {
    id: newId,
    email: cleanEmail,
    reason: params.reason || 'already_sent',
    notes: params.notes || null,
    sourceCampaignId: params.sourceCampaignId || null,
    personId: params.personId || null,
    createdAt: nowIso,
  };

  memoryFallbackBlacklist.set(cleanEmail, entry);

  if (db.insert && db.query?.emailBlacklist) {
    try {
      await db.insert(emailBlacklist).values({
        ...entry,
        createdAt: new Date(),
        createdBy: params.userId || null,
      });
    } catch (err) {
      console.warn('[Add Email Blacklist Warn]:', err);
    }
  }
  return entry;
}

export async function removeEmailFromBlacklist(db: any, idOrEmail: string): Promise<boolean> {
  const clean = idOrEmail.toLowerCase().trim();
  memoryFallbackBlacklist.delete(clean);
  for (const [k, v] of memoryFallbackBlacklist.entries()) {
    if (v.id === idOrEmail) {
      memoryFallbackBlacklist.delete(k);
    }
  }

  if (db.delete && db.query?.emailBlacklist) {
    try {
      await db.delete(emailBlacklist).where(
        or(eq(emailBlacklist.id, idOrEmail), eq(emailBlacklist.email, clean))
      );
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export async function ensureEmailCampaignsTableAndSeed(db: any): Promise<void> {
  await ensureEmailBlacklistTable(db);
  // 1. Ensure table exists (safeguard for serverless or fresh DB instances)
  try {
    if (typeof db.execute === 'function') {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_campaigns (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title text NOT NULL,
          subject text NOT NULL,
          body_html text NOT NULL,
          daily_quota integer DEFAULT 50 NOT NULL,
          total_days integer DEFAULT 14 NOT NULL,
          current_day integer DEFAULT 1 NOT NULL,
          status text DEFAULT 'running' NOT NULL,
          filter_gender text DEFAULT 'all' NOT NULL,
          stats jsonb NOT NULL,
          recipients jsonb NOT NULL,
          last_dispatched_at timestamp with time zone,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL,
          created_by uuid REFERENCES app_users(id)
        );
      `);
    }
  } catch (tableErr) {
    // Soft fail for unit test mocks without raw execute
  }

  // 2. Check if any campaigns exist in DB
  if (db.query?.emailCampaigns?.findMany) {
    try {
      const existing = await db.query.emailCampaigns.findMany({ limit: 1 });
      if (existing && existing.length > 0) {
        return;
      }
    } catch {
      // Fallback
    }
  } else if (memoryFallbackCampaigns.size > 0) {
    return;
  }

  // 3. Seed default 14-day warm-up campaign with verified real jamaah emails (397 email asli)
  try {
    const eligiblePersons = db.query?.persons?.findMany
      ? await db.query.persons.findMany({
          where: and(isNotNull(persons.email), ne(persons.email, '')),
          orderBy: [desc(persons.createdAt)],
        })
      : [];

    const blacklistedSet = await getBlacklistedEmailsSet(db);
    const seedRecipients: DripRecipient[] = eligiblePersons
      .filter((p: any) => Boolean(p.email && p.email.trim().includes('@')))
      .map((p: any) => {
        const cleanEmail = p.email!.trim().toLowerCase();
        const isBlacklisted = blacklistedSet.has(cleanEmail);
        return {
          personId: p.id,
          fullName: p.fullName,
          email: p.email!.trim(),
          gender: p.gender,
          cityRegency: p.cityRegency || 'Kota Bandung',
          status: isBlacklisted ? ('blacklisted' as const) : ('pending' as const),
          sentAt: null,
          dayNumber: null,
          error: isBlacklisted ? 'Dilewati: Terdaftar di Blacklist / Sudah pernah terkirim' : null,
        };
      });

    const nowIso = new Date().toISOString();
    const defaultCampaign: DripEmailCampaign = {
      id: DEFAULT_CAMPAIGN_ID,
      title: 'Program Sapaan Ukhuwah & Kabar Majelis Jamaah (Drip 14 Hari)',
      subject: 'Bismillah, Salam Hangat & Doa Kebaikan dari Yayasan Tarbiyah Sunnah',
      bodyHtml: `
<p>Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>
<p>Semoga <strong>{{genderTitle}} {{fullName}}</strong> beserta seluruh keluarga senantiasa berada dalam lindungan, taufik, dan rahmat Allah Ta'ala di <em>{{city}}</em>.</p>
<p>Alhamdulillah, kami dari Pengurus Yayasan Tarbiyah Sunnah (YTS) Bandung ingin menyampaikan salam ukhuwah serta ucapan <em>jazakumullahu khairan katsiran</em> atas kebersamaan dan dukungan Antum dalam berbagai majelis ilmu syar'i dan dakwah sunnah selama ini.</p>
<div class="card">
  <h3 style="margin-top: 0; color: #1c321d; font-size: 15px;">🌟 Kabar & Agenda Terdekat Yayasan Tarbiyah Sunnah:</h3>
  <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.8;">
    <li>Kajian Rutin Akhir Pekan Masjid Tarbiyah Sunnah bersama Asatidzah Pembina</li>
    <li>Pengembangan Sarana Dakwah & Pengelolaan Aset Wakaf Umat</li>
    <li>Program Ta'awun Sosial & Santunan Dhuafa Binaan Yayasan</li>
  </ul>
</div>
<p>Mari kita saling mendoakan agar Allah Ta'ala meneguhkan langkah kita di atas jalan kebenaran dan memudahkan kita dalam mengamalkan ilmu syar'i yang bermanfaat.</p>
<p>Bila ada masukan atau aspirasi untuk dakwah YTS, silakan balas email ini atau hubungi layanan jamaah kami.</p>
<p style="margin-top: 24px;"><em>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</em><br><strong>Tim Layanan Jamaah & Hubungan Umat<br>Yayasan Tarbiyah Sunnah Bandung</strong></p>
      `.trim(),
      dailyQuota: 50,
      totalDays: 14,
      currentDay: 1,
      status: 'running',
      filterGender: 'all',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastDispatchedAt: null,
      stats: {
        totalRecipients: seedRecipients.length,
        totalSent: 0,
        totalFailed: 0,
        totalBlacklisted: seedRecipients.filter((r) => r.status === 'blacklisted').length,
        remaining: seedRecipients.filter((r) => r.status === 'pending').length,
        dailySentToday: 0,
      },
      recipients: seedRecipients,
    };

    memoryFallbackCampaigns.set(DEFAULT_CAMPAIGN_ID, defaultCampaign);

    if (db.insert && db.query?.emailCampaigns) {
      try {
        await db.insert(emailCampaigns).values({
          ...defaultCampaign,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (seedErr) {
        // Soft fail for unit test mocks without insert
      }
    }
  } catch (seedErr) {
    console.warn('[Auto-seed Email Campaign Warn]:', seedErr);
  }
}

async function findCampaign(db: any, campaignId: string): Promise<DripEmailCampaign | null> {
  if (db.query?.emailCampaigns?.findFirst) {
    try {
      const found = await db.query.emailCampaigns.findFirst({
        where: eq(emailCampaigns.id, campaignId),
      });
      if (found) {
        return {
          ...found,
          createdAt: found.createdAt instanceof Date ? found.createdAt.toISOString() : found.createdAt,
          updatedAt: found.updatedAt instanceof Date ? found.updatedAt.toISOString() : found.updatedAt,
          lastDispatchedAt: found.lastDispatchedAt instanceof Date ? found.lastDispatchedAt.toISOString() : found.lastDispatchedAt,
        };
      }
    } catch {
      // Soft fail
    }
  }

  const mem = memoryFallbackCampaigns.get(campaignId);
  if (mem) return mem;

  if (campaignId === DEFAULT_CAMPAIGN_ID) {
    await ensureEmailCampaignsTableAndSeed(db);
    if (db.query?.emailCampaigns?.findFirst) {
      try {
        const found = await db.query.emailCampaigns.findFirst({
          where: eq(emailCampaigns.id, campaignId),
        });
        if (found) {
          return {
            ...found,
            createdAt: found.createdAt instanceof Date ? found.createdAt.toISOString() : found.createdAt,
            updatedAt: found.updatedAt instanceof Date ? found.updatedAt.toISOString() : found.updatedAt,
            lastDispatchedAt: found.lastDispatchedAt instanceof Date ? found.lastDispatchedAt.toISOString() : found.lastDispatchedAt,
          };
        }
      } catch {}
    }
    return memoryFallbackCampaigns.get(DEFAULT_CAMPAIGN_ID) || null;
  }

  return null;
}

async function saveCampaign(db: any, campaign: DripEmailCampaign): Promise<void> {
  memoryFallbackCampaigns.set(campaign.id, campaign);
  if (db.update && db.query?.emailCampaigns) {
    try {
      await db.update(emailCampaigns).set({
        title: campaign.title,
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        dailyQuota: campaign.dailyQuota,
        totalDays: campaign.totalDays,
        currentDay: campaign.currentDay,
        status: campaign.status,
        filterGender: campaign.filterGender,
        stats: campaign.stats,
        recipients: campaign.recipients,
        lastDispatchedAt: campaign.lastDispatchedAt ? new Date(campaign.lastDispatchedAt) : null,
        updatedAt: new Date(),
      }).where(eq(emailCampaigns.id, campaign.id));
    } catch {
      // Soft fail for mocked DB without update method
    }
  }
}

async function insertCampaign(db: any, campaign: DripEmailCampaign, userId?: string): Promise<void> {
  memoryFallbackCampaigns.set(campaign.id, campaign);
  if (db.insert && db.query?.emailCampaigns) {
    try {
      await db.insert(emailCampaigns).values({
        ...campaign,
        createdAt: new Date(campaign.createdAt),
        updatedAt: new Date(campaign.updatedAt),
        lastDispatchedAt: campaign.lastDispatchedAt ? new Date(campaign.lastDispatchedAt) : null,
        createdBy: userId,
      });
    } catch {
      // Soft fail for mocked DB without insert method
    }
  }
}

async function deleteCampaign(db: any, campaignId: string): Promise<void> {
  memoryFallbackCampaigns.delete(campaignId);
  if (db.delete && db.query?.emailCampaigns) {
    try {
      await db.delete(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
    } catch {}
  }
}

const createEmailCampaignSchema = z.object({
  title: z.string().min(3, 'Nama program kampanye wajib diisi'),
  subject: z.string().min(5, 'Subjek email wajib diisi'),
  bodyHtml: z.string().min(10, 'Isi draf email wajib diisi'),
  dailyQuota: z.coerce.number().int().min(5).max(400).default(50),
  totalDays: z.coerce.number().int().min(1).max(60).default(14),
  filterGender: z.enum(['all', 'ikhwan', 'akhwat']).default('all'),
  targetScope: z.enum(['all_jamaah', 'email_only']).default('all_jamaah'),
  excludeBlacklisted: z.boolean().default(true),
});

const createEmailBlacklistSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  reason: z.enum(['already_sent', 'manual_blacklist', 'bounced', 'unsubscribed', 'complaint']).default('manual_blacklist'),
  notes: z.string().max(500).optional(),
});

const updateEmailCampaignSchema = z.object({
  title: z.string().min(3, 'Nama program kampanye wajib diisi').optional(),
  subject: z.string().min(5, 'Subjek email wajib diisi').optional(),
  bodyHtml: z.string().min(10, 'Isi draf email wajib diisi').optional(),
  dailyQuota: z.coerce.number().int().min(5).max(400).optional(),
  totalDays: z.coerce.number().int().min(1).max(60).optional(),
});

const testEmailCampaignSchema = z.object({
  testEmail: z.string().email('Format email penerima tes tidak valid'),
});

const logOutreachSchema = z.object({
  personId: z.string().uuid(),
  channel: z.enum(['whatsapp', 'email', 'phone_call', 'in_person']).default('whatsapp'),
  category: z.string().min(2),
  summary: z.string().min(3),
  message: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
});

const triggerBatchReminderSchema = z.object({
  eventId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerAttendanceThanksSchema = z.object({
  eventId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerDonationThanksSchema = z.object({
  donationId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerWaqfFollowupSchema = z.object({
  waqfCaseId: z.string().uuid(),
  nextStepNotes: z.string().optional().nullable(),
});

const triggerProgramReportSchema = z.object({
  programId: z.string().uuid(),
  reportTitle: z.string().min(3),
  reportSummary: z.string().min(10),
  documentationUrl: z.string().url().optional().nullable(),
});

const sendInactiveGreetingSchema = z.object({
  personId: z.string().uuid(),
  templateType: z.enum(['kabar_doa', 'undangan_kajian', 'tabayyun_taawun', 'custom']).default('kabar_doa'),
  message: z.string().min(5),
  createFollowupTask: z.boolean().default(false),
  taskTitle: z.string().optional().nullable(),
  taskDueDate: z.string().optional().nullable(),
});

export function registerAutomationRoutes(router: Router) {
  // 1. GET /api/automation/templates
  router.get(
    '/api/automation/templates',
    requireAuth(async (ctx) => {
      const templates = [
        {
          id: 'event_reminder',
          name: 'Pengingat Kajian & Tabligh Akbar (H-1 / H-Day)',
          category: 'Kajian & Dakwah',
          description: 'Mengirimkan pesan pengingat jadwal, tema kajian, pemateri, dan tautan live streaming kepada jamaah.',
          variables: ['{{namaJamaah}}', '{{judulKajian}}', '{{pemateri}}', '{{waktuKajian}}', '{{tempatMode}}', '{{linkStreaming}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaJamaah}},\n\nMengingatkan kembali agenda kajian berkah Yayasan Tarbiyah Sunnah:\n\n📖 *{{judulKajian}}*\n🎙️ Pemateri: *{{pemateri}}*\n📅 Waktu: *{{waktuKajian}}*\n📍 Tempat/Mode: *{{tempatMode}}*\n🔗 Link Streaming: {{linkStreaming}}\n\nSemoga Allah meringankan langkah kita menuntut ilmu syar'i. Ditunggu kehadirannya, barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'attendance_thanks',
          name: 'Ucapan Pasca-Kehadiran & Doa Istiqomah Mengamalkan Ilmu',
          category: 'Kajian & Dakwah',
          description: 'Dikirimkan kepada jamaah yang telah hadir di kajian sore/hari ini untuk mendoakan keistiqomahan dalam mengamalkan ilmu yang didapat.',
          variables: ['{{namaJamaah}}', '{{judulKajian}}', '{{pemateri}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaJamaah}},\n\nAlhamdulillah, terima kasih banyak atas kehadiran Bapak/Ibu pada kajian:\n📖 *{{judulKajian}}*\n🎙️ Pemateri: *{{pemateri}}*\n\nMari kita berdoa semoga Allah Ta'ala meneguhkan hati kita di atas istiqomah menuntut ilmu syar'i dan memudahkan kita dalam mengamalkan ilmu-ilmu yang telah didapat.\n\nSampai bertemu di majelis ilmu berikutnya. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'donation_thanks',
          name: 'Ucapan Terima Kasih & Bukti Sah Donasi (E-Receipt)',
          category: 'Keuangan & Infaq',
          description: 'Otomatis dibuat saat donasi terverifikasi oleh Finance sebagai tanda bukti sah dan doa keberkahan.',
          variables: ['{{namaDonatur}}', '{{nominalRupiah}}', '{{namaProgram}}', '{{tanggalDonasi}}', '{{kodeTransaksi}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAlhamdulillah, donasi/infaq Bapak/Ibu {{namaDonatur}} telah kami terima dan diverifikasi secara sah:\n\n💰 *Nominal*: Rp {{nominalRupiah}}\n📌 *Program*: {{namaProgram}}\n📅 *Tanggal*: {{tanggalDonasi}}\n🧾 *No. Ref*: #{{kodeTransaksi}}\n\n_Jazakumullahu khairan katsiran_ atas kepercayaannya menyalurkan infaq melalui Yayasan Tarbiyah Sunnah. Semoga Allah menjadikannya amal jariyah pemberat timbangan kebaikan di yaumil akhir, melapangkan rezeki, dan memberkahi keluarga. Aamiin ya Rabbal 'Alamin.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'waqf_followup',
          name: 'Follow-Up Progres Tahapan Wakaf Aset',
          category: 'Wakaf & Aset Umat',
          description: 'Mengabarkan perkembangan proses legalitas, ikrar wakaf (AIW), sertifikasi BPN, atau pengelolaan aset kepada Waqif.',
          variables: ['{{namaWaqif}}', '{{jenisWakaf}}', '{{tahapanSaatIni}}', '{{catatanProgres}}', '{{namaAmil}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaWaqif}},\n\nSemoga Bapak/Ibu senantiasa dalam lindungan dan rahmat Allah Ta'ala. Kami dari Divisi Wakaf Yayasan Tarbiyah Sunnah mengabarkan progres pengelolaan aset wakaf *{{jenisWakaf}}*:\n\n📍 *Status Tahapan*: {{tahapanSaatIni}}\n📝 *Catatan Perkembangan*: {{catatanProgres}}\n\nInsya Allah amil kami ({{namaAmil}}) akan terus mengawal proses ini hingga tuntas dan bermanfaat bagi kaum muslimin. Terima kasih atas amanah mulia ini, barakallahu fiikum.\n\n— Tim Wakaf Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'program_report',
          name: 'Laporan Penyaluran & Dampak Program Donasi',
          category: 'Akuntabilitas & Stewardship',
          description: 'Laporan berkala realisasi penyaluran dana infaq beserta dokumentasi foto/kegiatan kepada para donatur program.',
          variables: ['{{namaDonatur}}', '{{namaProgram}}', '{{judulLaporan}}', '{{ringkasanPenyaluran}}', '{{linkDokumentasi}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Sahabat Kebaikan {{namaDonatur}},\n\nAlhamdulillah, berikut kami sampaikan laporan berkala penyaluran program *{{namaProgram}}*:\n\n📊 *{{judulLaporan}}*\n{{ringkasanPenyaluran}}\n\n📸 Dokumentasi & Laporan Lengkap: {{linkDokumentasi}}\n\nSemoga setiap rupiah yang diinfaqkan terus mengalirkan pahala kebaikan yang tiada putus. _Jazakumullahu khairan katsiran_.\n\n— Yayasan Tarbiyah Sunnah`,
        },
      ];

      return successResponse(templates, { requestId: ctx.requestId });
    })
  );

  // 2. POST /api/automation/trigger-event-reminder (Batch Reminders Before Event)
  router.post(
    '/api/automation/trigger-event-reminder',
    requireAuth(
      validateBody(triggerBatchReminderSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const event = await db.query.events.findFirst({
          where: eq(events.id, body.eventId),
        });

        if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);

        // Fetch attendees registered for this specific event
        const attendances = db.query?.eventAttendance?.findMany
          ? await db.query.eventAttendance.findMany({
              where: eq(eventAttendance.eventId, event.id),
              with: { person: true },
            })
          : [];

        let targetPersons: any[] = attendances.map((a: any) => a.person).filter(Boolean);
        let isFallback = false;
        if (targetPersons.length === 0) {
          targetPersons = await db.query.persons.findMany({
            limit: 20,
            orderBy: [desc(persons.createdAt)],
          });
          isFallback = true;
        }

        const formattedDate = formatEventDateTimeWib(event.startAt);

        const locationStr = event.deliveryMode === 'online'
          ? 'Online (Zoom / YouTube Live)'
          : event.locationName || 'Masjid Tarbiyah Sunnah, Bandung';

        const streamingUrl = event.meetingUrl || 'https://youtube.com/@tarbiyahsunnah';

        const generatedItems = targetPersons
          .filter((p: any) => p && p.phoneE164)
          .map((p: any) => {
            const rawPhone = p.phoneE164 ? p.phoneE164.replace(/[^0-9]/g, '') : '';
            const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${p.fullName},\n\nMengingatkan kembali agenda kajian berkah Yayasan Tarbiyah Sunnah:\n\n📖 *${event.title}*\n🎙️ Pemateri: *${event.speaker}*\n📅 Waktu: *${formattedDate} WIB*\n📍 Tempat/Mode: *${locationStr}*\n🔗 Link Streaming: ${streamingUrl}\n\nSemoga Allah meringankan langkah kita menuntut ilmu syar'i. Ditunggu kehadirannya, barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

            return {
              personId: p.id,
              fullName: p.fullName,
              phoneE164: p.phoneE164,
              email: p.email,
              message,
              waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
            };
          });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_event_reminder_batch',
          entityType: 'event',
          entityId: event.id,
          afterJson: { count: generatedItems.length, eventTitle: event.title },
          reason: body.notes || `Pengingat otomatis kajian ${event.title}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            eventId: event.id,
            eventTitle: event.title,
            speaker: event.speaker,
            eventDate: formattedDate,
            isFallback,
            totalGenerated: generatedItems.length,
            items: generatedItems,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 3. POST /api/automation/trigger-attendance-thanks (Post-Event Gratitude & Doa Istiqomah)
  router.post(
    '/api/automation/trigger-attendance-thanks',
    requireAuth(
      validateBody(triggerAttendanceThanksSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const event = await db.query.events.findFirst({
          where: eq(events.id, body.eventId),
        });

        if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);

        // Fetch attendees checked in
        const attendances = await db.query.eventAttendance.findMany({
          where: eq(eventAttendance.eventId, event.id),
          with: { person: true },
        });

        // If no attendees checked in yet, fallback to recent attendees list for demo
        let targetPersons: any[] = attendances.map((a) => a.person).filter(Boolean);
        if (targetPersons.length === 0) {
          targetPersons = await db.query.persons.findMany({ limit: 10 });
        }

        const generatedItems = targetPersons
          .filter((p) => p.phoneE164)
          .map((p) => {
            const rawPhone = p.phoneE164.replace(/[^0-9]/g, '');
            const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${p.fullName},\n\nAlhamdulillah, terima kasih banyak atas kehadiran Bapak/Ibu pada kajian:\n📖 *${event.title}*\n🎙️ Pemateri: *${event.speaker}*\n\nMari kita berdoa semoga Allah Ta'ala meneguhkan hati kita di atas istiqomah menuntut ilmu syar'i dan memudahkan kita dalam mengamalkan ilmu-ilmu yang telah didapat.\n\nSampai bertemu di majelis ilmu berikutnya. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

            return {
              personId: p.id,
              fullName: p.fullName,
              phoneE164: p.phoneE164,
              email: p.email,
              message,
              waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
            };
          });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_attendance_thanks_batch',
          entityType: 'event',
          entityId: event.id,
          afterJson: { count: generatedItems.length, eventTitle: event.title },
          reason: body.notes || `Ucapan alhamdulillah dan doa istiqomah pasca-kajian ${event.title}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            eventId: event.id,
            eventTitle: event.title,
            speaker: event.speaker,
            totalAttendees: generatedItems.length,
            items: generatedItems,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 4. POST /api/automation/trigger-donation-thanks (Donation E-Receipt)
  router.post(
    '/api/automation/trigger-donation-thanks',
    requireAuth(
      validateBody(triggerDonationThanksSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const donation = await db.query.donations.findFirst({
          where: eq(donations.id, body.donationId),
          with: {
            person: true,
            program: true,
          },
        });

        if (!donation) return errorResponse('NOT_FOUND', 'Data donasi tidak ditemukan', 404, ctx.requestId);

        const donorName = donation.person?.fullName || 'Hamba Allah';
        const programName = donation.program?.name || 'Infaq Dakwah & Operasional';
        const formattedAmount = Number(donation.amountRupiah).toLocaleString('id-ID');
        const formattedDate = new Date(donation.donationDate).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const refCode = donation.id.substring(0, 8).toUpperCase();

        const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAlhamdulillah, donasi/infaq Bapak/Ibu ${donorName} telah kami terima dan diverifikasi secara sah:\n\n💰 *Nominal*: Rp ${formattedAmount}\n📌 *Program*: ${programName}\n📅 *Tanggal*: ${formattedDate}\n🧾 *No. Ref*: #${refCode}\n\n_Jazakumullahu khairan katsiran_ atas kepercayaannya menyalurkan infaq melalui Yayasan Tarbiyah Sunnah. Semoga Allah menjadikannya amal jariyah pemberat timbangan kebaikan di yaumil akhir, melapangkan rezeki, dan memberkahi keluarga. Aamiin ya Rabbal 'Alamin.\n\n— Yayasan Tarbiyah Sunnah`;

        const phoneClean = donation.person?.phoneE164 ? donation.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` : null;

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_donation_receipt',
          entityType: 'donation',
          entityId: donation.id,
          afterJson: { donorName, amountRupiah: donation.amountRupiah, refCode },
          reason: body.notes || 'Pengiriman bukti sah tanda terima donasi via WhatsApp/Email',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            donationId: donation.id,
            donorName,
            donorPhone: donation.person?.phoneE164 || null,
            donorEmail: donation.person?.email || null,
            amountRupiah: Number(donation.amountRupiah),
            programName,
            message,
            waDirectUrl,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 5. POST /api/automation/trigger-waqf-followup
  router.post(
    '/api/automation/trigger-waqf-followup',
    requireAuth(
      validateBody(triggerWaqfFollowupSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const waqf = await db.query.waqfCases.findFirst({
          where: eq(waqfCases.id, body.waqfCaseId),
          with: {
            person: true,
            owner: true,
          },
        });

        if (!waqf) return errorResponse('NOT_FOUND', 'Kasus wakaf tidak ditemukan', 404, ctx.requestId);

        const waqifName = waqf.person?.fullName || 'Bapak/Ibu Waqif';
        const amilName = waqf.owner?.fullName || user.fullName;
        const stageDescriptions: Record<string, string> = {
          interested: 'Penyampaian Minat Awal Wakaf',
          consulted: 'Konsultasi Syar\'i & Rencana Peruntukan Aset',
          pledged: 'Penandatanganan Ikrar Wakaf',
          document_preparation: 'Pemberkasan Sertifikasi KUA & BPN',
          in_progress: 'Proses Legalitas & Pembangunan Fisik',
          completed: 'Sertifikat Terbit & Aset Siap Difungsikan',
          stewardship: 'Pengelolaan Berkelanjutan & Manfaat Dakwah',
        };

        const stageTitle = stageDescriptions[waqf.currentStage] || waqf.currentStage;
        const notesStr = body.nextStepNotes || waqf.notesSummary || 'Berkas sedang dalam verifikasi kelayakan legalitas.';

        const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${waqifName},\n\nSemoga Bapak/Ibu senantiasa dalam lindungan dan rahmat Allah Ta'ala. Kami dari Divisi Wakaf Yayasan Tarbiyah Sunnah mengabarkan progres pengelolaan aset wakaf *${waqf.waqfType.toUpperCase()}*:\n\n📍 *Status Tahapan*: ${stageTitle}\n📝 *Catatan Perkembangan*: ${notesStr}\n\nInsya Allah amil kami (${amilName}) akan terus mengawal proses ini hingga tuntas dan bermanfaat bagi kaum muslimin. Terima kasih atas amanah mulia ini, barakallahu fiikum.\n\n— Tim Wakaf Yayasan Tarbiyah Sunnah`;

        const phoneClean = waqf.person?.phoneE164 ? waqf.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` : null;

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_waqf_followup',
          entityType: 'waqf_case',
          entityId: waqf.id,
          afterJson: { waqifName, currentStage: waqf.currentStage },
          reason: body.nextStepNotes || 'Update berkala perkembangan wakaf aset',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            waqfCaseId: waqf.id,
            waqifName,
            waqifPhone: waqf.person?.phoneE164 || null,
            waqifEmail: waqf.person?.email || null,
            currentStage: waqf.currentStage,
            stageTitle,
            message,
            waDirectUrl,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 6. POST /api/automation/trigger-program-report (Program Impact Report Broadcast)
  router.post(
    '/api/automation/trigger-program-report',
    requireAuth(
      validateBody(triggerProgramReportSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const program = await db.query.donationPrograms.findFirst({
          where: eq(donationPrograms.id, body.programId),
        });

        if (!program) return errorResponse('NOT_FOUND', 'Program donasi tidak ditemukan', 404, ctx.requestId);

        // Fetch donors who contributed to this program
        const programDonations = await db.query.donations.findMany({
          where: and(eq(donations.programId, program.id), eq(donations.verificationStatus, 'verified')),
          with: { person: true },
          limit: 50,
        });

        const uniqueDonorsMap = new Map();
        for (const d of programDonations) {
          if (d.person && d.person.phoneE164) {
            uniqueDonorsMap.set(d.person.id, d.person);
          }
        }

        const donors = Array.from(uniqueDonorsMap.values());
        const docUrl = body.documentationUrl || 'https://tarbiyahsunnah.id/laporan-penyaluran';

        const items = donors.map((d: any) => {
          const rawPhone = d.phoneE164.replace(/[^0-9]/g, '');
          const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Sahabat Kebaikan ${d.fullName},\n\nAlhamdulillah, berikut kami sampaikan laporan berkala penyaluran program *${program.name}*:\n\n📊 *${body.reportTitle}*\n${body.reportSummary}\n\n📸 Dokumentasi & Laporan Lengkap: ${docUrl}\n\nSemoga setiap rupiah yang diinfaqkan terus mengalirkan pahala kebaikan yang tiada putus. _Jazakumullahu khairan katsiran_.\n\n— Yayasan Tarbiyah Sunnah`;

          return {
            personId: d.id,
            fullName: d.fullName,
            phoneE164: d.phoneE164,
            email: d.email,
            message,
            waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
          };
        });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_program_impact_report',
          entityType: 'donation_program',
          entityId: program.id,
          afterJson: { programName: program.name, totalDonors: items.length, reportTitle: body.reportTitle },
          reason: `Laporan dampak penyaluran program ${program.name}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            programId: program.id,
            programName: program.name,
            totalDonorsReached: items.length,
            items,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 6. GET /api/automation/inactive-attendees (Jamaah Rindu Majelis Detection)
  router.get(
    '/api/automation/inactive-attendees',
    requireAuth(async (ctx) => {
      const db = getDb();
      const parsedMinDays = Number.parseInt(ctx.query.minDays || '30', 10);
      const minDays = Number.isFinite(parsedMinDays) ? Math.min(Math.max(parsedMinDays, 1), 3650) : 30;
      const parsedPage = Number.parseInt(ctx.query.page || '1', 10);
      const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
      const parsedPageSize = Number.parseInt(ctx.query.pageSize || '15', 10);
      const pageSize = Number.isFinite(parsedPageSize) ? Math.min(Math.max(parsedPageSize, 1), 100) : 15;
      const gender = ctx.query.gender === 'ikhwan' || ctx.query.gender === 'akhwat' ? ctx.query.gender : null;
      const search = (ctx.query.search || '').trim().slice(0, 100);
      const searchPattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      const genderClause = gender ? sql`AND p.gender = ${gender}` : sql``;
      const searchClause = search
        ? sql`AND (
            p.full_name ILIKE ${searchPattern}
            OR p.phone_e164 ILIKE ${searchPattern}
            OR coalesce(p.city_regency, '') ILIKE ${searchPattern}
          )`
        : sql``;

      // Keep aggregation in PostgreSQL. Loading every attendance, interaction, and message
      // template into a serverless function was the source of production gateway timeouts.
      const result = await db.execute(sql`
        WITH latest_attendance AS (
          SELECT DISTINCT ON (ea.person_id)
            ea.person_id,
            ea.event_id,
            ea.check_in_at AS last_attended_at,
            count(*) OVER (PARTITION BY ea.person_id)::int AS total_attendances
          FROM event_attendance ea
          WHERE ea.status IN ('attended', 'registered')
          ORDER BY ea.person_id, ea.check_in_at DESC
        ), inactive AS (
          SELECT
            p.id AS person_id,
            p.full_name,
            p.gender,
            p.phone_e164,
            p.city_regency,
            la.last_attended_at,
            la.total_attendances,
            e.title AS last_event_title,
            e.speaker AS last_event_speaker,
            lg.last_greeted_at,
            floor(extract(epoch FROM (now() - la.last_attended_at)) / 86400)::int AS days_since_last_attendance
          FROM latest_attendance la
          INNER JOIN persons p ON p.id = la.person_id
          LEFT JOIN events e ON e.id = la.event_id
          LEFT JOIN LATERAL (
            SELECT i.occurred_at AS last_greeted_at
            FROM interactions i
            WHERE i.person_id = p.id
              AND (i.summary ILIKE '%sapaan%' OR i.summary ILIKE '%rindu majelis%')
            ORDER BY i.occurred_at DESC
            LIMIT 1
          ) lg ON true
          WHERE p.is_active = true
            AND p.phone_e164 IS NOT NULL
            AND la.last_attended_at < now() - (${minDays} * interval '1 day')
            ${genderClause}
            ${searchClause}
        ), ranked AS (
          SELECT
            inactive.*,
            count(*) OVER()::int AS total_inactive,
            (count(CASE WHEN last_greeted_at IS NULL OR last_greeted_at < now() - interval '30 days' THEN 1 END) OVER())::int AS need_greeting_count,
            (count(CASE WHEN last_greeted_at >= now() - interval '30 days' THEN 1 END) OVER())::int AS greeted_recently_count,
            (count(CASE WHEN days_since_last_attendance >= 90 THEN 1 END) OVER())::int AS critical_count
          FROM inactive
        )
        SELECT *
        FROM ranked
        ORDER BY last_attended_at ASC
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
      `);
      const inactiveRows = (Array.isArray(result) ? result : result.rows || []) as Array<Record<string, any>>;

      // Fetch the nearest future open event, not the furthest event in the schedule.
      const now = new Date();
      const upcomingEvents = await db.query.events.findMany({
        where: and(eq(events.isRegistrationOpen, true), gte(events.startAt, now)),
        orderBy: [asc(events.startAt)],
        limit: 1,
      });
      const nextEvent = upcomingEvents[0] || null;

      const formattedNextEvent = nextEvent
        ? {
            id: nextEvent.id,
            title: nextEvent.title,
            speaker: nextEvent.speaker,
            locationName: nextEvent.locationName || 'Masjid Tarbiyah Sunnah',
            startAt: nextEvent.startAt,
            startAtFormatted: new Intl.DateTimeFormat('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Jakarta',
            }).format(new Date(nextEvent.startAt)) + ' WIB',
          }
        : null;

      const inactiveList = inactiveRows.map((row) => {
        const lastAttendedDate = new Date(row.last_attended_at);
        const lastGreetedDate = row.last_greeted_at ? new Date(row.last_greeted_at) : null;
        const daysSinceLastGreeting = lastGreetedDate
          ? Math.max(0, Math.floor((now.getTime() - lastGreetedDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        const isGreetedRecently = daysSinceLastGreeting !== null && daysSinceLastGreeting <= 30;
        const sapaanPanggilan = row.gender === 'akhwat' ? 'Ukhti' : row.gender === 'ikhwan' ? 'Akhi' : 'Bapak/Ibu';
        const lastEventTitle = row.last_event_title || 'Kajian Rutin Yayasan';

        // Pre-build templates
        const tplKabarDoa = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSemoga ${sapaanPanggilan} ${row.full_name} dan keluarga senantiasa berada dalam lindungan, taufik, dan rahmat Allah Ta'ala.\n\nSudah cukup lama kami tidak bersua dengan antum di majelis ilmu Yayasan Tarbiyah Sunnah (terakhir di kajian *${lastEventTitle}*). Asatidzah dan ikhwah di majelis senantiasa merindukan kehadiran dan kebersamaan antum menuntut ilmu syar'i.\n\nSemoga antum sekeluarga selalu diberikan kesehatan, kelapangan rezeki, dan kemudahan dalam segala urusan. Sampai jumpa di majelis ilmu berikutnya, barakallahu fiikum.\n\n— Tim Layanan Jamaah Tarbiyah Sunnah`;

        const tplUndanganKajian = formattedNextEvent
          ? `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. ${sapaanPanggilan} ${row.full_name},\n\nSemoga senantiasa dalam keadaan sehat wal 'afiat. Mengingat antum sudah beberapa waktu belum sempat hadir di majelis ilmu, dengan senang hati kami mengundang antum untuk kembali hadir pada kajian terdekat kami:\n\n📖 *${formattedNextEvent.title}*\n🎙️ Pemateri: *${formattedNextEvent.speaker}*\n📅 Waktu: *${formattedNextEvent.startAtFormatted}*\n📍 Tempat: *${formattedNextEvent.locationName}*\n\nInsya Allah tempat dan fasilitas majelis telah disiapkan dengan nyaman. Kami sangat menantikan kehadiran antum kembali. _Jazakumullahu khairan_.\n\n— Yayasan Tarbiyah Sunnah`
          : tplKabarDoa;

        const tplTabayyunTaawun = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAfwan mengganggu waktunya ${sapaanPanggilan} ${row.full_name}. Semoga antum senantiasa sehat dan berkah.\n\nKami dari Divisi Layanan Jamaah YTS memperhatikan bahwa antum sudah beberapa waktu tidak hadir di kajian. Sekadar bertabayyun dan menanyakan kabar, apakah antum atau keluarga sedang berhalangan sakit, ada kesibukan, atau ada kendala transportasi yang sekiranya bisa dibantu oleh tim ta'awun yayasan?\n\nJika ada hal yang bisa kami bantu, jangan sungkan untuk mengabari kami ya. Semoga Allah memudahkan setiap urusan antum. Barakallahu fiik.\n\n— Divisi Layanan Jamaah Tarbiyah Sunnah`;

        const rawPhone = row.phone_e164.replace(/[^0-9]/g, '');

        return {
          personId: row.person_id,
          fullName: row.full_name,
          gender: row.gender,
          phoneE164: row.phone_e164,
          cityRegency: row.city_regency || 'Kota Bandung',
          totalAttendances: Number(row.total_attendances),
          lastAttendedAt: lastAttendedDate,
          lastEventTitle,
          lastEventSpeaker: row.last_event_speaker || 'Asatidzah YTS',
          daysSinceLastAttendance: Number(row.days_since_last_attendance),
          urgencyLevel: Number(row.days_since_last_attendance) >= 90 ? 'critical' : Number(row.days_since_last_attendance) >= 60 ? 'warning' : 'need_greeting',
          lastGreetedAt: lastGreetedDate,
          daysSinceLastGreeting,
          isGreetedRecently,
          templates: {
            kabar_doa: {
              id: 'kabar_doa',
              title: '🌸 Sapaan Ukhuwah & Doa Kesehatan',
              message: tplKabarDoa,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplKabarDoa)}`,
            },
            undangan_kajian: {
              id: 'undangan_kajian',
              title: '📖 Undangan Kajian & Majelis Terdekat',
              message: tplUndanganKajian,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplUndanganKajian)}`,
            },
            tabayyun_taawun: {
              id: 'tabayyun_taawun',
              title: '🤝 Tabayyun Kendala & Bantuan Ta\'awun',
              message: tplTabayyunTaawun,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplTabayyunTaawun)}`,
            },
          },
        };
      });

      const metrics = inactiveRows[0] || {};
      const totalInactive = Number(metrics.total_inactive || 0);

      return successResponse(
        {
          totalInactive,
          needGreetingCount: Number(metrics.need_greeting_count || 0),
          greetedRecentlyCount: Number(metrics.greeted_recently_count || 0),
          criticalCount: Number(metrics.critical_count || 0),
          nextUpcomingEvent: formattedNextEvent,
          pagination: {
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(totalInactive / pageSize)),
            totalItems: totalInactive,
          },
          items: inactiveList,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7. POST /api/automation/send-inactive-greeting (Log WhatsApp outreach & optional follow-up task)
  router.post(
    '/api/automation/send-inactive-greeting',
    requireAuth(
      validateBody(sendInactiveGreetingSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const person = await db.query.persons.findFirst({
          where: eq(persons.id, body.personId),
        });

        if (!person) return errorResponse('NOT_FOUND', 'Data jamaah tidak ditemukan', 404, ctx.requestId);

        // 1. Log interaction
        const templateLabelMap: Record<string, string> = {
          kabar_doa: 'Sapaan Ukhuwah & Doa Kesehatan',
          undangan_kajian: 'Undangan Majelis Ilmu Terdekat',
          tabayyun_taawun: 'Tabayyun Kendala & Bantuan Ta\'awun',
          custom: 'Sapaan Kustom Jamaah',
        };

        const templateLabel = (body.templateType && templateLabelMap[body.templateType]) || 'Sapaan Jamaah Rindu Majelis';
        const summary = `Outbound WA: ${templateLabel}`;

        const [newInteraction] = await db
          .insert(interactions)
          .values({
            personId: person.id,
            channel: 'whatsapp',
            summary,
            outcome: 'Pesan sapaan ukhuwah terkirim via WhatsApp Web / App',
            sensitivityLevel: 'standard',
            ownerUserId: user.id,
            createdBy: user.id,
          })
          .returning();

        // 2. Optionally create follow-up task
        let createdTask = null;
        if (body.createFollowupTask) {
          const dueAt = body.taskDueDate
            ? new Date(body.taskDueDate)
            : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          const [task] = await db
            .insert(tasks)
            .values({
              personId: person.id,
              relatedType: 'interaction',
              relatedId: newInteraction ? newInteraction.id : null,
              title: body.taskTitle || `Follow-Up Respon Sapaan ${person.fullName}`,
              description: `Pengecekan respon WhatsApp sapaan rindu majelis dan koordinasi kehadiran / ta'awun.`,
              status: 'pending',
              priority: 'medium',
              dueAt,
              ownerUserId: user.id,
              assignedBy: user.id,
            })
            .returning();

          createdTask = task;
        }

        // 3. Log Audit
        await logAuditEvent({
          actorUserId: user.id,
          action: 'send_inactive_greeting',
          entityType: 'person',
          entityId: person.id,
          afterJson: {
            personName: person.fullName,
            templateType: body.templateType,
            interactionId: newInteraction?.id,
            hasTask: Boolean(createdTask),
          },
          reason: `Pengiriman sapaan ukhuwah jamaah rindu majelis (${person.fullName})`,
          requestId: ctx.requestId,
        });

        const rawPhone = (person.phoneE164 || '').replace(/[^0-9]/g, '');
        const waDirectUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(body.message)}` : null;

        return successResponse(
          {
            personId: person.id,
            personName: person.fullName,
            phoneE164: person.phoneE164,
            interactionId: newInteraction?.id,
            taskId: createdTask?.id,
            waDirectUrl,
            message: body.message,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 8. GET /api/automation/email-broadcast-quota (Global WIB dispatch safeguard)
  router.get(
    '/api/automation/email-broadcast-quota',
    requireAuth(async (ctx) => {
      const quota = await getBroadcastDailyQuota(getDb());
      return successResponse(quota, { requestId: ctx.requestId });
    })
  );

  // 9. POST /api/automation/log-outreach (Generic CRM Interaction Logger for all automation channels)
  router.post(
    '/api/automation/log-outreach',
    requireAuth(
      validateBody(logOutreachSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const person = await db.query.persons.findFirst({
          where: eq(persons.id, body.personId),
        });
        if (!person) return errorResponse('NOT_FOUND', 'Data jamaah tidak ditemukan', 404, ctx.requestId);

        const channel = body.channel || 'whatsapp';
        const [newInteraction] = await db
          .insert(interactions)
          .values({
            personId: person.id,
            channel,
            summary: `Outreach [${body.category}]: ${body.summary}`,
            outcome: body.outcome || `Pesan terkirim via ${channel.toUpperCase()}`,
            sensitivityLevel: 'standard',
            ownerUserId: user.id,
            createdBy: user.id,
          })
          .returning();

        await logAuditEvent({
          actorUserId: user.id,
          action: 'log_outreach_interaction',
          entityType: 'person',
          entityId: person.id,
          afterJson: { category: body.category, summary: body.summary, interactionId: newInteraction?.id },
          reason: `Pencatatan otomasi outreach ke ${person.fullName}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          { interactionId: newInteraction?.id, personId: person.id, personName: person.fullName },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 10. GET /api/automation/email-campaigns (List Drip Email Campaigns from PostgreSQL with fallback)
  router.get(
    '/api/automation/email-campaigns',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureEmailCampaignsTableAndSeed(db);

      let list: any[] = [];
      if (db.query?.emailCampaigns?.findMany) {
        try {
          const dbCampaigns = await db.query.emailCampaigns.findMany({
            orderBy: [desc(emailCampaigns.createdAt)],
          });
          list = dbCampaigns.map((c: any) => ({
            ...c,
            createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
            updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
            lastDispatchedAt: c.lastDispatchedAt instanceof Date ? c.lastDispatchedAt.toISOString() : c.lastDispatchedAt,
            progressPercentage: c.stats?.totalRecipients > 0 ? Math.round((c.stats.totalSent / c.stats.totalRecipients) * 100) : 0,
          }));
        } catch {
          // Soft fail
        }
      }

      if (list.length === 0 && memoryFallbackCampaigns.size > 0) {
        list = Array.from(memoryFallbackCampaigns.values()).map((c) => ({
          ...c,
          progressPercentage: c.stats?.totalRecipients > 0 ? Math.round((c.stats.totalSent / c.stats.totalRecipients) * 100) : 0,
        }));
      }

      return successResponse(list, { requestId: ctx.requestId, total: list.length });
    })
  );

  // 11. GET /api/automation/email-campaigns/:id (Get Single Drip Email Campaign)
  router.get(
    '/api/automation/email-campaigns/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const campaignId = ctx.params?.id || '';

      const campaign = await findCampaign(db, campaignId);
      if (!campaign) {
        return errorResponse('NOT_FOUND', 'Program email campaign tidak ditemukan', 404, ctx.requestId);
      }

      return successResponse({
        ...campaign,
        progressPercentage: campaign.stats?.totalRecipients > 0 ? Math.round((campaign.stats.totalSent / campaign.stats.totalRecipients) * 100) : 0,
      }, { requestId: ctx.requestId });
    })
  );

  // 12. POST /api/automation/email-campaigns (Create New Drip Campaign with Real Emails)
  router.post(
    '/api/automation/email-campaigns',
    requireAuth(
      validateBody(createEmailCampaignSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const conditions = [
          isNotNull(persons.email),
          ne(persons.email, ''),
          eq(persons.isActive, true),
        ];
        if (body.filterGender && body.filterGender !== 'all') {
          conditions.push(eq(persons.gender, body.filterGender as any));
        }

        const eligiblePersons = await db.query.persons.findMany({
          where: and(...conditions),
          orderBy: [desc(persons.createdAt)],
        });

        const blacklistedSet = await getBlacklistedEmailsSet(db);
        const recipients: DripRecipient[] = eligiblePersons
          .filter((p) => Boolean(p.email && p.email.trim().includes('@')))
          .map((p) => {
            const cleanEmail = p.email!.trim().toLowerCase();
            const isBlacklisted = blacklistedSet.has(cleanEmail);
            return {
              personId: p.id,
              fullName: p.fullName,
              email: p.email!.trim(),
              gender: p.gender ?? null,
              cityRegency: p.cityRegency || 'Kota Bandung',
              status: isBlacklisted ? ('blacklisted' as const) : ('pending' as const),
              sentAt: null,
              dayNumber: null,
              error: isBlacklisted ? 'Dilewati: Terdaftar di Blacklist / Sudah pernah terkirim' : null,
            };
          });

        if (recipients.length === 0) {
          return errorResponse(
            'VALIDATION_ERROR',
            'Tidak ditemukan jamaah dengan email terverifikasi untuk kriteria target yang dipilih.',
            400,
            ctx.requestId
          );
        }

        const newId = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const newCampaign: DripEmailCampaign = {
          id: newId,
          title: body.title,
          subject: body.subject,
          bodyHtml: body.bodyHtml,
          dailyQuota: body.dailyQuota ?? 50,
          totalDays: body.totalDays ?? 14,
          currentDay: 1,
          status: 'running',
          filterGender: body.filterGender ?? 'all',
          createdAt: nowIso,
          updatedAt: nowIso,
          lastDispatchedAt: null,
          stats: {
            totalRecipients: recipients.length,
            totalSent: 0,
            totalFailed: 0,
            totalBlacklisted: recipients.filter((r) => r.status === 'blacklisted').length,
            remaining: recipients.filter((r) => r.status === 'pending').length,
            dailySentToday: 0,
          },
          recipients,
        };

        await insertCampaign(db, newCampaign, user.id);

        await logAuditEvent({
          actorUserId: user.id,
          action: 'create_drip_email_campaign',
          entityType: 'email_campaign',
          entityId: newId,
          afterJson: { title: body.title, totalRecipients: recipients.length, dailyQuota: body.dailyQuota, totalDays: body.totalDays },
          reason: `Pembuatan program drip email sapaan jamaah (${body.title})`,
          requestId: ctx.requestId,
        });

        return successResponse(newCampaign, { requestId: ctx.requestId }, 201);
      })
    )
  );

  // 13. PUT /api/automation/email-campaigns/:id (Update Campaign Details)
  router.put(
    '/api/automation/email-campaigns/:id',
    requireAuth(
      validateBody(updateEmailCampaignSchema, async (ctx, body) => {
        const db = getDb();
        const campaignId = ctx.params?.id || '';

        const campaign = await findCampaign(db, campaignId);
        if (!campaign) return errorResponse('NOT_FOUND', 'Campaign tidak ditemukan', 404, ctx.requestId);

        if (body.title !== undefined) campaign.title = body.title;
        if (body.subject !== undefined) campaign.subject = body.subject;
        if (body.bodyHtml !== undefined) campaign.bodyHtml = body.bodyHtml;
        if (body.dailyQuota !== undefined) campaign.dailyQuota = body.dailyQuota;
        if (body.totalDays !== undefined) campaign.totalDays = body.totalDays;
        campaign.updatedAt = new Date().toISOString();

        await saveCampaign(db, campaign);

        return successResponse(campaign, { requestId: ctx.requestId });
      })
    )
  );

  // 14. POST /api/automation/email-campaigns/:id/dispatch-today (Dispatch Today's Batch with Concurrency & Blacklist Skip)
  router.post(
    '/api/automation/email-campaigns/:id/dispatch-today',
    requireAuth(async (ctx) => {
      const campaignId = ctx.params?.id || '';
      const db = getDb();
      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Program email campaign tidak ditemukan', 404, ctx.requestId);

      if (campaign.status === 'completed') {
        return errorResponse('VALIDATION_ERROR', 'Campaign ini telah tuntas terkirim ke seluruh jamaah', 400, ctx.requestId);
      }

      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      // Auto-skip any pending recipients that are already registered in global email blacklist
      const blacklistedSet = await getBlacklistedEmailsSet(db);
      let newlyBlacklistedCount = 0;
      for (const r of campaign.recipients) {
        if (r.status === 'pending' && blacklistedSet.has(r.email.toLowerCase().trim())) {
          r.status = 'blacklisted';
          r.error = 'Dilewati: Terdaftar di Blacklist / Sudah pernah terkirim';
          newlyBlacklistedCount++;
        }
      }

      let dailyBroadcastQuota = await getBroadcastDailyQuota(db);
      if (dailyBroadcastQuota.remainingToday === 0) {
        return errorResponse(
          'RATE_LIMITED',
          `Batas broadcast email hari ini (${dailyBroadcastQuota.dailyLimit} email, WIB) telah tercapai. Pengiriman dapat dilanjutkan besok.`,
          429,
          ctx.requestId,
          dailyBroadcastQuota
        );
      }

      const dispatchAllowance = Math.min(campaign.dailyQuota, dailyBroadcastQuota.remainingToday);
      const pendingRecipients = campaign.recipients.filter((r) => r.status === 'pending').slice(0, dispatchAllowance);

      if (pendingRecipients.length === 0) {
        const hasAnyPending = campaign.recipients.some((r) => r.status === 'pending');
        if (!hasAnyPending) {
          campaign.status = 'completed';
        }
        campaign.stats.totalSent = campaign.recipients.filter((r) => r.status === 'sent').length;
        campaign.stats.totalFailed = campaign.recipients.filter((r) => r.status === 'failed').length;
        campaign.stats.totalBlacklisted = campaign.recipients.filter((r) => r.status === 'blacklisted').length;
        campaign.stats.remaining = campaign.recipients.filter((r) => r.status === 'pending').length;
        campaign.updatedAt = new Date().toISOString();
        await saveCampaign(db, campaign);
        return successResponse({
          message: hasAnyPending ? 'Batas pengiriman hari ini telah tercapai' : 'Semua antrean email telah selesai diproses',
          dispatchedCount: 0,
          skippedBlacklisted: campaign.stats.totalBlacklisted,
          campaign,
        }, { requestId: ctx.requestId });
      }

      // Time budget (8.5s) to guarantee serverless response before Netlify 10s timeout
      const startTime = Date.now();
      const TIME_BUDGET_MS = 8500;
      const CHUNK_SIZE = 5;

      let successCount = 0;
      let failedCount = 0;
      const dispatchResults: any[] = [];

      for (let i = 0; i < pendingRecipients.length; i += CHUNK_SIZE) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log(`[Drip Dispatch Budget]: Reached ${Date.now() - startTime}ms, yielding response gracefully.`);
          break;
        }

        const chunk = pendingRecipients.slice(i, i + CHUNK_SIZE);
        const validBatch: DripRecipient[] = [];

        for (const r of chunk) {
          const reservedQuota = await reserveBroadcastEmailSlot(db);
          if (!reservedQuota) break;
          dailyBroadcastQuota = reservedQuota;
          validBatch.push(r);
        }

        if (validBatch.length === 0) break;

        const results = await Promise.allSettled(
          validBatch.map(async (r) => {
            const genderTitle = r.gender === 'akhwat' ? 'Ukhti' : r.gender === 'ikhwan' ? 'Akhi' : 'Bapak/Ibu';
            const renderedHtml = campaign.bodyHtml
              .replace(/\{\{fullName\}\}/g, r.fullName)
              .replace(/\{\{city\}\}/g, r.cityRegency || 'Kota Bandung')
              .replace(/\{\{genderTitle\}\}/g, genderTitle)
              .replace(/\{\{email\}\}/g, r.email);

            const fullLayoutHtml = renderEmailLayout(campaign.subject, renderedHtml);

            const sendRes = await sendEmail({
              to: r.email,
              subject: campaign.subject,
              html: fullLayoutHtml,
            });

            if (sendRes.success) {
              r.status = 'sent';
              r.sentAt = new Date().toISOString();
              r.dayNumber = campaign.currentDay;
              r.error = null;

              // Log CRM interaction
              try {
                await db.insert(interactions).values({
                  personId: r.personId,
                  channel: 'email',
                  summary: `Drip Broadcast: ${campaign.title} (Hari ${campaign.currentDay})`,
                  outcome: `Email sapaan terkirim ke ${r.email}`,
                  sensitivityLevel: 'standard',
                  ownerUserId: user.id,
                  createdBy: user.id,
                });
              } catch (err) {
                console.warn('[CRM Drip Interaction Log Warn]:', err);
              }

              // Auto-add to email blacklist so future sends skip this email
              try {
                await addEmailToBlacklist(db, {
                  email: r.email,
                  reason: 'already_sent',
                  sourceCampaignId: campaign.id,
                  personId: r.personId,
                  userId: user.id,
                  notes: `Terkirim via kampanye ${campaign.title} (Hari ${campaign.currentDay})`,
                });
              } catch (err) {
                console.warn('[Auto Blacklist On Send Warn]:', err);
              }

              return { success: true, recipient: r };
            } else {
              r.status = 'failed';
              r.error = sendRes.error || 'Mailketing API Error';
              return { success: false, recipient: r, error: r.error };
            }
          })
        );

        for (const res of results) {
          if (res.status === 'fulfilled') {
            const val = res.value;
            if (val.success) {
              successCount++;
            } else {
              failedCount++;
            }
            dispatchResults.push({
              fullName: val.recipient.fullName,
              email: val.recipient.email,
              status: val.recipient.status,
              error: val.recipient.error,
            });
          } else {
            failedCount++;
          }
        }
      }

      // Update campaign stats
      const totalSent = campaign.recipients.filter((r) => r.status === 'sent').length;
      const totalFailed = campaign.recipients.filter((r) => r.status === 'failed').length;
      const totalBlacklisted = campaign.recipients.filter((r) => r.status === 'blacklisted').length;
      const remaining = campaign.recipients.filter((r) => r.status === 'pending').length;

      campaign.stats.totalSent = totalSent;
      campaign.stats.totalFailed = totalFailed;
      campaign.stats.totalBlacklisted = totalBlacklisted;
      campaign.stats.remaining = remaining;
      campaign.stats.dailySentToday = successCount;
      campaign.lastDispatchedAt = new Date().toISOString();
      campaign.updatedAt = new Date().toISOString();

      if (remaining === 0) {
        campaign.status = 'completed';
      } else if (campaign.currentDay < campaign.totalDays) {
        campaign.currentDay += 1;
      }

      await saveCampaign(db, campaign);

      await logAuditEvent({
        actorUserId: user.id,
        action: 'dispatch_drip_email_batch',
        entityType: 'email_campaign',
        entityId: campaign.id,
        afterJson: {
          dayNumber: campaign.currentDay - 1,
          successCount,
          failedCount,
          totalBlacklisted,
          newlyBlacklistedCount,
          remaining,
          dailyBroadcastQuota,
        },
        reason: `Pengiriman email harian kuota warm-up (${successCount} sukses, ${failedCount} gagal, ${totalBlacklisted} blacklist)`,
        requestId: ctx.requestId,
      });

      return successResponse(
        {
          campaignId: campaign.id,
          title: campaign.title,
          dayDispatched: campaign.currentDay - 1,
          successCount,
          failedCount,
          skippedBlacklisted: totalBlacklisted,
          remaining,
          dailyBroadcastQuota,
          campaign,
          results: dispatchResults,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 15. POST /api/automation/email-campaigns/:id/test-email (Send Single Test Email)
  router.post(
    '/api/automation/email-campaigns/:id/test-email',
    requireAuth(
      validateBody(testEmailCampaignSchema, async (ctx, body) => {
        const campaignId = ctx.params?.id || '';
        const db = getDb();
        const campaign = await findCampaign(db, campaignId);
        if (!campaign) {
          return errorResponse('NOT_FOUND', 'Program email campaign tidak ditemukan', 404, ctx.requestId);
        }

        const renderedHtml = campaign.bodyHtml
          .replace(/\{\{fullName\}\}/g, 'Bapak/Ibu Jamaah (Preview Tes)')
          .replace(/\{\{city\}\}/g, 'Kota Bandung')
          .replace(/\{\{genderTitle\}\}/g, 'Akhi/Ukhti')
          .replace(/\{\{email\}\}/g, body.testEmail);

        const fullLayoutHtml = renderEmailLayout(`[PREVIEW TES] ${campaign.subject}`, renderedHtml);

        const sendRes = await sendEmail({
          to: body.testEmail,
          subject: `[PREVIEW TES] ${campaign.subject}`,
          html: fullLayoutHtml,
        });

        if (!sendRes.success) {
          return errorResponse('INTERNAL_ERROR', `Gagal mengirim email tes: ${sendRes.error}`, 500, ctx.requestId);
        }

        return successResponse(
          {
            message: `Email pratinjau tes berhasil dikirim ke ${body.testEmail}`,
            messageId: sendRes.messageId,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 16. POST /api/automation/email-campaigns/:id/pause
  router.post(
    '/api/automation/email-campaigns/:id/pause',
    requireAuth(async (ctx) => {
      const campaignId = ctx.params?.id || '';
      const db = getDb();
      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Campaign tidak ditemukan', 404, ctx.requestId);

      campaign.status = 'paused';
      campaign.updatedAt = new Date().toISOString();
      await saveCampaign(db, campaign);

      return successResponse(campaign, { requestId: ctx.requestId });
    })
  );

  // 17. POST /api/automation/email-campaigns/:id/resume
  router.post(
    '/api/automation/email-campaigns/:id/resume',
    requireAuth(async (ctx) => {
      const campaignId = ctx.params?.id || '';
      const db = getDb();
      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Campaign tidak ditemukan', 404, ctx.requestId);

      campaign.status = 'running';
      campaign.updatedAt = new Date().toISOString();
      await saveCampaign(db, campaign);

      return successResponse(campaign, { requestId: ctx.requestId });
    })
  );

  // 18. DELETE /api/automation/email-campaigns/:id
  router.delete(
    '/api/automation/email-campaigns/:id',
    requireAuth(async (ctx) => {
      const campaignId = ctx.params?.id || '';
      const db = getDb();
      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Campaign tidak ditemukan', 404, ctx.requestId);

      await deleteCampaign(db, campaignId);

      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'delete_drip_email_campaign',
        entityType: 'email_campaign',
        entityId: campaignId,
        afterJson: { title: campaign.title },
        reason: `Penghapusan program drip email sapaan (${campaign.title})`,
        requestId: ctx.requestId,
      });

      return successResponse({ deleted: true, campaignId }, { requestId: ctx.requestId });
    })
  );

  // 19. POST /api/automation/email-campaigns/:id/reset (Reset campaign to Day 1)
  router.post(
    '/api/automation/email-campaigns/:id/reset',
    requireAuth(async (ctx) => {
      const campaignId = ctx.params?.id || '';
      const db = getDb();
      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Campaign tidak ditemukan', 404, ctx.requestId);

      const blacklistedSet = await getBlacklistedEmailsSet(db);
      campaign.currentDay = 1;
      campaign.status = 'running';
      campaign.stats.totalSent = 0;
      campaign.stats.totalFailed = 0;
      campaign.stats.dailySentToday = 0;
      campaign.lastDispatchedAt = null;
      campaign.recipients = campaign.recipients.map((r) => {
        const isBlacklisted = blacklistedSet.has(r.email.toLowerCase().trim());
        return {
          ...r,
          status: isBlacklisted ? ('blacklisted' as const) : ('pending' as const),
          sentAt: null,
          dayNumber: null,
          error: isBlacklisted ? 'Dilewati: Terdaftar di Blacklist / Sudah pernah terkirim' : null,
        };
      });
      campaign.stats.totalBlacklisted = campaign.recipients.filter((r) => r.status === 'blacklisted').length;
      campaign.stats.remaining = campaign.recipients.filter((r) => r.status === 'pending').length;
      campaign.updatedAt = new Date().toISOString();
      await saveCampaign(db, campaign);

      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'reset_drip_email_campaign',
        entityType: 'email_campaign',
        entityId: campaignId,
        afterJson: { title: campaign.title, totalRecipients: campaign.recipients.length },
        reason: `Mereset kembali antrean dan progres program email (${campaign.title}) ke Hari ke-1`,
        requestId: ctx.requestId,
      });

      return successResponse(campaign, { requestId: ctx.requestId });
    })
  );

  // 20. GET /api/automation/email-campaigns-audience-preview
  router.get(
    '/api/automation/email-campaigns-audience-preview',
    requireAuth(async (ctx) => {
      const db = getDb();
      const gender = ctx.query?.gender;

      const conditions = [
        isNotNull(persons.email),
        ne(persons.email, ''),
        eq(persons.isActive, true),
      ];
      if (gender && (gender === 'ikhwan' || gender === 'akhwat')) {
        conditions.push(eq(persons.gender, gender as any));
      }

      const eligiblePersons = await db.query.persons.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          email: true,
        },
      });

      const blacklistedSet = await getBlacklistedEmailsSet(db);
      const allValid = eligiblePersons.filter((p) => Boolean(p.email && p.email.trim().includes('@')));
      const cleanCount = allValid.filter((p) => !blacklistedSet.has(p.email!.trim().toLowerCase())).length;
      const blacklistedCount = allValid.length - cleanCount;

      return successResponse({ count: cleanCount, totalEligible: allValid.length, blacklistedCount, gender: gender || 'all' }, { requestId: ctx.requestId });
    })
  );

  // 21. GET /api/automation/email-blacklist (List & Stats of Email Blacklist)
  router.get(
    '/api/automation/email-blacklist',
    requireAuth(async (ctx) => {
      const db = getDb();
      await ensureEmailBlacklistTable(db);

      const search = (ctx.query?.search as string)?.toLowerCase().trim() || '';
      const reasonFilter = (ctx.query?.reason as string) || 'all';
      const page = Math.max(1, parseInt((ctx.query?.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(5, parseInt((ctx.query?.limit as string) || '20', 10)));

      let allEntries: any[] = [];
      if (db.query?.emailBlacklist?.findMany) {
        try {
          const dbRows = await db.query.emailBlacklist.findMany({
            orderBy: [desc(emailBlacklist.createdAt)],
          });
          allEntries = dbRows.map((r: any) => ({
            ...r,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          }));
        } catch {
          // Soft fail
        }
      }

      if (allEntries.length === 0 && memoryFallbackBlacklist.size > 0) {
        allEntries = Array.from(memoryFallbackBlacklist.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      // Compute statistics
      const stats = {
        total: allEntries.length,
        alreadySent: allEntries.filter((e) => e.reason === 'already_sent').length,
        manualBlacklist: allEntries.filter((e) => e.reason === 'manual_blacklist').length,
        bounced: allEntries.filter((e) => e.reason === 'bounced').length,
        unsubscribed: allEntries.filter((e) => e.reason === 'unsubscribed').length,
      };

      // Filter
      const filtered = allEntries.filter((e) => {
        const matchSearch =
          !search ||
          e.email.toLowerCase().includes(search) ||
          (e.notes && e.notes.toLowerCase().includes(search));
        const matchReason = reasonFilter === 'all' || e.reason === reasonFilter;
        return matchSearch && matchReason;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const items = filtered.slice((page - 1) * limit, page * limit);

      return successResponse(
        {
          items,
          stats,
          pagination: { page, limit, total, totalPages },
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 22. POST /api/automation/email-blacklist (Add Email to Blacklist)
  router.post(
    '/api/automation/email-blacklist',
    requireAuth(
      validateBody(createEmailBlacklistSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const entry = await addEmailToBlacklist(db, {
          email: body.email,
          reason: body.reason,
          notes: body.notes,
          userId: user.id,
        });

        // Update recipients across any fallback or loaded campaigns
        const cleanEmail = body.email.toLowerCase().trim();
        for (const c of memoryFallbackCampaigns.values()) {
          for (const r of c.recipients) {
            if (r.email.toLowerCase().trim() === cleanEmail && r.status !== 'sent') {
              r.status = 'blacklisted';
              r.error = `Dilewati: Terdaftar di Blacklist (${body.reason})`;
            }
          }
          c.stats.totalBlacklisted = c.recipients.filter((r) => r.status === 'blacklisted').length;
          c.stats.remaining = c.recipients.filter((r) => r.status === 'pending').length;
        }

        await logAuditEvent({
          actorUserId: user.id,
          action: 'add_email_to_blacklist',
          entityType: 'email_blacklist',
          entityId: entry.id,
          afterJson: { email: body.email, reason: body.reason, notes: body.notes },
          reason: `Pendaftaran email ke daftar blokir / suppression (${body.email})`,
          requestId: ctx.requestId,
        });

        return successResponse(entry, { requestId: ctx.requestId }, 201);
      })
    )
  );

  // 23. DELETE /api/automation/email-blacklist/:id (Remove from Blacklist)
  router.delete(
    '/api/automation/email-blacklist/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const idOrEmail = ctx.params?.id || '';
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      await removeEmailFromBlacklist(db, idOrEmail);

      await logAuditEvent({
        actorUserId: user.id,
        action: 'remove_email_from_blacklist',
        entityType: 'email_blacklist',
        entityId: idOrEmail,
        reason: `Penghapusan email dari daftar blacklist (${idOrEmail})`,
        requestId: ctx.requestId,
      });

      return successResponse({ deleted: true, idOrEmail }, { requestId: ctx.requestId });
    })
  );

  // 24. POST /api/automation/email-campaigns/:id/recipients/:recipientEmail/blacklist
  router.post(
    '/api/automation/email-campaigns/:id/recipients/:recipientEmail/blacklist',
    requireAuth(async (ctx) => {
      const db = getDb();
      const campaignId = ctx.params?.id || '';
      const recipientEmail = decodeURIComponent(ctx.params?.recipientEmail || '').toLowerCase().trim();
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Program email campaign tidak ditemukan', 404, ctx.requestId);

      const target = campaign.recipients.find((r) => r.email.toLowerCase().trim() === recipientEmail);
      if (!target) return errorResponse('NOT_FOUND', 'Penerima tidak ditemukan pada kampanye ini', 404, ctx.requestId);

      target.status = 'blacklisted';
      target.error = 'Dilewati: Ditambahkan manual ke Blacklist oleh amil';

      await addEmailToBlacklist(db, {
        email: recipientEmail,
        reason: 'manual_blacklist',
        sourceCampaignId: campaign.id,
        personId: target.personId,
        userId: user.id,
        notes: `Blacklist manual dari antrean ${campaign.title}`,
      });

      campaign.stats.totalBlacklisted = campaign.recipients.filter((r) => r.status === 'blacklisted').length;
      campaign.stats.remaining = campaign.recipients.filter((r) => r.status === 'pending').length;
      campaign.updatedAt = new Date().toISOString();
      await saveCampaign(db, campaign);

      return successResponse({ success: true, recipient: target, campaign }, { requestId: ctx.requestId });
    })
  );

  // 25. POST /api/automation/email-campaigns/:id/recipients/:recipientEmail/unblacklist
  router.post(
    '/api/automation/email-campaigns/:id/recipients/:recipientEmail/unblacklist',
    requireAuth(async (ctx) => {
      const db = getDb();
      const campaignId = ctx.params?.id || '';
      const recipientEmail = decodeURIComponent(ctx.params?.recipientEmail || '').toLowerCase().trim();
      const user = ctx.user;
      if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

      const campaign = await findCampaign(db, campaignId);
      if (!campaign) return errorResponse('NOT_FOUND', 'Program email campaign tidak ditemukan', 404, ctx.requestId);

      const target = campaign.recipients.find((r) => r.email.toLowerCase().trim() === recipientEmail);
      if (!target) return errorResponse('NOT_FOUND', 'Penerima tidak ditemukan pada kampanye ini', 404, ctx.requestId);

      target.status = 'pending';
      target.error = null;

      await removeEmailFromBlacklist(db, recipientEmail);

      campaign.stats.totalBlacklisted = campaign.recipients.filter((r) => r.status === 'blacklisted').length;
      campaign.stats.remaining = campaign.recipients.filter((r) => r.status === 'pending').length;
      campaign.updatedAt = new Date().toISOString();
      await saveCampaign(db, campaign);

      return successResponse({ success: true, recipient: target, campaign }, { requestId: ctx.requestId });
    })
  );
}
