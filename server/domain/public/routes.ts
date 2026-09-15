import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { Router } from '../../http/router';
import { validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  donations,
  waqfCases,
  tasks,
  donationPrograms,
  waqfChecklistItems,
  appUsers,
  events,
  eventAttendance,
  attachments,
  bazaarEvents,
} from '../../db/schema';
import { and, eq, sql, or, inArray, desc, asc, ilike, isNull, isNotNull, gte } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';
import { buildParticipantPortalPath, extractTicketCode } from '../../../src/lib/participantTicket';
import { isEventPast } from '../../../src/lib/eventUtils';
import { createMemorableTicketCode } from '../events/participantCodes';
import {
  hasValidStaffRegistrationToken,
  isRegularRegistration,
  isSpecialInviteRegistration,
  isStaffFamilyRegistration,
  isStaffRegistration,
  STAFF_FAMILY_REGISTRATION_CHANNEL,
  STAFF_REGISTRATION_CHANNEL,
} from '../events/registrationChannels';
import {
  getPersonsAttendanceStats,
  getSinglePersonAttendanceStats,
  getLoyaltyTierInfo,
  buildPersonalizedGreeting,
} from '../events/attendanceHistory';
import {
  sendEventRegistrationTicketEmail,
  sendDonationReceivedEmail,
  sendWaqfInquiryConfirmationEmail,
} from '../../email/service';
import { ensureS3StorageUrl, uploadPublicProofFile } from '../../storage/providers/s3';

const optionalEmailSchema = z
  .string()
  .email('Format email tidak valid')
  .optional()
  .nullable()
  .or(z.literal(''));

const publicDonationSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  email: optionalEmailSchema,
  programId: z.string().uuid('Program infaq wajib dipilih'),
  amountRupiah: z.number().min(10000, 'Nominal minimal donasi adalah Rp 10.000'),
  paymentMethod: z.enum(['bank_transfer', 'qris', 'cash', 'other']).default('bank_transfer'),
  bankReference: z.string().optional().nullable(),
  transferProofUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
});

const publicWaqfInquirySchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  email: optionalEmailSchema,
  cityRegency: z.string().optional().nullable(),
  waqfType: z.enum(['tanah', 'bangunan', 'uang', 'kendaraan', 'logistik_dakwah', 'sarana_air', 'lainnya']),
  estimatedValueRupiah: z.number().min(100000, 'Estimasi nilai wakaf minimal Rp 100.000').optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  notesSummary: z.string().min(5, 'Mohon jelaskan niat dan rincian aset wakaf yang ingin dikonsultasikan'),
});

const additionalParticipantSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap peserta rombongan minimal 2 karakter'),
  gender: z.enum(['ikhwan', 'akhwat']).nullable().optional(),
  relationship: z.string().default('Keluarga'),
  age: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const publicEventRegistrationSchema = z.object({
  eventId: z.string().uuid('Kajian / Daurah wajib dipilih'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  gender: z.enum(['ikhwan', 'akhwat']).nullable().optional(),
  age: z.number().int().min(1, 'Usia minimal 1 tahun').max(120, 'Usia tidak valid').optional().nullable(),
  email: optionalEmailSchema,
  cityRegency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customResponses: z.record(z.any()).optional().nullable(),
  vehicleType: z.enum(['none', 'motorcycle', 'car']).default('none'),
  vehiclePlateNumber: z.string().optional().nullable(),
  agreedToRules: z.boolean().default(true),
  paymentProofUrl: z.string().optional().nullable(),
  paymentAmountRupiah: z.number().optional().nullable(),
  referralCode: z.string().trim().min(2).max(80).optional().nullable(),
  inviteCode: z.string().trim().min(2).max(80).optional().nullable(),
  additionalParticipants: z.array(additionalParticipantSchema).optional().nullable(),
});

const publicStaffEventRegistrationSchema = z.object({
  eventId: z.string().uuid('Kajian wajib dipilih'),
  staffToken: z.string().min(24, 'Tautan pendaftaran staff tidak valid').max(128),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  gender: z.enum(['ikhwan', 'akhwat']).nullable().optional(),
  unitName: z.string().min(2, 'Unit atau divisi wajib diisi').max(120),
  roleName: z.string().min(2, 'Peran atau tugas wajib diisi').max(120),
  employeeNumber: z.string().max(80).optional().nullable(),
  email: optionalEmailSchema,
  notes: z.string().max(1000).optional().nullable(),
  agreedToRules: z.boolean().default(true),
  additionalParticipants: z.array(additionalParticipantSchema).optional().nullable(),
});

function safeWhatsAppGroupUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'chat.whatsapp.com' || url.hostname === 'www.chat.whatsapp.com')
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const publicUploadSchema = z.object({
  base64Data: z.string().min(1, 'Data berkas (Base64) wajib disertakan'),
  filename: z.string().optional(),
  mimeType: z.string().optional().default('image/jpeg'),
  folder: z.enum(['bazaar-proofs', 'event-proofs', 'donation-proofs', 'public-proofs']).default('public-proofs'),
});

type AppDatabase = ReturnType<typeof getDb>;
type AppTransaction = Parameters<AppDatabase['transaction']>[0] extends (tx: infer Transaction) => Promise<unknown>
  ? Transaction
  : never;
type RegistrationDatabase = AppDatabase | AppTransaction;

/**
 * Serializes registrations for one event. Quota checks and inserts must share a
 * transaction; otherwise simultaneous submissions can both consume the last slot.
 *
 * A row lock is deliberately used instead of a PostgreSQL advisory lock. The
 * serverless database driver can leave an advisory lock waiting beyond the
 * function lifetime, which makes an otherwise valid registration time out.
 */
async function withEventRegistrationLock<T>(
  db: AppDatabase,
  eventId: string,
  operation: (tx: RegistrationDatabase) => Promise<T>
): Promise<T> {
  const databaseWithOptionalTransaction = db as unknown as {
    transaction?: (callback: (tx: AppTransaction) => Promise<T>) => Promise<T>;
  };

  // Unit tests use intentionally small database doubles. Production always takes
  // the transactional branch below.
  if (!databaseWithOptionalTransaction.transaction) return operation(db);

  return databaseWithOptionalTransaction.transaction(async (tx) => {
    // Keep a busy registration bounded while preserving atomic quota validation.
    await tx.execute(sql`SET LOCAL lock_timeout = '4s'`);
    await tx.execute(sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`);
    return operation(tx);
  });
}

export function registerPublicPortalRoutes(router: Router) {
  // 0. POST /api/public/upload (Public Upload for Proofs to Contabo S3)
  router.post(
    '/api/public/upload',
    validateBody(publicUploadSchema, async (ctx, body) => {
      try {
        const base64Clean = body.base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        if (buffer.length === 0) {
          return errorResponse('VALIDATION_ERROR', 'Berkas kosong tidak dapat diunggah', 400, ctx.requestId);
        }
        if (buffer.length > 10 * 1024 * 1024) {
          return errorResponse('VALIDATION_ERROR', 'Ukuran berkas melebihi batas maksimal 10MB', 400, ctx.requestId);
        }

        const uploaded = await uploadPublicProofFile({
          folder: body.folder || 'public-proofs',
          filename: body.filename,
          body: buffer,
          mimeType: body.mimeType || 'image/jpeg',
        });

        return successResponse(uploaded, { requestId: ctx.requestId }, 201);
      } catch (err: any) {
        console.error('[POST /api/public/upload Error]:', err);
        return errorResponse('INTERNAL_ERROR', err.message || 'Gagal mengunggah berkas ke S3', 500, ctx.requestId);
      }
    })
  );

  // 1. GET /api/public/portal-info (Public Aggregates, Active Programs, Bank Accounts, Upcoming Kajian)
  router.get('/api/public/portal-info', async (ctx) => {
    const db = getDb();

    // Active Infaq Programs & Upcoming Events with Attendances
    const [activePrograms, upcomingEvents] = await Promise.all([
      db.query.donationPrograms.findMany({
        where: eq(donationPrograms.isActive, true),
        orderBy: [donationPrograms.name],
      }),
      db.query.events.findMany({
        where: and(
          inArray(events.status, ['scheduled', 'ongoing']),
          or(
            and(isNotNull(events.endAt), gte(events.endAt, sql`NOW()`)),
            and(isNull(events.endAt), gte(events.startAt, sql`NOW() - INTERVAL '2 hours'`))
          )
        ),
        orderBy: [events.startAt],
        with: {
          attendances: {
            with: {
              person: {
                columns: {
                  id: true,
                  gender: true,
                },
              },
            },
          },
        },
        limit: 12,
      }),
    ]);

    const activeUpcomingEvents = upcomingEvents.filter((ev) => !isEventPast(ev));
    const upcomingEventIds = activeUpcomingEvents.map((ev) => ev.id);
    const portalBazaarMap = new Map<string, any>();
    if (upcomingEventIds.length > 0) {
      try {
        const bazaars = await db.query.bazaarEvents.findMany({
          where: inArray(bazaarEvents.eventId, upcomingEventIds),
          with: {
            applications: {
              columns: { id: true, status: true, isPublished: true },
            },
            booths: {
              columns: { id: true, status: true },
            },
          },
        });
        for (const b of bazaars) {
          const activeApps = (b.applications || []).filter(
            (a: any) => a.status !== 'rejected' && a.status !== 'cancelled'
          );
          portalBazaarMap.set(b.eventId, {
            id: b.id,
            isOpen: b.isOpen,
            totalTenantsCount: activeApps.length,
            publishedTenantsCount: activeApps.filter((a: any) => a.isPublished ?? true).length,
            boothsCount: (b.booths || []).length,
          });
        }
      } catch (err) {
        console.warn('[portal-info] Bazaar query warning:', err);
      }
    }

    // Aggregate Public Metrics (Safe aggregates, no PII)
    const [donationTotalRes, donorCountRes, waqfCountRes] = await Promise.all([
      db
        .select({
          totalRupiah: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(donations)
        .where(eq(donations.verificationStatus, 'verified')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(persons)
        .where(eq(persons.isActive, true)),
      db
        .select({
          count: sql<number>`count(*)::int`,
          totalValue: sql<string>`coalesce(sum(${waqfCases.estimatedValueRupiah}), 0)`,
        })
        .from(waqfCases),
    ]);

    const bankAccounts = [
      {
        bankName: 'Bank Syariah Indonesia (BSI)',
        bankCode: '451',
        accountNumber: '7123456789',
        accountHolder: 'Yayasan Tarbiyah Sunnah (Infaq Dakwah)',
        category: 'infaq',
      },
      {
        bankName: 'Bank Syariah Indonesia (BSI)',
        bankCode: '451',
        accountNumber: '7987654321',
        accountHolder: 'Yayasan Tarbiyah Sunnah (Amanah Wakaf)',
        category: 'waqf',
      },
    ];

    return successResponse(
      {
        foundation: {
          name: 'Yayasan Tarbiyah Sunnah',
          slogan: "Meniti Sunnah di Atas Manhaj Salafus Shalih",
          address: 'Jl. Jurang No.64, Pasteur, Kec. Sukajadi, Kota Bandung, Jawa Barat 40161',
          whatsappContact: '0811-2401-476',
          email: 'info@tarbiyahsunnah.id',
        },
        metrics: {
          totalInfaqDistributedRupiah: Number(donationTotalRes[0]?.totalRupiah || 0),
          verifiedDonationsCount: donationTotalRes[0]?.count || 0,
          totalMuhsininCount: donorCountRes[0]?.count || 0,
          totalWaqfProjectsCount: waqfCountRes[0]?.count || 0,
          totalWaqfAssetValueRupiah: Number(waqfCountRes[0]?.totalValue || 0),
        },
        programs: activePrograms.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        })),
        waqfProjects: [
          {
            id: 'wq_project_1',
            title: 'Pembebasan Lahan Pesantren & Islamic Center',
            type: 'tanah',
            targetRupiah: 2500000000,
            collectedRupiah: 1850000000,
            location: 'Cileungsi / Bandung Timur',
            description: 'Perluasan sarana asrama santri penghafal Al-Qur\'an dan majelis ilmu sunnah.',
            progressPercent: 74,
          },
          {
            id: 'wq_project_2',
            title: 'Pembangunan Masjid & Studio Radio Dakwah',
            type: 'bangunan',
            targetRupiah: 1200000000,
            collectedRupiah: 980000000,
            location: 'Kompleks Tarbiyah Sunnah',
            description: 'Sarana ibadah representatif dan sentra penyiaran dakwah radio & live streaming.',
            progressPercent: 81,
          },
          {
            id: 'wq_project_3',
            title: 'Wakaf Sarana Air Bersih & Sumur Bor Pelosok',
            type: 'sarana_air',
            targetRupiah: 150000000,
            collectedRupiah: 125000000,
            location: 'Daerah Rawan Kekeringan',
            description: 'Penyediaan air bersih untuk masjid dan warga dhuafa di pelosok desa.',
            progressPercent: 83,
          },
        ],
        events: activeUpcomingEvents.map((ev) => {
          const atts = ev.attendances || [];
          // URL grup tidak boleh muncul pada katalog publik; hanya endpoint tiket terverifikasi yang mengirimkannya.
          const { whatsappGroupIkhwanUrl, whatsappGroupAkhwatUrl, ...publicFormConfig } = ev.formConfig || {};
          const ikhwanCount = atts.filter((a) => a.person?.gender === 'ikhwan').length;
          const akhwatCount = atts.filter((a) => a.person?.gender === 'akhwat').length;
          const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
          const motorcyclesCount = atts.filter((a) => a.vehicleType === 'motorcycle').length;

          const inviteAtts = atts.filter(isSpecialInviteRegistration);
          const regularAtts = atts.filter(isRegularRegistration);

          const specialInviteCount = inviteAtts.length;
          const specialInviteIkhwanCount = inviteAtts.filter((a) => a.person?.gender === 'ikhwan').length;
          const specialInviteAkhwatCount = inviteAtts.filter((a) => a.person?.gender === 'akhwat').length;

          const regularCount = regularAtts.length;
          const regularIkhwanCount = regularAtts.filter((a) => a.person?.gender === 'ikhwan').length;
          const regularAkhwatCount = regularAtts.filter((a) => a.person?.gender === 'akhwat').length;

          const isRegularFull = Boolean(
            (ev.quota && regularCount >= ev.quota) ||
            (ev.targetAudience === 'ikhwan_only' && ev.quotaIkhwan && regularIkhwanCount >= ev.quotaIkhwan) ||
            (ev.targetAudience === 'akhwat_only' && ev.quotaAkhwat && regularAkhwatCount >= ev.quotaAkhwat) ||
            (ev.quotaIkhwan && ev.quotaAkhwat && regularIkhwanCount >= ev.quotaIkhwan && regularAkhwatCount >= ev.quotaAkhwat)
          );

          const isInviteFull = Boolean(
            (ev.quotaInvite && specialInviteCount >= ev.quotaInvite) ||
            (ev.targetAudience === 'ikhwan_only' && ev.quotaInviteIkhwan && specialInviteIkhwanCount >= ev.quotaInviteIkhwan) ||
            (ev.targetAudience === 'akhwat_only' && ev.quotaInviteAkhwat && specialInviteAkhwatCount >= ev.quotaInviteAkhwat) ||
            (ev.quotaInviteIkhwan && ev.quotaInviteAkhwat && specialInviteIkhwanCount >= ev.quotaInviteIkhwan && specialInviteAkhwatCount >= ev.quotaInviteAkhwat)
          );

          return {
            id: ev.id,
            title: ev.title,
            category: ev.category,
            speaker: ev.speaker,
            description: ev.description,
            startAt: ev.startAt.toISOString(),
            endAt: ev.endAt ? ev.endAt.toISOString() : null,
            deliveryMode: ev.deliveryMode,
            locationName: ev.locationName || 'Masjid Tarbiyah Sunnah',
            meetingUrl: ev.meetingUrl,
            targetAudience: ev.targetAudience || 'umum',
            minAge: ev.minAge || null,
            quota: ev.quota,
            quotaIkhwan: ev.quotaIkhwan,
            quotaAkhwat: ev.quotaAkhwat,
            quotaInvite: ev.quotaInvite,
            quotaInviteIkhwan: ev.quotaInviteIkhwan,
            quotaInviteAkhwat: ev.quotaInviteAkhwat,
            carParkingQuota: ev.carParkingQuota,
            motorcycleParkingQuota: ev.motorcycleParkingQuota,
            venueRules: ev.venueRules || [],
            customVenueRules: ev.customVenueRules,
            isRegistrationOpen: ev.isRegistrationOpen,
            isPast: false,
            isRegularFull,
            isInviteFull,
            formConfig: publicFormConfig,
            attendanceCount: atts.length,
            ikhwanCount,
            akhwatCount,
            carsCount,
            motorcyclesCount,
            specialInviteCount,
            specialInviteIkhwanCount,
            specialInviteAkhwatCount,
            regularCount,
            regularIkhwanCount,
            regularAkhwatCount,
            bazaarInfo: portalBazaarMap.get(ev.id) || null,
          };
        }),
        bankAccounts,
      },
      { requestId: ctx.requestId }
    );
  });

  // 2. POST /api/public/submit-donation (Online Donation Confirmation from Public)
  router.post(
    '/api/public/submit-donation',
    validateBody(publicDonationSchema, async (ctx, body) => {
      const db = getDb();
      const phoneNorm = normalizeIndonesianPhone(body.phone);
      const displayName = body.isAnonymous ? 'Hamba Allah' : body.fullName;

      // Find or create person record
      let person = await db.query.persons.findFirst({
        where: eq(persons.phoneE164, phoneNorm),
      });

      if (!person) {
        const [newPerson] = await db
          .insert(persons)
          .values({
            fullName: body.fullName,
            phoneE164: phoneNorm,
            email: body.email || null,
            sourceCode: 'public_portal_donation',
            engagementStatus: 'baru',
            donorStage: 'interested',
            preferredChannel: 'whatsapp',
          })
          .returning();
        person = newPerson;
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data donatur', 500, ctx.requestId);
      }

      // Generate invoice reference code: YTS-INFAQ-YYMMDD-RAND
      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const invoiceRef = `YTS-${datePart}-${randPart}`;

      // Find an active amil/staff user to assign the inbound donation & task
      const defaultAmil = await db.query.appUsers.findFirst({
        where: eq(appUsers.isActive, true),
      });
      const amilId = defaultAmil?.id || '018f0000-0000-7000-8000-000000000001';

      // Process and upload transfer proof to Contabo S3 if provided
      let proofAttachmentId: string | null = null;
      let storedProofUrl: string | null = null;
      if (body.transferProofUrl) {
        storedProofUrl = await ensureS3StorageUrl(
          body.transferProofUrl,
          'donation-proofs',
          `infaq_${invoiceRef}`
        );

        if (storedProofUrl) {
          try {
            const [newAtt] = await db
              .insert(attachments)
              .values({
                storageProvider: 's3_contabo',
                bucket: process.env.S3_BUCKET || '',
                objectKey: storedProofUrl.replace(/^https?:\/\/[^/]+\/[^/]+\//, ''),
                originalFilename: `bukti_transfer_${invoiceRef}.jpg`,
                mimeType: 'image/jpeg',
                fileSize: BigInt(2048),
                sensitivityLevel: 'standard',
                uploadedBy: amilId,
              })
              .returning();
            if (newAtt) {
              proofAttachmentId = newAtt.id;
            }
          } catch (attErr) {
            console.warn('[Public Donation Proof Attachment Insert Error]:', attErr);
          }
        }
      }

      // Insert unverified donation record
      const [newDonation] = await db
        .insert(donations)
        .values({
          personId: person.id,
          programId: body.programId,
          amountRupiah: BigInt(body.amountRupiah) as any,
          paymentMethod: body.paymentMethod,
          externalReference: body.bankReference || invoiceRef,
          verificationStatus: 'unverified',
          donationDate: new Date(),
          proofAttachmentId: proofAttachmentId || null,
          createdBy: amilId,
        })
        .returning();

      // Create Follow-Up Verification Task for Amil
      await db
        .insert(tasks)
        .values({
          personId: person.id,
          title: `Verifikasi Mutasi Infaq: Rp ${body.amountRupiah.toLocaleString('id-ID')} (${displayName})`,
          description: `Konfirmasi transfer online masuk via Portal Publik. Ref: ${invoiceRef}.${storedProofUrl ? ' Bukti transfer: ' + storedProofUrl : ''} Mohon cek mutasi rekening BSI dan terbitkan E-Receipt.`,
          priority: 'high',
          status: 'pending',
          ownerUserId: amilId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24h
        });

      // Send Email Confirmation to Donor if email provided
      if (body.email) {
        if (db.query?.donationPrograms?.findFirst) {
          db.query.donationPrograms
            .findFirst({
              where: eq(donationPrograms.id, body.programId),
            })
            .then((program) => {
              sendDonationReceivedEmail({
                recipientEmail: body.email!,
                donorName: displayName,
                programName: program?.name || 'Infaq Operasional Dakwah',
                amountRupiah: body.amountRupiah,
                donationCode: invoiceRef,
                paymentMethod: body.paymentMethod || 'bank_transfer',
                bankName: 'Bank Syariah Indonesia (BSI)',
                accountNumber: '7123456789',
                accountHolder: 'Yayasan Tarbiyah Sunnah (Infaq Dakwah)',
              }).catch((err) => console.warn('[Email Donation Error]:', err));
            })
            .catch((err) => console.warn('[Email Donation Program Lookup Error]:', err));
        } else {
          sendDonationReceivedEmail({
            recipientEmail: body.email!,
            donorName: displayName,
            programName: 'Infaq Operasional Dakwah',
            amountRupiah: body.amountRupiah,
            donationCode: invoiceRef,
            paymentMethod: body.paymentMethod || 'bank_transfer',
            bankName: 'Bank Syariah Indonesia (BSI)',
            accountNumber: '7123456789',
            accountHolder: 'Yayasan Tarbiyah Sunnah (Infaq Dakwah)',
          }).catch((err) => console.warn('[Email Donation Error]:', err));
        }
      }

      return successResponse(
        {
          referenceCode: invoiceRef,
          donationId: newDonation?.id,
          amountRupiah: body.amountRupiah,
          donorName: displayName,
          status: 'unverified',
          message:
            'Jazakumullahu khairan katsiran. Konfirmasi infaq Anda telah kami terima dan sedang diverifikasi oleh Tim Amil Yayasan Tarbiyah Sunnah.',
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 3. POST /api/public/submit-waqf-inquiry (Online Waqf Consultation Inquiry from Public)
  router.post(
    '/api/public/submit-waqf-inquiry',
    validateBody(publicWaqfInquirySchema, async (ctx, body) => {
      const db = getDb();
      const phoneNorm = normalizeIndonesianPhone(body.phone);

      // Find or create person record
      let person = await db.query.persons.findFirst({
        where: eq(persons.phoneE164, phoneNorm),
      });

      if (!person) {
        const [newPerson] = await db
          .insert(persons)
          .values({
            fullName: body.fullName,
            phoneE164: phoneNorm,
            email: body.email || null,
            cityRegency: body.cityRegency || null,
            sourceCode: 'public_portal_waqf_inquiry',
            engagementStatus: 'baru',
            donorStage: 'interested',
            preferredChannel: 'whatsapp',
          })
          .returning();
        person = newPerson;
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data calon wakif', 500, ctx.requestId);
      }

      // Find default amil
      const defaultAmil = await db.query.appUsers.findFirst({
        where: eq(appUsers.isActive, true),
      });
      const amilId = defaultAmil?.id || '018f0000-0000-7000-8000-000000000001';

      // Create new Waqf Case in stage "interested"
      const [newCase] = await db
        .insert(waqfCases)
        .values({
          personId: person.id,
          waqfType: body.waqfType,
          estimatedValueRupiah: body.estimatedValueRupiah ? (BigInt(body.estimatedValueRupiah) as any) : null,
          currentStage: 'interested',
          ownerUserId: amilId,
          createdBy: amilId,
          notesSummary: `[Konsultasi Portal Publik] ${body.notesSummary} (Alamat/Lokasi: ${body.locationAddress || '-'})`,
        })
        .returning();

      if (newCase) {
        // Initialize default checklist items for stage 1
        await db.insert(waqfChecklistItems).values([
          {
            waqfCaseId: newCase.id,
            itemCode: 'CONTACT_INITIAL',
            label: 'Silaturahmi dan kontak awal dengan calon wakif',
            isRequired: true,
            isCompleted: false,
          },
          {
            waqfCaseId: newCase.id,
            itemCode: 'SYARIAH_REVIEW',
            label: 'Konsultasi kriteria syariah objek wakaf',
            isRequired: true,
            isCompleted: false,
          },
        ]);

        // Create high-priority task for Waqf Amil
        await db.insert(tasks).values({
          personId: person.id,
          title: `Konsultasi Niat Wakaf Baru: [${body.waqfType.toUpperCase()}] ${body.fullName}`,
          description: `Permohonan konsultasi wakaf masuk dari Portal Publik. Rincian: ${body.notesSummary}. No WA: ${phoneNorm}`,
          priority: 'urgent',
          status: 'pending',
          ownerUserId: amilId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

        // Send Email Confirmation to Wakif if email provided
        if (body.email) {
          const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
          const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          sendWaqfInquiryConfirmationEmail({
            recipientEmail: body.email,
            wakifName: body.fullName,
            waqfType: body.waqfType,
            estimatedValue: body.estimatedValueRupiah,
            cityRegency: body.cityRegency,
            inquiryCode: `WQF-${datePart}-${randPart}`,
          }).catch((err) => console.warn('[Email Waqf Error]:', err));
        }

        return successResponse(
          {
            waqfCaseId: newCase?.id,
            waqfType: body.waqfType,
            wakifName: body.fullName,
            status: 'interested',
            message:
              'Alhamdulillah. Niat suci wakaf Anda telah kami catat. Tim Amil & Nadzir Yayasan Tarbiyah Sunnah akan segera menghubungi Bapak/Ibu melalui WhatsApp untuk pendampingan berkas dan syariah.',
          },
          { requestId: ctx.requestId }
        );
      }
    )
  );

  // 3b. GET /api/public/events/:id/check-invitation & check-referral (Validasi Tautan / Kode Undangan Khusus Resmi dari Admin/Panitia)
  const handleCheckInvitation = async (ctx: any) => {
    const db = getDb();
    const eventId = ctx.params.id;
    const rawCode = String(ctx.query.code || '').trim().toUpperCase();

    if (!eventId || !rawCode) {
      return errorResponse('VALIDATION_ERROR', 'Event ID dan kode undangan diperlukan', 400, ctx.requestId);
    }

    const targetEvent = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        attendances: {
          with: {
            person: {
              columns: {
                id: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!targetEvent) {
      return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
    }

    const officialAdminCode =
      targetEvent.formConfig?.adminInviteCode?.trim().toUpperCase() ||
      `UNDANGAN-${targetEvent.id.slice(0, 6).toUpperCase()}`;

    const validAdminCodes = [
      officialAdminCode,
      officialAdminCode.replace(/^UNDANGAN-/, ''),
      `UNDANGAN-${targetEvent.id.slice(0, 6).toUpperCase()}`,
      targetEvent.id.slice(0, 6).toUpperCase(),
    ];

    if (!validAdminCodes.includes(rawCode)) {
      return errorResponse('NOT_FOUND', 'Kode undangan khusus panitia tidak ditemukan atau tidak valid untuk kajian ini.', 404, ctx.requestId);
    }

    const atts = targetEvent.attendances || [];
    const inviteAtts = atts.filter(isSpecialInviteRegistration);
    const inviteIkhwan = inviteAtts.filter((a) => a.person?.gender === 'ikhwan').length;
    const inviteAkhwat = inviteAtts.filter((a) => a.person?.gender === 'akhwat').length;

    if (targetEvent.quotaInvite && inviteAtts.length >= targetEvent.quotaInvite) {
      return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota pendaftaran untuk jalur undangan khusus panitia telah penuh.', 400, ctx.requestId);
    }
    if (
      targetEvent.quotaInviteIkhwan &&
      targetEvent.quotaInviteAkhwat &&
      inviteIkhwan >= targetEvent.quotaInviteIkhwan &&
      inviteAkhwat >= targetEvent.quotaInviteAkhwat
    ) {
      return errorResponse('VALIDATION_ERROR', 'Mohon maaf, seluruh kuota pendaftaran jalur undangan (Ikhwan dan Akhwat) telah penuh.', 400, ctx.requestId);
    }

    return successResponse(
      {
        valid: true,
        isAdminInvite: true,
        inviteCode: officialAdminCode,
        referralCode: officialAdminCode,
        referrerDisplayName: 'Panitia Yayasan (Khusus)',
        label: 'Jalur Undangan Khusus Panitia',
        eventTitle: targetEvent.title,
      },
      { requestId: ctx.requestId }
    );
  };

  router.get('/api/public/events/:id/check-invitation', handleCheckInvitation);
  router.get('/api/public/events/:id/check-referral', handleCheckInvitation);

  // Staff route intentionally requires a per-event secret and never exposes it in public event data.
  router.get('/api/public/events/:id/staff-registration', async (ctx) => {
    const eventId = ctx.params.id;
    const staffToken = typeof ctx.query.token === 'string' ? ctx.query.token : null;
    if (!eventId) return errorResponse('VALIDATION_ERROR', 'ID kajian diperlukan', 400, ctx.requestId);

    const targetEvent = await getDb().query.events.findFirst({
      where: eq(events.id, eventId),
      with: { attendances: { with: { person: { columns: { id: true, gender: true } } } } },
    });

    if (!targetEvent || !hasValidStaffRegistrationToken(staffToken, targetEvent.staffRegistrationToken)) {
      return errorResponse('NOT_FOUND', 'Tautan pendaftaran staff tidak valid atau sudah diganti.', 404, ctx.requestId);
    }

    const staffAtts = (targetEvent.attendances || []).filter(isStaffRegistration);
    const staffIkhwan = staffAtts.filter((a) => a.person?.gender === 'ikhwan').length;
    const staffAkhwat = staffAtts.filter((a) => a.person?.gender === 'akhwat').length;
    const isPast = isEventPast(targetEvent);
    const isStaffIkhwanFull = Boolean(targetEvent.quotaStaffIkhwan && staffIkhwan >= targetEvent.quotaStaffIkhwan);
    const isStaffAkhwatFull = Boolean(targetEvent.quotaStaffAkhwat && staffAkhwat >= targetEvent.quotaStaffAkhwat);
    const isFull = Boolean(
      (targetEvent.quotaStaff && staffAtts.length >= targetEvent.quotaStaff) ||
      (targetEvent.targetAudience === 'ikhwan_only' && isStaffIkhwanFull) ||
      (targetEvent.targetAudience === 'akhwat_only' && isStaffAkhwatFull) ||
      (Boolean(targetEvent.quotaStaffIkhwan && targetEvent.quotaStaffAkhwat) && isStaffIkhwanFull && isStaffAkhwatFull)
    );
    const registrationClosedReason = isPast
      ? 'event_past'
      : !targetEvent.isStaffRegistrationOpen
        ? 'closed_by_organizer'
        : isFull
          ? 'quota_full'
          : null;

    return successResponse(
      {
        event: {
          id: targetEvent.id,
          title: targetEvent.title,
          category: targetEvent.category,
          speaker: targetEvent.speaker,
          description: targetEvent.description,
          startAt: targetEvent.startAt,
          endAt: targetEvent.endAt,
          deliveryMode: targetEvent.deliveryMode,
          locationName: targetEvent.locationName,
          locationAddress: targetEvent.locationAddress,
          googleMapsUrl: targetEvent.googleMapsUrl,
          locationDirections: targetEvent.locationDirections,
          showGoogleMaps: targetEvent.showGoogleMaps,
          targetAudience: targetEvent.targetAudience,
          venueRules: targetEvent.venueRules || [],
          customVenueRules: targetEvent.customVenueRules,
          formConfig: {
            requireRulesAgreement: targetEvent.formConfig?.requireRulesAgreement !== false,
            allowStaffFamilyRegistration: targetEvent.formConfig?.allowStaffFamilyRegistration === true,
            maxStaffFamilyParticipants: Math.min(20, Math.max(1, targetEvent.formConfig?.maxStaffFamilyParticipants ?? 4)),
          },
          isRegistrationOpen: targetEvent.isStaffRegistrationOpen && !isPast && !isFull,
          isPast,
          registrationClosedReason,
        },
        quota: {
          total: targetEvent.quotaStaff,
          ikhwan: targetEvent.quotaStaffIkhwan,
          akhwat: targetEvent.quotaStaffAkhwat,
          used: staffAtts.length,
          usedIkhwan: staffIkhwan,
          usedAkhwat: staffAkhwat,
          remaining: targetEvent.quotaStaff ? Math.max(0, targetEvent.quotaStaff - staffAtts.length) : null,
          remainingIkhwan: targetEvent.quotaStaffIkhwan ? Math.max(0, targetEvent.quotaStaffIkhwan - staffIkhwan) : null,
          remainingAkhwat: targetEvent.quotaStaffAkhwat ? Math.max(0, targetEvent.quotaStaffAkhwat - staffAkhwat) : null,
          isIkhwanFull: isStaffIkhwanFull,
          isAkhwatFull: isStaffAkhwatFull,
        },
      },
      { requestId: ctx.requestId }
    );
  });

  router.post(
    '/api/public/register-staff-event',
    validateBody(publicStaffEventRegistrationSchema, async (ctx, body) => {
      return withEventRegistrationLock(getDb(), body.eventId, async (db) => {
      const targetEvent = await db.query.events.findFirst({
        where: eq(events.id, body.eventId),
        with: { attendances: { with: { person: { columns: { id: true, gender: true } } } } },
      });

      if (!targetEvent || !hasValidStaffRegistrationToken(body.staffToken, targetEvent.staffRegistrationToken)) {
        return errorResponse('NOT_FOUND', 'Tautan pendaftaran staff tidak valid atau sudah diganti.', 404, ctx.requestId);
      }
      if (isEventPast(targetEvent)) {
        return errorResponse('VALIDATION_ERROR', 'Pendaftaran staff ditutup karena kajian telah berlalu.', 400, ctx.requestId);
      }
      if (!targetEvent.isStaffRegistrationOpen) {
        return errorResponse('VALIDATION_ERROR', 'Pendaftaran khusus staff belum dibuka atau telah ditutup oleh pengurus.', 400, ctx.requestId);
      }
      if (targetEvent.formConfig?.requireRulesAgreement !== false && !body.agreedToRules) {
        return errorResponse('VALIDATION_ERROR', 'Anda wajib menyetujui tata tertib kajian sebelum mendaftar.', 400, ctx.requestId);
      }

      const fixedGender = targetEvent.targetAudience === 'akhwat_only' ? 'akhwat' : targetEvent.targetAudience === 'ikhwan_only' ? 'ikhwan' : null;
      const gender = fixedGender || body.gender || null;
      if (targetEvent.targetAudience === 'umum' && !gender) {
        return errorResponse('VALIDATION_ERROR', 'Jenis kelamin wajib dipilih untuk pendaftaran staff.', 400, ctx.requestId);
      }

      const requestedFamily = body.additionalParticipants || [];
      const allowStaffFamily = targetEvent.formConfig?.allowStaffFamilyRegistration === true;
      const maxStaffFamilyParticipants = Math.min(20, Math.max(1, targetEvent.formConfig?.maxStaffFamilyParticipants ?? 4));
      if (!allowStaffFamily && requestedFamily.length > 0) {
        return errorResponse('VALIDATION_ERROR', 'Pendaftaran keluarga staff belum diaktifkan untuk kajian ini.', 400, ctx.requestId);
      }
      if (requestedFamily.length > maxStaffFamilyParticipants) {
        return errorResponse('VALIDATION_ERROR', `Maksimal ${maxStaffFamilyParticipants} anggota keluarga dapat ditambahkan dalam satu pendaftaran staff.`, 400, ctx.requestId);
      }

      const additionalList = requestedFamily.map((member) => ({
        ...member,
        gender: fixedGender || member.gender || null,
      }));
      for (const member of additionalList) {
        if (!member.gender) {
          return errorResponse('VALIDATION_ERROR', `Jenis kelamin wajib dipilih untuk anggota keluarga ${member.fullName}.`, 400, ctx.requestId);
        }
        if (targetEvent.minAge && (!member.age || member.age < targetEvent.minAge)) {
          return errorResponse('VALIDATION_ERROR', `Anggota keluarga ${member.fullName} belum memenuhi usia minimal ${targetEvent.minAge} tahun.`, 400, ctx.requestId);
        }
      }

      const primaryIkhwan = gender === 'ikhwan' ? 1 : 0;
      const primaryAkhwat = gender === 'akhwat' ? 1 : 0;
      const newIkhwan = primaryIkhwan + additionalList.filter((member) => member.gender === 'ikhwan').length;
      const newAkhwat = primaryAkhwat + additionalList.filter((member) => member.gender === 'akhwat').length;
      const totalRegistrantCount = 1 + additionalList.length;
      const staffAtts = (targetEvent.attendances || []).filter(isStaffRegistration);
      const staffIkhwan = staffAtts.filter((a) => a.person?.gender === 'ikhwan').length;
      const staffAkhwat = staffAtts.filter((a) => a.person?.gender === 'akhwat').length;
      if (targetEvent.quotaStaff && staffAtts.length + totalRegistrantCount > targetEvent.quotaStaff) {
        return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran staff tidak mencukupi (sisa ${Math.max(0, targetEvent.quotaStaff - staffAtts.length)} slot).`, 400, ctx.requestId);
      }
      if (newIkhwan > 0 && targetEvent.quotaStaffIkhwan && staffIkhwan + newIkhwan > targetEvent.quotaStaffIkhwan) {
        return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran staff Ikhwan tidak mencukupi (sisa ${Math.max(0, targetEvent.quotaStaffIkhwan - staffIkhwan)} slot).`, 400, ctx.requestId);
      }
      if (newAkhwat > 0 && targetEvent.quotaStaffAkhwat && staffAkhwat + newAkhwat > targetEvent.quotaStaffAkhwat) {
        return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran staff Akhwat tidak mencukupi (sisa ${Math.max(0, targetEvent.quotaStaffAkhwat - staffAkhwat)} slot).`, 400, ctx.requestId);
      }

      const phoneNorm = normalizeIndonesianPhone(body.phone);
      let person = await db.query.persons.findFirst({ where: eq(persons.phoneE164, phoneNorm) });
      const primaryNameKey = body.fullName.trim().toLocaleLowerCase('id-ID');
      const familyNameKeys = new Set<string>();
      for (const [familyIndex, member] of additionalList.entries()) {
        const memberNameKey = member.fullName.trim().toLocaleLowerCase('id-ID');
        if (memberNameKey === primaryNameKey || familyNameKeys.has(memberNameKey)) {
          return errorResponse('VALIDATION_ERROR', 'Setiap anggota keluarga harus memiliki nama yang berbeda dari staff utama dan anggota lainnya.', 400, ctx.requestId);
        }
        familyNameKeys.add(memberNameKey);

        const virtualPhone = `${phoneNorm}-staff-family-${familyIndex + 1}`;
        const existingFamilyPerson = await db.query.persons.findFirst({
          where: sql`${persons.fullName} = ${member.fullName} AND (${persons.phoneE164} = ${virtualPhone} OR ${persons.phoneE164} = ${phoneNorm})`,
        });
        if (existingFamilyPerson) {
          const existingFamilyAttendance = await db.query.eventAttendance.findFirst({
            where: and(eq(eventAttendance.eventId, targetEvent.id), eq(eventAttendance.personId, existingFamilyPerson.id)),
          });
          if (existingFamilyAttendance) {
            return errorResponse('CONFLICT', `Anggota keluarga ${member.fullName} sudah terdaftar pada kajian ini.`, 409, ctx.requestId);
          }
        }
      }

      if (!person) {
        const [createdPerson] = await db.insert(persons).values({
          fullName: body.fullName,
          phoneE164: phoneNorm,
          email: body.email?.trim() ? body.email.trim().toLowerCase() : null,
          gender,
          sourceCode: 'staff_event_registration',
          engagementStatus: 'baru',
          preferredChannel: 'whatsapp',
        }).returning();
        person = createdPerson;
      }

      const existingAttendance = person
        ? await db.query.eventAttendance.findFirst({ where: and(eq(eventAttendance.eventId, targetEvent.id), eq(eventAttendance.personId, person.id)) })
        : null;
      if (existingAttendance) {
        return errorResponse('CONFLICT', 'Nomor WhatsApp ini sudah terdaftar pada kajian ini.', 409, ctx.requestId);
      }

      const ticketCode = createMemorableTicketCode();
      const registrationGroupId = additionalList.length > 0 ? `STAFF-${randomBytes(6).toString('hex').toUpperCase()}` : null;
      await db.insert(eventAttendance).values({
        eventId: targetEvent.id,
        personId: person!.id,
        source: 'form_registration',
        status: 'registered',
        ticketCode,
        registrationGroupId,
        familyRelationship: registrationGroupId ? 'Staff / Pendaftar Utama' : null,
        paymentStatus: 'free',
        vehicleType: 'none',
        agreedToRules: body.agreedToRules,
        registrationData: {
          registrationChannel: STAFF_REGISTRATION_CHANNEL,
          registrationType: 'staff',
          unitName: body.unitName.trim(),
          roleName: body.roleName.trim(),
          employeeNumber: body.employeeNumber?.trim() || null,
          notes: body.notes?.trim() || null,
        },
      });

      const groupTickets: Array<{ name: string; gender: string; relationship: string; age?: number | null; ticketCode: string; isStaffFamily: boolean }> = [
        { name: body.fullName, gender: gender || 'tidak_ditentukan', relationship: registrationGroupId ? 'Staff / Pendaftar Utama' : 'Staff Yayasan', ticketCode, isStaffFamily: false },
      ];

      for (const [familyIndex, member] of additionalList.entries()) {
        const familyTicketCode = createMemorableTicketCode();
        const virtualPhone = `${phoneNorm}-staff-family-${familyIndex + 1}`;
        let familyPerson = await db.query.persons.findFirst({
          where: sql`${persons.fullName} = ${member.fullName} AND (${persons.phoneE164} = ${virtualPhone} OR ${persons.phoneE164} = ${phoneNorm})`,
        });
        if (!familyPerson) {
          const [createdFamilyPerson] = await db.insert(persons).values({
            fullName: member.fullName,
            phoneE164: virtualPhone,
            gender: member.gender,
            sourceCode: 'staff_event_family_registration',
            engagementStatus: 'baru',
            preferredChannel: 'whatsapp',
          }).returning();
          familyPerson = createdFamilyPerson;
        }
        if (!familyPerson) return errorResponse('INTERNAL_ERROR', 'Gagal memproses data anggota keluarga staff.', 500, ctx.requestId);

        await db.insert(eventAttendance).values({
          eventId: targetEvent.id,
          personId: familyPerson.id,
          source: 'form_registration',
          status: 'registered',
          ticketCode: familyTicketCode,
          registrationGroupId,
          familyRelationship: member.relationship || 'Keluarga Staff',
          age: member.age || null,
          paymentStatus: 'free',
          vehicleType: 'none',
          agreedToRules: true,
          registrationData: {
            registrationChannel: STAFF_FAMILY_REGISTRATION_CHANNEL,
            registrationType: 'staff_family',
            registeredByStaffName: body.fullName,
            staffUnitName: body.unitName.trim(),
            relationship: member.relationship || 'Keluarga Staff',
            ...(member.notes ? { notes: member.notes } : {}),
          },
        });
        groupTickets.push({
          name: member.fullName,
          gender: member.gender || 'tidak_ditentukan',
          relationship: member.relationship || 'Keluarga Staff',
          age: member.age || null,
          ticketCode: familyTicketCode,
          isStaffFamily: true,
        });
      }

      return successResponse({
        ticketCode,
        participantPortalPath: buildParticipantPortalPath(targetEvent.id, ticketCode),
        registrationGroupId,
        isGroupRegistration: additionalList.length > 0,
        totalParticipantsCount: totalRegistrantCount,
        isStaffRegistration: true,
        groupTickets,
        participant: { name: body.fullName, gender, unitName: body.unitName, roleName: body.roleName },
        event: { id: targetEvent.id, title: targetEvent.title, speaker: targetEvent.speaker, startAt: targetEvent.startAt, locationName: targetEvent.locationName },
      }, { requestId: ctx.requestId }, 201);
      });
    })
  );

  // 3c. GET /api/public/events/:id (Public Event Detail by ID)
  router.get('/api/public/events/:id', async (ctx) => {
    const db = getDb();
    const eventId = ctx.params.id;

    if (!eventId) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian diperlukan', 400, ctx.requestId);
    }

    const targetEvent = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        attendances: {
          with: {
            person: {
              columns: {
                id: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!targetEvent) {
      return errorResponse('NOT_FOUND', 'Jadwal kajian tidak ditemukan', 404, ctx.requestId);
    }

    const atts = targetEvent.attendances || [];
    const { whatsappGroupIkhwanUrl, whatsappGroupAkhwatUrl, ...publicFormConfig } = targetEvent.formConfig || {};
    const ikhwanCount = atts.filter((a) => a.person?.gender === 'ikhwan').length;
    const akhwatCount = atts.filter((a) => a.person?.gender === 'akhwat').length;
    const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
    const motorcyclesCount = atts.filter((a) => a.vehicleType === 'motorcycle').length;
    const isPast = isEventPast(targetEvent);

    const inviteAtts = atts.filter(isSpecialInviteRegistration);
    const regularAtts = atts.filter(isRegularRegistration);

    const specialInviteCount = inviteAtts.length;
    const specialInviteIkhwanCount = inviteAtts.filter((a) => a.person?.gender === 'ikhwan').length;
    const specialInviteAkhwatCount = inviteAtts.filter((a) => a.person?.gender === 'akhwat').length;

    const regularCount = regularAtts.length;
    const regularIkhwanCount = regularAtts.filter((a) => a.person?.gender === 'ikhwan').length;
    const regularAkhwatCount = regularAtts.filter((a) => a.person?.gender === 'akhwat').length;

    const isRegularFull = Boolean(
      (targetEvent.quota && regularCount >= targetEvent.quota) ||
      (targetEvent.targetAudience === 'ikhwan_only' && targetEvent.quotaIkhwan && regularIkhwanCount >= targetEvent.quotaIkhwan) ||
      (targetEvent.targetAudience === 'akhwat_only' && targetEvent.quotaAkhwat && regularAkhwatCount >= targetEvent.quotaAkhwat) ||
      (targetEvent.quotaIkhwan && targetEvent.quotaAkhwat && regularIkhwanCount >= targetEvent.quotaIkhwan && regularAkhwatCount >= targetEvent.quotaAkhwat)
    );

    const isInviteFull = Boolean(
      (targetEvent.quotaInvite && specialInviteCount >= targetEvent.quotaInvite) ||
      (targetEvent.targetAudience === 'ikhwan_only' && targetEvent.quotaInviteIkhwan && specialInviteIkhwanCount >= targetEvent.quotaInviteIkhwan) ||
      (targetEvent.targetAudience === 'akhwat_only' && targetEvent.quotaInviteAkhwat && specialInviteAkhwatCount >= targetEvent.quotaInviteAkhwat) ||
      (targetEvent.quotaInviteIkhwan && targetEvent.quotaInviteAkhwat && specialInviteIkhwanCount >= targetEvent.quotaInviteIkhwan && specialInviteAkhwatCount >= targetEvent.quotaInviteAkhwat)
    );

    return successResponse(
      {
        event: {
          id: targetEvent.id,
          title: targetEvent.title,
          category: targetEvent.category,
          speaker: targetEvent.speaker,
          description: targetEvent.description,
          startAt: targetEvent.startAt.toISOString(),
          endAt: targetEvent.endAt ? targetEvent.endAt.toISOString() : null,
          deliveryMode: targetEvent.deliveryMode,
          locationName: targetEvent.locationName || 'Masjid Tarbiyah Sunnah',
          locationAddress: targetEvent.locationAddress,
          googleMapsUrl: targetEvent.googleMapsUrl,
          locationDirections: targetEvent.locationDirections,
          showGoogleMaps: targetEvent.showGoogleMaps,
          meetingUrl: targetEvent.meetingUrl,
          targetAudience: targetEvent.targetAudience || 'umum',
          minAge: targetEvent.minAge || null,
          quota: targetEvent.quota,
          quotaIkhwan: targetEvent.quotaIkhwan,
          quotaAkhwat: targetEvent.quotaAkhwat,
          quotaInvite: targetEvent.quotaInvite,
          quotaInviteIkhwan: targetEvent.quotaInviteIkhwan,
          quotaInviteAkhwat: targetEvent.quotaInviteAkhwat,
          carParkingQuota: targetEvent.carParkingQuota,
          motorcycleParkingQuota: targetEvent.motorcycleParkingQuota,
          venueRules: targetEvent.venueRules || [],
          customVenueRules: targetEvent.customVenueRules,
          isRegistrationOpen: targetEvent.isRegistrationOpen && !isPast,
          isPast,
          isRegularFull,
          isInviteFull,
          formConfig: publicFormConfig,
          attendanceCount: atts.length,
          ikhwanCount,
          akhwatCount,
          carsCount,
          motorcyclesCount,
          specialInviteCount,
          specialInviteIkhwanCount,
          specialInviteAkhwatCount,
          regularCount,
          regularIkhwanCount,
          regularAkhwatCount,
        },
      },
      { requestId: ctx.requestId }
    );
  });

  // 4. POST /api/public/register-event (Online Registration for Kajian Rutin & Daurah Khusus)
  router.post(
    '/api/public/register-event',
    validateBody(publicEventRegistrationSchema, async (ctx, body) => {
      return withEventRegistrationLock(getDb(), body.eventId, async (db) => {
      const phoneNorm = normalizeIndonesianPhone(body.phone);

      // Check event existence with attendances
      const targetEvent = await db.query.events.findFirst({
        where: eq(events.id, body.eventId),
        with: {
          attendances: {
            with: {
              person: {
                columns: {
                  id: true,
                  gender: true,
                },
              },
            },
          },
        },
      });

      if (!targetEvent) {
        return errorResponse('NOT_FOUND', 'Jadwal kajian tidak ditemukan', 404, ctx.requestId);
      }

      if (isEventPast(targetEvent)) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Mohon maaf, pendaftaran tidak dapat diproses karena kajian ini telah selesai dilaksanakan atau telah berlalu.',
          400,
          ctx.requestId
        );
      }

      if (targetEvent.isRegistrationOpen === false) {
        return errorResponse('VALIDATION_ERROR', 'Pendaftaran untuk kajian ini telah ditutup oleh pengurus', 400, ctx.requestId);
      }

      // Validasi Persetujuan Tata Tertib & Syarat Kajian
      const requireRules = targetEvent.formConfig?.requireRulesAgreement !== false;
      if (requireRules && body.agreedToRules === false) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Anda wajib membaca dan menyetujui Tata Tertib Majelis Ilmu serta Syarat Kajian sebelum mendaftar.',
          400,
          ctx.requestId
        );
      }

      const fixedGender =
        targetEvent.targetAudience === 'akhwat_only'
          ? 'akhwat'
          : targetEvent.targetAudience === 'ikhwan_only'
            ? 'ikhwan'
            : null;
      // Untuk kajian umum, gender hanya dikumpulkan bila Form Builder mengaktifkannya.
      const gender = fixedGender || (targetEvent.formConfig?.requireGender === false ? null : body.gender || null);
      const shouldCollectEmail = targetEvent.formConfig?.collectEmail !== false;
      const isEmailRequired = targetEvent.formConfig?.requireEmail === true;
      const rawEmail = typeof body.email === 'string' && body.email.trim() !== '' ? body.email.trim().toLowerCase() : null;
      const email = shouldCollectEmail ? rawEmail : null;

      if (shouldCollectEmail && isEmailRequired && !email) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Alamat email wajib diisi untuk pendaftaran kajian ini.',
          400,
          ctx.requestId
        );
      }

      const cityRegency = targetEvent.formConfig?.collectCity !== false ? body.cityRegency || null : null;

      // 1. Audience Target Validation
      if (targetEvent.targetAudience === 'akhwat_only' && body.gender && body.gender !== 'akhwat') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Akhwat (Wanita)', 400, ctx.requestId);
      }
      if (targetEvent.targetAudience === 'ikhwan_only' && body.gender && body.gender !== 'ikhwan') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Ikhwan (Laki-laki)', 400, ctx.requestId);
      }

      // 1b. Minimum Age Requirement Validation
      if (targetEvent.minAge && targetEvent.minAge > 0) {
        if (!body.age) {
          return errorResponse(
            'VALIDATION_ERROR',
            `Usia wajib diisi untuk pendaftaran kajian ini (minimal ${targetEvent.minAge} tahun).`,
            400,
            ctx.requestId
          );
        }
        if (body.age < targetEvent.minAge) {
          return errorResponse(
            'VALIDATION_ERROR',
            `Mohon maaf, pendaftaran kajian ini dikhususkan untuk peserta berusia minimal ${targetEvent.minAge} tahun. Usia Anda (${body.age} tahun) belum mencukupi.`,
            400,
            ctx.requestId
          );
        }
      }

      const rawInvite = (body.inviteCode || body.referralCode)?.trim().toUpperCase() || null;
      let isSpecialInvite = false;
      let officialAdminInviteCode: string | null = null;

      if (rawInvite) {
        const officialCode =
          targetEvent.formConfig?.adminInviteCode?.trim().toUpperCase() ||
          `UNDANGAN-${targetEvent.id.slice(0, 6).toUpperCase()}`;

        const validAdminCodes = [
          officialCode,
          officialCode.replace(/^UNDANGAN-/, ''),
          `UNDANGAN-${targetEvent.id.slice(0, 6).toUpperCase()}`,
          targetEvent.id.slice(0, 6).toUpperCase(),
        ];

        if (validAdminCodes.includes(rawInvite)) {
          isSpecialInvite = true;
          officialAdminInviteCode = officialCode;
        } else {
          return errorResponse('VALIDATION_ERROR', 'Kode undangan khusus panitia tidak valid untuk kajian ini.', 400, ctx.requestId);
        }
      }

      // Rombongan hanya diproses jika diaktifkan panitia; batas berlaku pula untuk payload yang dimanipulasi.
      const maxMultiParticipants = Math.min(20, Math.max(1, targetEvent.formConfig?.maxMultiParticipants ?? 10));
      const additionalList = targetEvent.formConfig?.allowMultiParticipant !== false
        ? (body.additionalParticipants || []).slice(0, maxMultiParticipants)
        : [];

      // Companion Minimum Age Validation
      if (targetEvent.minAge && targetEvent.minAge > 0 && additionalList.length > 0) {
        for (const member of additionalList) {
          if (!member.age) {
            return errorResponse(
              'VALIDATION_ERROR',
              `Usia peserta rombongan (${member.fullName}) wajib diisi untuk kajian ini (minimal ${targetEvent.minAge} tahun).`,
              400,
              ctx.requestId
            );
          }
          if (member.age < targetEvent.minAge) {
            return errorResponse(
              'VALIDATION_ERROR',
              `Mohon maaf, peserta rombongan "${member.fullName}" berusia ${member.age} tahun belum memenuhi syarat minimal usia (${targetEvent.minAge} tahun).`,
              400,
              ctx.requestId
            );
          }
        }
      }

      // 2. Segmented Dual Quota Validations (Reguler vs Jalur Undangan)
      const primaryIkhwan = gender === 'ikhwan' ? 1 : 0;
      const primaryAkhwat = gender === 'akhwat' ? 1 : 0;
      const addIkhwan = additionalList.filter((m: any) => (m.gender || 'ikhwan') === 'ikhwan').length;
      const addAkhwat = additionalList.filter((m: any) => m.gender === 'akhwat').length;
      const newIkhwan = primaryIkhwan + addIkhwan;
      const newAkhwat = primaryAkhwat + addAkhwat;
      const newTotal = 1 + additionalList.length;

      const atts = targetEvent.attendances || [];
      const currentCars = atts.filter((a) => a.vehicleType === 'car').length;
      const currentMotorcycles = atts.filter((a) => a.vehicleType === 'motorcycle').length;
      // Jika panitia menyembunyikan fasilitas parkir, jangan simpan atau hitung input kendaraan yang dikirim klien.
      const vehicleType = targetEvent.formConfig?.collectVehicle === false ? 'none' : body.vehicleType;
      const vehiclePlateNumber = vehicleType === 'none' ? null : body.vehiclePlateNumber || null;

      const existingInviteAtts = atts.filter(isSpecialInviteRegistration);
      const existingRegAtts = atts.filter(isRegularRegistration);

      const inviteIkhwan = existingInviteAtts.filter((a) => a.person?.gender === 'ikhwan').length;
      const inviteAkhwat = existingInviteAtts.filter((a) => a.person?.gender === 'akhwat').length;
      const regularIkhwan = existingRegAtts.filter((a) => a.person?.gender === 'ikhwan').length;
      const regularAkhwat = existingRegAtts.filter((a) => a.person?.gender === 'akhwat').length;

      if (isSpecialInvite) {
        if (newIkhwan > 0 && targetEvent.quotaInviteIkhwan && inviteIkhwan + newIkhwan > targetEvent.quotaInviteIkhwan) {
          const sisa = Math.max(0, targetEvent.quotaInviteIkhwan - inviteIkhwan);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota jalur undangan khusus Jamaah Ikhwan tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
        if (newAkhwat > 0 && targetEvent.quotaInviteAkhwat && inviteAkhwat + newAkhwat > targetEvent.quotaInviteAkhwat) {
          const sisa = Math.max(0, targetEvent.quotaInviteAkhwat - inviteAkhwat);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota jalur undangan khusus Jamaah Akhwat tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
        if (targetEvent.quotaInvite && existingInviteAtts.length + newTotal > targetEvent.quotaInvite) {
          const sisa = Math.max(0, targetEvent.quotaInvite - existingInviteAtts.length);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota keseluruhan jalur undangan tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
      } else {
        if (newIkhwan > 0 && targetEvent.quotaIkhwan && regularIkhwan + newIkhwan > targetEvent.quotaIkhwan) {
          const sisa = Math.max(0, targetEvent.quotaIkhwan - regularIkhwan);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota pendaftaran reguler khusus Jamaah Ikhwan tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
        if (newAkhwat > 0 && targetEvent.quotaAkhwat && regularAkhwat + newAkhwat > targetEvent.quotaAkhwat) {
          const sisa = Math.max(0, targetEvent.quotaAkhwat - regularAkhwat);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota pendaftaran reguler khusus Jamaah Akhwat tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
        if (targetEvent.quota && existingRegAtts.length + newTotal > targetEvent.quota) {
          const sisa = Math.max(0, targetEvent.quota - existingRegAtts.length);
          return errorResponse('VALIDATION_ERROR', `Mohon maaf, kuota pendaftaran reguler tidak mencukupi (sisa ${sisa} slot).`, 400, ctx.requestId);
        }
      }

      // 3. Parking Facility Quota Validations
      if (vehicleType === 'car' && targetEvent.carParkingQuota && currentCars >= targetEvent.carParkingQuota) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, slot fasilitas parkir mobil telah penuh. Silakan gunakan sepeda motor atau transportasi umum.', 400, ctx.requestId);
      }
      if (vehicleType === 'motorcycle' && targetEvent.motorcycleParkingQuota && currentMotorcycles >= targetEvent.motorcycleParkingQuota) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, slot fasilitas parkir sepeda motor telah penuh.', 400, ctx.requestId);
      }

      // Find or create person record
      let person = await db.query.persons.findFirst({
        where: eq(persons.phoneE164, phoneNorm),
      });

      if (!person) {
        const [newPerson] = await db
          .insert(persons)
          .values({
            fullName: body.fullName,
            phoneE164: phoneNorm,
            email,
            gender,
            cityRegency,
            sourceCode: 'public_portal_kajian',
            engagementStatus: 'baru',
            preferredChannel: 'whatsapp',
          })
          .returning();
        person = newPerson;
      } else if (email && (!person.email || person.email !== email)) {
        await db
          .update(persons)
          .set({
            email,
            updatedAt: new Date(),
          })
          .where(eq(persons.id, person.id));
        person.email = email;
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data jamaah', 500, ctx.requestId);
      }

      // Check if already registered for this event
      const existingAttendance = await db.query.eventAttendance.findFirst({
        where: sql`${eventAttendance.eventId} = ${body.eventId} AND ${eventAttendance.personId} = ${person.id}`,
      });

      const isGroup = additionalList.length > 0;
      const totalParticipantsCount = 1 + additionalList.length;

      // Kode dibaca cepat oleh petugas (contoh: YTS-ILMU-NUR-482), tetapi tetap acak.
      const datePart = new Date(targetEvent.startAt).toISOString().slice(2, 10).replace(/-/g, '');
      const groupPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const registrationGroupId = isGroup ? `GRP-${datePart}-${groupPart}` : null;
      const ticketCode = existingAttendance?.ticketCode || createMemorableTicketCode();
      const attendanceSource = 'form_registration';

      // Determine payment status
      const isPaidEvent = targetEvent.isPaid && (targetEvent.priceRupiah || 0) > 0;
      let initialPaymentStatus = 'free';
      if (isPaidEvent) {
        initialPaymentStatus = body.paymentProofUrl ? 'waiting_verification' : 'pending_payment';
      }

      const totalGroupPrice = isPaidEvent ? totalParticipantsCount * (targetEvent.priceRupiah || 0) : 0;

      // Upload payment proof to Contabo S3 if provided
      const storedProofUrl = await ensureS3StorageUrl(
        body.paymentProofUrl,
        'event-proofs',
        `tiket_${ticketCode}`
      );

      if (!existingAttendance) {
        await db.insert(eventAttendance).values({
          eventId: targetEvent.id,
          personId: person.id,
          source: attendanceSource,
          status: 'registered',
          ticketCode,
          referralCode: null,
          referredByAttendanceId: null,
          
          registrationGroupId,
          familyRelationship: isGroup ? 'Kepala Keluarga / Pendaftar Utama' : null,
          age: body.age || null,

          paymentStatus: initialPaymentStatus,
          paymentProofUrl: storedProofUrl || null,
          paymentAmountRupiah: isPaidEvent ? (body.paymentAmountRupiah || totalGroupPrice) : 0,

          vehicleType,
          vehiclePlateNumber,
          agreedToRules: body.agreedToRules !== false,
          registrationData: {
            ...(body.customResponses || {}),
            ...(body.notes ? { _generalNotes: body.notes } : {}),
            ...(isSpecialInvite ? { isSpecialInvite: true, adminInviteCode: officialAdminInviteCode, inviteSource: 'admin_invite' } : {}),
          },
        });
      } else {
        if (isSpecialInvite) {
          await db
            .update(eventAttendance)
            .set({
              registrationData: {
                ...((existingAttendance.registrationData as any) || {}),
                isSpecialInvite: true,
                adminInviteCode: officialAdminInviteCode,
                inviteSource: 'admin_invite',
              },
            })
            .where(eq(eventAttendance.id, existingAttendance.id));
        }

        if (isPaidEvent && body.paymentProofUrl && existingAttendance.paymentStatus !== 'verified') {
        // Allow re-uploading payment proof if pending or rejected
        await db
          .update(eventAttendance)
          .set({
            paymentStatus: 'waiting_verification',
            paymentProofUrl: storedProofUrl || body.paymentProofUrl,
            paymentAmountRupiah: totalGroupPrice,
            paymentRejectionReason: null,
          })
          .where(eq(eventAttendance.id, existingAttendance.id));
        }
      }

      // Group tickets collection
      const groupTickets: Array<{
        name: string;
        gender: string;
        relationship: string;
        age?: number | null;
        ticketCode: string;
      }> = [
        {
          name: body.fullName,
          gender: gender || 'tidak_ditentukan',
          relationship: isGroup ? 'Kepala Keluarga / Pendaftar Utama' : 'Pendaftar Utama',
          age: body.age || null,
          ticketCode,
        },
      ];

      // Process additional family members / companions
      let memberIdx = 0;
      for (const member of additionalList) {
        memberIdx++;
        const memberPhoneVirtual = `${phoneNorm}-fam-${memberIdx}`;
        const memberTicketCode = createMemorableTicketCode();

        let memberPerson = await db.query.persons.findFirst({
          where: sql`${persons.fullName} = ${member.fullName} AND (${persons.phoneE164} = ${memberPhoneVirtual} OR ${persons.phoneE164} = ${phoneNorm})`,
        });

        if (!memberPerson) {
          const [newMember] = await db
            .insert(persons)
            .values({
              fullName: member.fullName,
              phoneE164: memberPhoneVirtual,
              gender: fixedGender || (targetEvent.formConfig?.requireGender === false ? null : member.gender || null),
              cityRegency,
              sourceCode: 'public_portal_kajian_family',
              engagementStatus: 'baru',
              preferredChannel: 'whatsapp',
            })
            .returning();
          memberPerson = newMember;
        }

        if (memberPerson) {
          const existingMemAtt = await db.query.eventAttendance.findFirst({
            where: sql`${eventAttendance.eventId} = ${targetEvent.id} AND ${eventAttendance.personId} = ${memberPerson.id}`,
          });

          if (!existingMemAtt) {
            await db.insert(eventAttendance).values({
              eventId: targetEvent.id,
              personId: memberPerson.id,
              source: 'form_registration',
              status: 'registered',
              ticketCode: memberTicketCode,
              referralCode: null,
              referredByAttendanceId: null,
              registrationGroupId,
              familyRelationship: member.relationship || 'Keluarga',
              age: member.age || null,
              paymentStatus: initialPaymentStatus,
              paymentProofUrl: body.paymentProofUrl || null,
              paymentAmountRupiah: targetEvent.priceRupiah || 0,
              vehicleType: 'none',
              agreedToRules: true,
              registrationData: {
                ...(member.notes ? { notes: member.notes } : {}),
                ...(isSpecialInvite ? { isSpecialInvite: true, adminInviteCode: officialAdminInviteCode, inviteSource: 'admin_invite' } : {}),
              },
            });
          }

          groupTickets.push({
            name: member.fullName,
            gender: fixedGender || (targetEvent.formConfig?.requireGender === false ? 'tidak_ditentukan' : member.gender || 'tidak_ditentukan'),
            relationship: member.relationship || 'Keluarga',
            age: member.age || null,
            ticketCode: existingMemAtt?.ticketCode || memberTicketCode,
          });
        }
      }

      const res = successResponse(
        {
          ticketCode,
          isSpecialInvite,
          adminInviteCode: officialAdminInviteCode,
          participantPortalPath: buildParticipantPortalPath(targetEvent.id, ticketCode),
          registrationGroupId,
          isGroupRegistration: isGroup,
          totalParticipantsCount,
          groupTickets,
          event: {
            id: targetEvent.id,
            title: targetEvent.title,
            category: targetEvent.category,
            speaker: targetEvent.speaker,
            targetAudience: targetEvent.targetAudience,
            minAge: targetEvent.minAge || null,
            startAt: targetEvent.startAt,
            deliveryMode: targetEvent.deliveryMode,
            locationName: targetEvent.locationName || 'Masjid / Studio Tarbiyah Sunnah',
            meetingUrl: targetEvent.meetingUrl,
            venueRules: targetEvent.venueRules || [],
            isPaid: targetEvent.isPaid,
            priceRupiah: targetEvent.priceRupiah,
            totalPriceRupiah: totalGroupPrice,
            bankName: targetEvent.bankName,
            bankAccountNumber: targetEvent.bankAccountNumber,
            bankAccountName: targetEvent.bankAccountName,
            paymentInstructions: targetEvent.paymentInstructions,
            whatsappGroupInviteUrl: gender
              ? safeWhatsAppGroupUrl(
                  gender === 'akhwat'
                    ? targetEvent.formConfig?.whatsappGroupAkhwatUrl
                    : targetEvent.formConfig?.whatsappGroupIkhwanUrl
                )
              : null,
          },
          participant: {
            name: body.fullName,
            gender,
            phone: phoneNorm,
            email: person.email || email || null,
            vehicleType,
            vehiclePlateNumber,
            paymentStatus: initialPaymentStatus,
            priceRupiah: isPaidEvent ? targetEvent.priceRupiah : 0,
            totalPriceRupiah: totalGroupPrice,
          },
          message: isPaidEvent
            ? (body.paymentProofUrl
                ? `Alhamdulillah, pendaftaran rombongan (${totalParticipantsCount} orang) dan bukti pembayaran Anda berhasil dikirim dan sedang diverifikasi oleh Amil Yayasan Tarbiyah Sunnah.`
                : `Pendaftaran rombongan (${totalParticipantsCount} orang) berhasil dicatat. Silakan lakukan pembayaran total Rp ${totalGroupPrice.toLocaleString('id-ID')} dan unggah bukti transfer.`)
            : `Alhamdulillah, pendaftaran ${isGroup ? `rombongan keluarga (${totalParticipantsCount} orang)` : 'kajian'} Anda berhasil dicatat. Silakan simpan kode tiket ini.`,
        },
        { requestId: ctx.requestId }
      );

      // Send E-Ticket Email if email provided
      if (email) {
        sendEventRegistrationTicketEmail({
          recipientEmail: email,
          recipientName: body.fullName,
          eventTitle: targetEvent.title,
          speaker: targetEvent.speaker,
          startAtFormatted: new Date(targetEvent.startAt).toLocaleString('id-ID', {
            dateStyle: 'full',
            timeStyle: 'short',
          }),
          locationName: targetEvent.locationName || 'Masjid Tarbiyah Sunnah',
          ticketCode,
          gender,
          familyCount: additionalList.length > 0 ? additionalList.length : undefined,
          groupTickets: groupTickets.length > 1 ? groupTickets : undefined,
          isPaid: isPaidEvent,
          priceRupiah: totalGroupPrice,
          eventUrl: `https://yts.web.id/kajian/${targetEvent.id}`,
        }).catch((err) => console.warn('[Email Event Ticket Error]:', err));
      }

      return res;
      });
    })
  );

  // 5. POST /api/public/participant-ticket (Portal peserta; nomor WA menjadi verifikasi kepemilikan tiket)
  const participantTicketSchema = z.object({
    eventId: z.string().uuid('Event tidak valid').optional().nullable(),
    ticketCode: z.string().min(3, 'Kode tiket wajib diisi'),
    phone: z.string().optional().nullable(),
  });

  router.post(
    '/api/public/participant-ticket',
    validateBody(participantTicketSchema, async (ctx, body) => {
      const db = getDb();
      const ticketCode = extractTicketCode(body.ticketCode);
      const rawCode = body.ticketCode.trim().toUpperCase();

      const codeCandidates = [rawCode];
      if (ticketCode && !codeCandidates.includes(ticketCode)) {
        codeCandidates.push(ticketCode);
      }
      if (/^\d{4,6}$/.test(rawCode)) {
        codeCandidates.push(`YTS-${rawCode}`, `TIKET-${rawCode}`);
      }

      const attendanceWhere = body.eventId
        ? and(
            eq(eventAttendance.eventId, body.eventId),
            or(
              inArray(eventAttendance.ticketCode, codeCandidates),
              eq(eventAttendance.ticketCode, ticketCode),
              eq(eventAttendance.ticketCode, rawCode)
            )
          )
        : or(
            inArray(eventAttendance.ticketCode, codeCandidates),
            eq(eventAttendance.ticketCode, ticketCode),
            eq(eventAttendance.ticketCode, rawCode)
          );

      const attendance = await db.query.eventAttendance.findFirst({
        where: attendanceWhere,
        with: { person: true, event: true },
      });

      // Pesan dibuat generik supaya kode tiket tidak dapat dipakai untuk menebak data jamaah.
      if (!attendance) {
        return errorResponse('NOT_FOUND', 'Tiket atau nomor WhatsApp tidak sesuai.', 404, ctx.requestId);
      }

      // Validasi kepemilikan nomor telepon jika nomor diinput:
      let isPhoneAuthorized = true;
      if (body.phone && body.phone.trim().length >= 8) {
        const phoneE164 = normalizeIndonesianPhone(body.phone);
        isPhoneAuthorized =
          attendance.person?.phoneE164 === phoneE164 ||
          Boolean(attendance.person?.phoneE164?.startsWith(`${phoneE164}-fam-`));

        if (!isPhoneAuthorized && attendance.registrationGroupId) {
          const groupParentAttendance = await db.query.eventAttendance.findFirst({
            where: eq(eventAttendance.registrationGroupId, attendance.registrationGroupId),
            with: { person: true },
          });
          if (
            groupParentAttendance?.person?.phoneE164 === phoneE164 ||
            Boolean(groupParentAttendance?.person?.phoneE164?.startsWith(`${phoneE164}-fam-`))
          ) {
            isPhoneAuthorized = true;
          }
        }
      }

      if (!isPhoneAuthorized) {
        return errorResponse('NOT_FOUND', 'Tiket atau nomor WhatsApp tidak sesuai.', 404, ctx.requestId);
      }

      const event = attendance.event || (await db.query.events.findFirst({ where: eq(events.id, attendance.eventId) }));
      if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

      let groupMembers: any[] = [];
      if (attendance.registrationGroupId) {
        const allGroupAtts = await db.query.eventAttendance.findMany({
          where: eq(eventAttendance.registrationGroupId, attendance.registrationGroupId),
          with: { person: true },
          orderBy: [asc(eventAttendance.checkInAt)],
        });
        groupMembers = allGroupAtts.map((ga) => ({
          attendanceId: ga.id,
          name: ga.person?.fullName || 'Peserta',
          relationship: ga.familyRelationship || 'Keluarga',
          gender: ga.person?.gender || 'tidak_ditentukan',
          age: ga.age,
          ticketCode: ga.ticketCode,
          ticketNumber: extractTicketCode(ga.ticketCode || ''),
          status: ga.status,
          participantPortalPath: buildParticipantPortalPath(attendance.eventId, ga.ticketCode || ''),
        }));
      }

      const groupUrl = attendance.person?.gender
        ? safeWhatsAppGroupUrl(
            attendance.person.gender === 'akhwat'
              ? event.formConfig?.whatsappGroupAkhwatUrl
              : event.formConfig?.whatsappGroupIkhwanUrl
          )
        : null;

      return successResponse(
        {
          participant: {
            name: attendance.person?.fullName,
            gender: attendance.person?.gender,
            ticketCode: attendance.ticketCode,
            status: attendance.status,
            checkInAt: attendance.checkInAt,
            familyRelationship: attendance.familyRelationship,
            age: attendance.age,
            registrationGroupId: attendance.registrationGroupId,
            groupMembers,
            isSpecialInvite:
              isSpecialInviteRegistration(attendance),
            isStaffRegistration: isStaffRegistration(attendance),
            isStaffFamilyRegistration: isStaffFamilyRegistration(attendance),
          },
          event: {
            id: event.id,
            title: event.title,
            speaker: event.speaker,
            startAt: event.startAt,
            endAt: event.endAt,
            deliveryMode: event.deliveryMode,
            locationName: event.locationName,
            meetingUrl: event.meetingUrl,
            venueRules: event.venueRules || [],
            whatsappGroupInviteUrl: groupUrl,
          },
          participantPortalPath: buildParticipantPortalPath(event.id, attendance.ticketCode || ticketCode),
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 5b. POST /api/public/participant/my-events (Smart Jamaah Hub: Memuat seluruh kajian aktif & riwayat jamaah secara mandiri tanpa password)
  const participantMyEventsSchema = z
    .object({
      phone: z.string().optional().nullable(),
      ticketCode: z.string().optional().nullable(),
    })
    .refine(
      (data) => {
        const hasPhone = Boolean(data.phone && data.phone.trim().length >= 8);
        const hasTicket = Boolean(data.ticketCode && data.ticketCode.trim().length >= 3);
        return hasPhone || hasTicket;
      },
      {
        message: 'Masukkan nomor WhatsApp terdaftar atau kode tiket pendaftaran Anda.',
      }
    );

  router.post(
    '/api/public/participant/my-events',
    validateBody(participantMyEventsSchema, async (ctx, body) => {
      const db = getDb();
      const hasPhone = Boolean(body.phone && body.phone.trim().length >= 8);
      const hasTicket = Boolean(body.ticketCode && body.ticketCode.trim().length >= 3);
      const phoneE164 = hasPhone ? normalizeIndonesianPhone(body.phone!) : '';

      let person: any = null;
      let matchedAttendance: any = null;

      // Skenario 1: Jika ada ticketCode yang diinput
      if (hasTicket) {
        const rawCode = body.ticketCode!.trim().toUpperCase();
        const cleanTicket = extractTicketCode(rawCode);
        const codeCandidates = [rawCode];
        if (cleanTicket && !codeCandidates.includes(cleanTicket)) {
          codeCandidates.push(cleanTicket);
        }
        if (/^\d{4,6}$/.test(rawCode)) {
          codeCandidates.push(`YTS-${rawCode}`, `TIKET-${rawCode}`);
        }

        matchedAttendance = await db.query.eventAttendance.findFirst({
          where: or(
            inArray(eventAttendance.ticketCode, codeCandidates),
            eq(eventAttendance.ticketCode, cleanTicket),
            eq(eventAttendance.ticketCode, rawCode)
          ),
          with: { person: true, event: true },
        });

        if (matchedAttendance?.person) {
          if (hasPhone) {
            // Jika nomor WA juga diinput, verifikasi kesesuaian nomor
            const memberPhone = matchedAttendance.person.phoneE164 || '';
            const isDirectMatch = memberPhone === phoneE164 || memberPhone.startsWith(`${phoneE164}-fam-`);
            let isGroupMatch = false;

            if (!isDirectMatch && matchedAttendance.registrationGroupId) {
              const parentAtt = await db.query.eventAttendance.findFirst({
                where: eq(eventAttendance.registrationGroupId, matchedAttendance.registrationGroupId),
                with: { person: true },
              });
              if (
                parentAtt?.person?.phoneE164 === phoneE164 ||
                Boolean(parentAtt?.person?.phoneE164?.startsWith(`${phoneE164}-fam-`))
              ) {
                isGroupMatch = true;
              }
            }

            if (isDirectMatch || isGroupMatch) {
              person = matchedAttendance.person;
            } else {
              // Jika kombinasi tidak cocok, coba cari person berdasarkan nomor WA
              const personByPhone = await db.query.persons.findFirst({
                where: eq(persons.phoneE164, phoneE164),
              });
              if (personByPhone) {
                person = personByPhone;
              } else {
                return errorResponse(
                  'NOT_FOUND',
                  'Kombinasi nomor WhatsApp dan kode tiket tidak sesuai dengan data pendaftaran.',
                  404,
                  ctx.requestId
                );
              }
            }
          } else {
            // Cukup dengan kode tiket saja: langsung gunakan person dari tiket
            person = matchedAttendance.person;
          }
        } else if (!hasPhone) {
          return errorResponse(
            'NOT_FOUND',
            `Data pendaftaran dengan kode tiket "${rawCode}" tidak ditemukan. Pastikan kode tiket atau nomor tiket sesuai (contoh: YTS-1048 atau 1048).`,
            404,
            ctx.requestId
          );
        }
      }

      // Skenario 2: Jika person belum ditemukan dan ada nomor WhatsApp
      if (!person && hasPhone) {
        person = await db.query.persons.findFirst({
          where: eq(persons.phoneE164, phoneE164),
        });
      }

      if (!person) {
        return errorResponse(
          'NOT_FOUND',
          hasTicket
            ? 'Data pendaftar dengan kode tiket atau nomor WhatsApp tersebut tidak ditemukan.'
            : 'Data pendaftar dengan nomor WhatsApp tersebut tidak ditemukan. Pastikan nomor sesuai saat mendaftar kajian.',
          404,
          ctx.requestId
        );
      }

      // 2. Ambil seluruh data pendaftaran / attendance milik person ini
      const attendances = await db.query.eventAttendance.findMany({
        where: eq(eventAttendance.personId, person.id),
        with: {
          event: true,
        },
        orderBy: [desc(eventAttendance.checkInAt)],
      });

      if (!attendances || attendances.length === 0) {
        return errorResponse(
          'NOT_FOUND',
          'Belum ada tiket atau riwayat pendaftaran kajian yang terhubung dengan nomor WhatsApp ini.',
          404,
          ctx.requestId
        );
      }

      // 3. Kumpulkan seluruh registrationGroupId dari pendaftaran person ini untuk memuat anggota rombongan/keluarga
      const myGroupIds = attendances
        .map((a) => a.registrationGroupId)
        .filter((g): g is string => Boolean(g));

      let allGroupAtts: any[] = [];
      if (myGroupIds.length > 0) {
        allGroupAtts = await db.query.eventAttendance.findMany({
          where: inArray(eventAttendance.registrationGroupId, myGroupIds),
          with: {
            person: true,
          },
          orderBy: [asc(eventAttendance.checkInAt)],
        });
      }

      const upcoming: any[] = [];
      const history: any[] = [];
      const announcements: any[] = [];

      const allAttEventIds = Array.from(
        new Set(attendances.map((a) => a.event?.id).filter((id): id is string => Boolean(id)))
      );
      const myEventsBazaarMap = new Map<string, any>();
      if (allAttEventIds.length > 0) {
        try {
          const bazaars = await db.query.bazaarEvents.findMany({
            where: inArray(bazaarEvents.eventId, allAttEventIds),
            with: {
              applications: {
                columns: { id: true, status: true, isPublished: true },
              },
              booths: {
                columns: { id: true, status: true },
              },
            },
          });
          for (const b of bazaars) {
            const activeApps = (b.applications || []).filter(
              (a: any) => a.status !== 'rejected' && a.status !== 'cancelled'
            );
            myEventsBazaarMap.set(b.eventId, {
              id: b.id,
              isOpen: b.isOpen,
              totalTenantsCount: activeApps.length,
              publishedTenantsCount: activeApps.filter((a: any) => a.isPublished ?? true).length,
              boothsCount: (b.booths || []).length,
            });
          }
        } catch (err) {
          console.warn('[my-events] Bazaar query warning:', err);
        }
      }

      for (const att of attendances) {
        const ev = att.event;
        if (!ev) continue;

        const eventStartDate = new Date(ev.startAt);

        const groupUrl = person.gender
          ? safeWhatsAppGroupUrl(
              person.gender === 'akhwat'
                ? ev.formConfig?.whatsappGroupAkhwatUrl
                : ev.formConfig?.whatsappGroupIkhwanUrl
            )
          : null;

        const groupMembers = att.registrationGroupId
          ? allGroupAtts
              .filter((ga) => ga.registrationGroupId === att.registrationGroupId)
              .map((ga) => ({
                attendanceId: ga.id,
                name: ga.person?.fullName || 'Peserta',
                relationship: ga.familyRelationship || 'Keluarga',
                gender: ga.person?.gender || 'tidak_ditentukan',
                age: ga.age,
                ticketCode: ga.ticketCode,
                ticketNumber: extractTicketCode(ga.ticketCode || ''),
                status: ga.status,
                isSelf: ga.id === att.id,
                participantPortalPath: buildParticipantPortalPath(ev.id, ga.ticketCode || ''),
              }))
          : [];

        const bInfo = myEventsBazaarMap.get(ev.id) || null;

        const ticketItem = {
          attendanceId: att.id,
          ticketCode: att.ticketCode,
          ticketNumber: extractTicketCode(att.ticketCode || ''),
          status: att.status,
          checkInAt: att.checkInAt,
          familyRelationship: att.familyRelationship,
          age: att.age,
          registrationGroupId: att.registrationGroupId,
          groupMembers,
          paymentStatus: att.paymentStatus,
          paymentProofUrl: att.paymentProofUrl,
          paymentAmountRupiah: att.paymentAmountRupiah,
          vehicleType: att.vehicleType,
          isSpecialInvite:
            isSpecialInviteRegistration(att),
          isStaffRegistration: isStaffRegistration(att),
          isStaffFamilyRegistration: isStaffFamilyRegistration(att),
          participantPortalPath: buildParticipantPortalPath(ev.id, att.ticketCode || ''),
          event: {
            id: ev.id,
            title: ev.title,
            speaker: ev.speaker,
            category: ev.category,
            startAt: ev.startAt,
            endAt: ev.endAt,
            deliveryMode: ev.deliveryMode,
            locationName: ev.locationName || 'Masjid Tarbiyah Sunnah',
            locationAddress: ev.locationAddress,
            googleMapsUrl: ev.googleMapsUrl,
            locationDirections: ev.locationDirections,
            meetingUrl: ev.meetingUrl,
            venueRules: ev.venueRules || [],
            customVenueRules: ev.customVenueRules,
            whatsappGroupInviteUrl: groupUrl,
            isPaid: ev.isPaid,
            priceRupiah: ev.priceRupiah,
            bankName: ev.bankName,
            bankAccountNumber: ev.bankAccountNumber,
            bankAccountName: ev.bankAccountName,
            paymentInstructions: ev.paymentInstructions,
            hasBazaar: Boolean(bInfo),
            bazaarId: bInfo?.id || null,
            bazaarInfo: bInfo,
          },
        };

        // Kumpulkan pengumuman / materi dari event
        if (ev.formConfig?.announcements && Array.isArray(ev.formConfig.announcements)) {
          for (const ann of ev.formConfig.announcements) {
            announcements.push({
              ...ann,
              eventId: ev.id,
              eventTitle: ev.title,
            });
          }
        }

        if (ev.customVenueRules) {
          announcements.push({
            id: `notice-rules-${ev.id}`,
            eventId: ev.id,
            eventTitle: ev.title,
            title: `Ketentuan Majelis: ${ev.title}`,
            content: ev.customVenueRules,
            createdAt: ev.createdAt,
            isUrgent: false,
          });
        }

        // Tentukan apakah masuk ke 'upcoming' atau 'history':
        // Jika event belum lewat (startAt >= kemarin) atau status pendaftaran masih aktif
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
        if (eventStartDate >= yesterday || ev.status === 'scheduled' || ev.status === 'ongoing') {
          upcoming.push(ticketItem);
        } else {
          history.push({
            ...ticketItem,
            certificateAvailable: att.status === 'attended',
          });
        }
      }

      // Urutkan upcoming: jika dicari menggunakan kode tiket, prioritaskan tiket tersebut di paling atas
      if (matchedAttendance) {
        upcoming.sort((a, b) => {
          if (a.attendanceId === matchedAttendance.id) return -1;
          if (b.attendanceId === matchedAttendance.id) return 1;
          return new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime();
        });
        history.sort((a, b) => {
          if (a.attendanceId === matchedAttendance.id) return -1;
          if (b.attendanceId === matchedAttendance.id) return 1;
          return new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime();
        });
      } else {
        upcoming.sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime());
      }

      // Masked phone: e.g. "0812 •••• 7890"
      const rawPhone = (hasPhone && body.phone ? body.phone.trim() : '') || person.phoneE164 || '';
      const maskedPhone =
        rawPhone.length > 7
          ? `${rawPhone.slice(0, 4)} •••• ${rawPhone.slice(-4)}`
          : rawPhone ? '••••••••' : '-';

      // Mask email jika pencarian hanya dengan kode tiket demi privasi
      const maskedEmail = person.email
        ? !hasPhone
          ? person.email.replace(/^(..)(.*)(@.*)$/, (_: string, a: string, _b: string, c: string) => `${a}••••${c}`)
          : person.email
        : null;

      // Calculate attendance history & loyalty metrics
      const attendedCount = attendances.filter((a) => a.status === 'attended').length;
      const loyaltyTierInfo = getLoyaltyTierInfo(attendedCount > 0 ? attendedCount : 1);

      return successResponse(
        {
          person: {
            id: person.id,
            fullName: person.fullName,
            gender: person.gender,
            phoneMasked: maskedPhone,
            email: maskedEmail,
            cityRegency: person.cityRegency,
          },
          upcomingCount: upcoming.length,
          historyCount: history.length,
          attendedCount,
          loyaltyTier: loyaltyTierInfo.tier,
          loyaltyLabel: loyaltyTierInfo.badge,
          loyaltyDescription: loyaltyTierInfo.description,
          upcoming,
          history,
          announcements,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 6. POST /api/public/lookup-participant (Auto-fill biodata for returning jamaah)
  const participantLookupSchema = z.object({
    identifier: z.string().min(3, 'Nomor WhatsApp atau Email minimal 3 karakter'),
  });

  router.post(
    '/api/public/lookup-participant',
    validateBody(participantLookupSchema, async (ctx, body) => {
      const db = getDb();
      const raw = body.identifier.trim();
      const isEmail = raw.includes('@');

      let person = null;
      if (isEmail) {
        person = await db.query.persons.findFirst({
          where: sql`lower(${persons.email}) = ${raw.toLowerCase()}`,
        });
      } else {
        const phoneNorm = normalizeIndonesianPhone(raw);
        person = await db.query.persons.findFirst({
          where: sql`${persons.phoneE164} = ${phoneNorm} OR ${persons.phoneE164} = ${raw}`,
        });
      }

      if (!person) {
        return successResponse({ found: false }, { requestId: ctx.requestId });
      }

      // Check if this person has past family members registered in their groups
      let attendanceRecords: any[] = [];
      try {
        if (db?.query?.eventAttendance?.findMany) {
          attendanceRecords = await db.query.eventAttendance.findMany({
            where: eq(eventAttendance.personId, person.id),
            orderBy: [sql`${eventAttendance.checkInAt} DESC`],
            limit: 10,
          });
        }
      } catch {
        attendanceRecords = [];
      }
      if (!Array.isArray(attendanceRecords)) attendanceRecords = [];

      // Count past kajian attendance with attended status
      let totalKajianAttended = 0;
      try {
        if (typeof db?.select === 'function') {
          const selectRes = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(eventAttendance)
            .where(and(eq(eventAttendance.personId, person.id), eq(eventAttendance.status, 'attended')));
          if (Array.isArray(selectRes) && selectRes[0]?.count != null) {
            totalKajianAttended = Number(selectRes[0].count) || 0;
          }
        }
      } catch {
        totalKajianAttended = 0;
      }

      // Fallback from attendanceRecords if select query didn't yield
      if (totalKajianAttended === 0 && attendanceRecords.length > 0) {
        const attendedOnly = attendanceRecords.filter((a) => a.status === 'attended');
        totalKajianAttended = attendedOnly.length > 0 ? attendedOnly.length : attendanceRecords.length;
      }

      const nextKajianNumber = totalKajianAttended + 1;
      const loyaltyInfo = getLoyaltyTierInfo(nextKajianNumber);

      const groupIds = attendanceRecords
        .map((a) => a.registrationGroupId)
        .filter((gid): gid is string => Boolean(gid));

      let pastFamilyMembers: Array<{
        fullName: string;
        gender: 'ikhwan' | 'akhwat';
        relationship: string;
        age?: number | null;
      }> = [];

      if (groupIds.length > 0) {
        const relatedAttendances = await db.query.eventAttendance.findMany({
          where: sql`${eventAttendance.registrationGroupId} IN ${groupIds} AND ${eventAttendance.personId} != ${person.id}`,
          with: {
            person: true,
          },
        });

        const seenNames = new Set<string>();
        for (const rel of relatedAttendances) {
          const name = rel.person?.fullName;
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            pastFamilyMembers.push({
              fullName: name,
              gender: (rel.person?.gender as 'ikhwan' | 'akhwat') || 'ikhwan',
              relationship: rel.familyRelationship || 'Keluarga',
              age: rel.age || null,
            });
          }
        }
      }

      return successResponse(
        {
          found: true,
          person: {
            id: person.id,
            fullName: person.fullName,
            phone: person.phoneE164 || '',
            email: person.email || '',
            gender: person.gender || 'ikhwan',
            cityRegency: person.cityRegency || '',
          },
          totalKajianAttended,
          nextKajianNumber,
          loyaltyTier: loyaltyInfo.tier,
          loyaltyLabel: loyaltyInfo.badge,
          pastFamilyMembers,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // =========================================================================
  // 7. PUBLIC GATE SCANNER ENDPOINTS (NO LOGIN REQUIRED FOR FIELD VOLUNTEERS)
  // =========================================================================

  // 7a. GET /api/public/gate/events (List Active & Upcoming Events for Gate Selector)
  router.get('/api/public/gate/events', async (ctx) => {
    const db = getDb();
    const scheduledEvents = await db.query.events.findMany({
      orderBy: [desc(events.startAt)],
      limit: 25,
      with: {
        attendances: {
          with: {
            person: {
              columns: { id: true, gender: true },
            },
          },
        },
      },
    });

    const formatted = scheduledEvents.map((ev) => {
      const atts = ev.attendances || [];
      const checkedInCount = atts.filter((a) => a.status === 'attended').length;
      const ikhwanCount = atts.filter((a) => a.person?.gender === 'ikhwan').length;
      const akhwatCount = atts.filter((a) => a.person?.gender === 'akhwat').length;

      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        speaker: ev.speaker,
        startAt: ev.startAt.toISOString(),
        endAt: ev.endAt ? ev.endAt.toISOString() : null,
        locationName: ev.locationName || 'Masjid Tarbiyah Sunnah',
        targetAudience: ev.targetAudience || 'umum',
        minAge: ev.minAge || null,
        quota: ev.quota,
        status: ev.status,
        attendanceCount: atts.length,
        totalRegistered: atts.length,
        checkedInCount,
        totalCheckedIn: checkedInCount,
        ikhwanCount,
        akhwatCount,
      };
    });

    return successResponse({ events: formatted }, { requestId: ctx.requestId });
  });

  // 7b. GET /api/public/gate/events/:id (Event Details, Realtime KPI, and Participant Cache)
  router.get('/api/public/gate/events/:id', async (ctx) => {
    const db = getDb();
    const eventId = ctx.params.id;

    if (!eventId) {
      return errorResponse('VALIDATION_ERROR', 'ID kajian diperlukan', 400, ctx.requestId);
    }

    const targetEvent = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        attendances: {
          with: {
            person: true,
          },
        },
      },
    });

    if (!targetEvent) {
      return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
    }

    const atts = targetEvent.attendances || [];
    const checkedInAtts = atts.filter((a) => a.status === 'attended');
    const ikhwanAtts = atts.filter((a) => a.person?.gender === 'ikhwan');
    const akhwatAtts = atts.filter((a) => a.person?.gender === 'akhwat');

    const ikhwanCheckedIn = ikhwanAtts.filter((a) => a.status === 'attended').length;
    const akhwatCheckedIn = akhwatAtts.filter((a) => a.status === 'attended').length;
    const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
    const motorcyclesCount = atts.filter((a) => a.vehicleType === 'motorcycle').length;

    // Batch calculate past attendance history and loyalty tier for all participants
    const personIds = atts.map((a) => a.personId).filter(Boolean) as string[];
    const attendanceStatsMap = await getPersonsAttendanceStats(db, personIds, eventId);

    const participants = atts.map((a) => {
      const pStats = attendanceStatsMap.get(a.personId);
      return {
        id: a.id,
        ticketCode: a.ticketCode,
        personId: a.personId,
        personName: a.person?.fullName || 'Anonim',
        fullName: a.person?.fullName || 'Anonim',
        personGender: a.person?.gender || 'ikhwan',
        gender: a.person?.gender || 'ikhwan',
        personPhone: a.person?.phoneE164 || '-',
        phoneE164: a.person?.phoneE164 || '-',
        personCity: a.person?.cityRegency || null,
        cityRegency: a.person?.cityRegency || null,
        personEmail: a.person?.email || null,
        status: a.status,
        checkInAt: a.checkInAt ? a.checkInAt.toISOString() : null,
        vehicleType: a.vehicleType,
        vehiclePlateNumber: a.vehiclePlateNumber,
        registrationGroupId: a.registrationGroupId,
        familyRelationship: a.familyRelationship,
        age: a.age,
        gateName: (a.registrationData as any)?.gateName || null,
        registrationData: a.registrationData,
        pastAttendedCount: pStats?.pastAttendedCount ?? 0,
        totalAttendedCount: pStats?.totalAttendedCount ?? (a.status === 'attended' ? 1 : 0),
        pastRegisteredCount: pStats?.pastRegisteredCount ?? 0,
        currentKajianNumber: pStats?.currentKajianNumber ?? 1,
        loyaltyTier: pStats?.loyaltyTier ?? 'perdana',
        loyaltyLabel: pStats?.loyaltyLabel ?? '🌱 Jamaah Baru',
        lastAttendedTitle: pStats?.lastAttendedTitle ?? null,
        lastAttendedDate: pStats?.lastAttendedDate ?? null,
      };
    });

    const recentCheckIns = checkedInAtts
      .filter((a) => a.checkInAt)
      .sort((a, b) => new Date(b.checkInAt!).getTime() - new Date(a.checkInAt!).getTime())
      .slice(0, 30)
      .map((a) => {
        const pStats = attendanceStatsMap.get(a.personId);
        return {
          id: a.id,
          personId: a.personId,
          ticketCode: a.ticketCode,
          personName: a.person?.fullName || 'Anonim',
          fullName: a.person?.fullName || 'Anonim',
          personGender: a.person?.gender || 'ikhwan',
          gender: a.person?.gender || 'ikhwan',
          personPhone: a.person?.phoneE164 || '-',
          phoneE164: a.person?.phoneE164 || '-',
          personCity: a.person?.cityRegency || null,
          cityRegency: a.person?.cityRegency || null,
          checkInAt: a.checkInAt ? a.checkInAt.toISOString() : null,
          vehicleType: a.vehicleType,
          vehiclePlateNumber: a.vehiclePlateNumber,
          gateName: (a.registrationData as any)?.gateName || null,
          pastAttendedCount: pStats?.pastAttendedCount ?? 0,
          currentKajianNumber: pStats?.currentKajianNumber ?? 1,
          loyaltyTier: pStats?.loyaltyTier ?? 'perdana',
          loyaltyLabel: pStats?.loyaltyLabel ?? '🌱 Jamaah Baru',
          lastAttendedTitle: pStats?.lastAttendedTitle ?? null,
        };
      });

    const firstTimerCount = participants.filter((p) => p.currentKajianNumber <= 1).length;
    const returningCount = participants.filter((p) => p.currentKajianNumber > 1).length;
    const checkedInFirstTimerCount = participants.filter((p) => p.status === 'attended' && p.currentKajianNumber <= 1).length;
    const checkedInReturningCount = participants.filter((p) => p.status === 'attended' && p.currentKajianNumber > 1).length;

    return successResponse(
      {
        event: {
          id: targetEvent.id,
          title: targetEvent.title,
          category: targetEvent.category,
          speaker: targetEvent.speaker,
          startAt: targetEvent.startAt.toISOString(),
          endAt: targetEvent.endAt ? targetEvent.endAt.toISOString() : null,
          locationName: targetEvent.locationName || 'Masjid Tarbiyah Sunnah',
          targetAudience: targetEvent.targetAudience || 'umum',
          minAge: targetEvent.minAge || null,
          quota: targetEvent.quota,
          quotaIkhwan: targetEvent.quotaIkhwan,
          quotaAkhwat: targetEvent.quotaAkhwat,
          venueRules: targetEvent.venueRules || [],
          customVenueRules: targetEvent.customVenueRules,
          status: targetEvent.status,
        },
        stats: {
          totalRegistered: atts.length,
          totalCheckedIn: checkedInAtts.length,
          totalRemaining: Math.max(0, atts.length - checkedInAtts.length),
          percentage: atts.length > 0 ? Math.round((checkedInAtts.length / atts.length) * 100) : 0,
          ikhwanRegistered: ikhwanAtts.length,
          ikhwanCheckedIn,
          akhwatRegistered: akhwatAtts.length,
          akhwatCheckedIn,
          carsCount,
          motorcyclesCount,
          firstTimerCount,
          returningCount,
          checkedInFirstTimerCount,
          checkedInReturningCount,
        },
        participants,
        recentCheckIns,
      },
      { requestId: ctx.requestId }
    );
  });

  // 7c. POST /api/public/gate/events/:id/scan (Fast Gate Scanner Check-In - No Login Required)
  const publicGateScanSchema = z.object({
    ticketCode: z.string().optional().nullable(),
    attendanceId: z.string().optional().nullable(),
    query: z.string().optional().nullable(),
    gateName: z.string().optional().nullable(),
    officerName: z.string().optional().nullable(),
  });

  router.post(
    '/api/public/gate/events/:id/scan',
    validateBody(publicGateScanSchema, async (ctx, body) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { ticketCode, attendanceId, query, gateName, officerName } = body;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      }

      let targetAttendance: any = null;

      // 1. Match by attendance ID (from direct click)
      if (attendanceId) {
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
          with: { person: true },
        });
      }

      // 2. Match by ticket code
      if (!targetAttendance && ticketCode) {
        const rawCode = String(ticketCode).trim();
        const cleanCode = extractTicketCode(rawCode);
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, eventId),
            or(
              eq(eventAttendance.ticketCode, cleanCode),
              eq(eventAttendance.ticketCode, rawCode.toUpperCase()),
              ilike(eventAttendance.ticketCode, `%${rawCode}%`)
            )
          ),
          with: { person: true },
        });
      }

      // 3. Match by query (phone, name, or ticket code suffix)
      if (!targetAttendance && query) {
        const rawQuery = String(query).trim();
        const cleanTicket = extractTicketCode(rawQuery);
        const phoneNorm = normalizeIndonesianPhone(rawQuery);

        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, eventId),
            or(
              eq(eventAttendance.ticketCode, cleanTicket),
              eq(eventAttendance.ticketCode, rawQuery.toUpperCase()),
              ilike(eventAttendance.ticketCode, `%${rawQuery}%`)
            )
          ),
          with: { person: true },
        });

        if (!targetAttendance) {
          const candidatePersons = await db.query.persons.findMany({
            where: or(
              inArray(persons.phoneE164, [phoneNorm, `+${rawQuery}`, rawQuery]),
              ilike(persons.fullName, `%${rawQuery}%`),
              ilike(persons.phoneE164, `%${rawQuery}%`)
            ),
            columns: { id: true },
            limit: 15,
          });

          const personIds = candidatePersons.map((p) => p.id);
          if (personIds.length > 0) {
            targetAttendance = await db.query.eventAttendance.findFirst({
              where: and(
                eq(eventAttendance.eventId, eventId),
                inArray(eventAttendance.personId, personIds)
              ),
              with: { person: true },
            });
          }
        }
      }

      if (!targetAttendance) {
        return errorResponse(
          'NOT_FOUND',
          'Tiket atau data jamaah tidak ditemukan untuk kajian ini.',
          404,
          ctx.requestId
        );
      }

      const alreadyCheckedIn = targetAttendance.status === 'attended';
      const previousCheckInAt = targetAttendance.checkInAt ? new Date(targetAttendance.checkInAt).toISOString() : null;

      let updatedAttendance = targetAttendance;
      if (!alreadyCheckedIn) {
        const existingRegData = (targetAttendance.registrationData as any) || {};
        const newRegData = {
          ...existingRegData,
          gateName: gateName || existingRegData.gateName || 'Pintu Utama',
          officerName: officerName || existingRegData.officerName || 'Panitia Gerbang',
          scannedAt: new Date().toISOString(),
        };

        const [updated] = await db
          .update(eventAttendance)
          .set({
            status: 'attended',
            checkInAt: new Date(),
            registrationData: newRegData,
          })
          .where(eq(eventAttendance.id, targetAttendance.id))
          .returning();
        updatedAttendance = { ...targetAttendance, ...updated, registrationData: newRegData };
      }

      // Re-calculate quick event stats
      const allAtts = await db.query.eventAttendance.findMany({
        where: eq(eventAttendance.eventId, eventId),
        with: { person: { columns: { gender: true } } },
      });
      const checkedInCount = allAtts.filter((a) => a.status === 'attended').length;
      const ikhwanCheckedIn = allAtts.filter((a) => a.status === 'attended' && a.person?.gender === 'ikhwan').length;
      const akhwatCheckedIn = allAtts.filter((a) => a.status === 'attended' && a.person?.gender === 'akhwat').length;

      // Calculate attendance history & loyalty metrics for this person
      const pStats = await getSinglePersonAttendanceStats(db, updatedAttendance.personId, eventId);
      const greetingInfo = buildPersonalizedGreeting(
        updatedAttendance.person?.fullName || 'Jamaah',
        updatedAttendance.person?.gender || 'ikhwan',
        pStats.currentKajianNumber
      );

      return successResponse(
        {
          success: true,
          alreadyCheckedIn,
          checkedInNow: !alreadyCheckedIn,
          previousCheckInAt,
          attendance: {
            id: updatedAttendance.id,
            personId: updatedAttendance.personId,
            personName: updatedAttendance.person?.fullName || 'Anonim',
            fullName: updatedAttendance.person?.fullName || 'Anonim',
            personPhone: updatedAttendance.person?.phoneE164 || '-',
            phoneE164: updatedAttendance.person?.phoneE164 || '-',
            personGender: updatedAttendance.person?.gender || 'ikhwan',
            gender: updatedAttendance.person?.gender || 'ikhwan',
            personCity: updatedAttendance.person?.cityRegency || null,
            cityRegency: updatedAttendance.person?.cityRegency || null,
            ticketCode: updatedAttendance.ticketCode,
            status: 'attended',
            checkInAt: updatedAttendance.checkInAt ? new Date(updatedAttendance.checkInAt).toISOString() : new Date().toISOString(),
            vehicleType: updatedAttendance.vehicleType,
            vehiclePlateNumber: updatedAttendance.vehiclePlateNumber,
            registrationData: updatedAttendance.registrationData,
            familyRelationship: updatedAttendance.familyRelationship,
            gateName: (updatedAttendance.registrationData as any)?.gateName || gateName || 'Pintu Utama',
            pastAttendedCount: pStats.pastAttendedCount,
            totalAttendedCount: pStats.pastAttendedCount + 1,
            currentKajianNumber: pStats.currentKajianNumber,
            loyaltyTier: pStats.loyaltyTier,
            loyaltyLabel: pStats.loyaltyLabel,
            lastAttendedTitle: pStats.lastAttendedTitle,
            greetingMessage: greetingInfo.fullGreeting,
            shortGreeting: greetingInfo.shortGreeting,
          },
          stats: {
            totalRegistered: allAtts.length,
            totalCheckedIn: checkedInCount,
            totalRemaining: Math.max(0, allAtts.length - checkedInCount),
            percentage: allAtts.length > 0 ? Math.round((checkedInCount / allAtts.length) * 100) : 0,
            ikhwanCheckedIn,
            akhwatCheckedIn,
          },
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7d. POST /api/public/gate/events/:id/toggle-checkin (1-Click Manual Check-In / Undo)
  const publicGateToggleSchema = z.object({
    attendanceId: z.string().min(1, 'Attendance ID wajib diisi'),
    targetStatus: z.enum(['registered', 'attended']).optional(),
    gateName: z.string().optional().nullable(),
  });

  router.post(
    '/api/public/gate/events/:id/toggle-checkin',
    validateBody(publicGateToggleSchema, async (ctx, body) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      }
      const { attendanceId, targetStatus, gateName } = body;

      const target = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
        with: { person: true },
      });

      if (!target) {
        return errorResponse('NOT_FOUND', 'Data kehadiran tidak ditemukan', 404, ctx.requestId);
      }

      const nextStatus = targetStatus || (target.status === 'attended' ? 'registered' : 'attended');
      const nextCheckInAt = nextStatus === 'attended' ? new Date() : sql`NULL`;

      const existingRegData = (target.registrationData as any) || {};
      const newRegData = {
        ...existingRegData,
        gateName: gateName || existingRegData.gateName || 'Pintu Utama',
        lastToggledAt: new Date().toISOString(),
      };

      const [updated] = await db
        .update(eventAttendance)
        .set({
          status: nextStatus,
          checkInAt: nextCheckInAt,
          registrationData: newRegData,
        })
        .where(eq(eventAttendance.id, target.id))
        .returning();

      if (!updated) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui status kehadiran', 500, ctx.requestId);
      }

      // Calculate attendance history & loyalty metrics for this person
      const pStats = await getSinglePersonAttendanceStats(db, target.personId, eventId);
      const greetingInfo = buildPersonalizedGreeting(
        target.person?.fullName || 'Jamaah',
        target.person?.gender || 'ikhwan',
        pStats.currentKajianNumber
      );

      return successResponse(
        {
          success: true,
          attendance: {
            id: updated.id,
            personId: target.personId,
            ticketCode: updated.ticketCode,
            status: updated.status,
            checkInAt: updated.checkInAt ? new Date(updated.checkInAt).toISOString() : null,
            personName: target.person?.fullName || 'Anonim',
            fullName: target.person?.fullName || 'Anonim',
            personGender: target.person?.gender || 'ikhwan',
            gender: target.person?.gender || 'ikhwan',
            personPhone: target.person?.phoneE164 || '-',
            phoneE164: target.person?.phoneE164 || '-',
            personCity: target.person?.cityRegency || null,
            cityRegency: target.person?.cityRegency || null,
            vehicleType: updated.vehicleType,
            vehiclePlateNumber: updated.vehiclePlateNumber,
            gateName: newRegData.gateName,
            registrationData: newRegData,
            familyRelationship: target.familyRelationship,
            pastAttendedCount: pStats.pastAttendedCount,
            totalAttendedCount: nextStatus === 'attended' ? pStats.pastAttendedCount + 1 : pStats.pastAttendedCount,
            currentKajianNumber: pStats.currentKajianNumber,
            loyaltyTier: pStats.loyaltyTier,
            loyaltyLabel: pStats.loyaltyLabel,
            lastAttendedTitle: pStats.lastAttendedTitle,
            greetingMessage: greetingInfo.fullGreeting,
            shortGreeting: greetingInfo.shortGreeting,
          },
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
