import { z } from 'zod';
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
} from '../../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';
import { buildParticipantPortalPath, extractTicketCode } from '../../../src/lib/participantTicket';
import { createMemorableTicketCode, createReferralCode } from '../events/participantCodes';
import {
  sendEventRegistrationTicketEmail,
  sendDonationReceivedEmail,
  sendWaqfInquiryConfirmationEmail,
} from '../../email/service';
import { ensureS3StorageUrl, uploadPublicProofFile } from '../../storage/providers/s3';

const publicDonationSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  email: z.string().email('Format email tidak valid').optional().nullable(),
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
  email: z.string().email('Format email tidak valid').optional().nullable(),
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
  email: z.string().email('Format email tidak valid').optional().nullable(),
  cityRegency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customResponses: z.record(z.any()).optional().nullable(),
  vehicleType: z.enum(['none', 'motorcycle', 'car']).default('none'),
  vehiclePlateNumber: z.string().optional().nullable(),
  agreedToRules: z.boolean().default(true),
  paymentProofUrl: z.string().optional().nullable(),
  paymentAmountRupiah: z.number().optional().nullable(),
  referralCode: z.string().trim().min(4).max(80).optional().nullable(),
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
        where: eq(events.status, 'scheduled'),
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
        events: upcomingEvents.map((ev) => {
          const atts = ev.attendances || [];
          // URL grup tidak boleh muncul pada katalog publik; hanya endpoint tiket terverifikasi yang mengirimkannya.
          const { whatsappGroupIkhwanUrl, whatsappGroupAkhwatUrl, ...publicFormConfig } = ev.formConfig || {};
          const ikhwanCount = atts.filter((a) => a.person?.gender === 'ikhwan').length;
          const akhwatCount = atts.filter((a) => a.person?.gender === 'akhwat').length;
          const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
          const motorcyclesCount = atts.filter((a) => a.vehicleType === 'motorcycle').length;

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
            quota: ev.quota,
            quotaIkhwan: ev.quotaIkhwan,
            quotaAkhwat: ev.quotaAkhwat,
            carParkingQuota: ev.carParkingQuota,
            motorcycleParkingQuota: ev.motorcycleParkingQuota,
            venueRules: ev.venueRules || [],
            customVenueRules: ev.customVenueRules,
            isRegistrationOpen: ev.isRegistrationOpen,
            formConfig: publicFormConfig,
            attendanceCount: atts.length,
            ikhwanCount,
            akhwatCount,
            carsCount,
            motorcyclesCount,
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
                bucket: process.env.S3_BUCKET || 'crmyts',
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

  // 4. POST /api/public/register-event (Online Registration for Kajian Rutin & Daurah Khusus)
  router.post(
    '/api/public/register-event',
    validateBody(publicEventRegistrationSchema, async (ctx, body) => {
      const db = getDb();
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

      if (targetEvent.isRegistrationOpen === false) {
        return errorResponse('VALIDATION_ERROR', 'Pendaftaran untuk kajian ini telah ditutup oleh pengurus', 400, ctx.requestId);
      }

      const fixedGender =
        targetEvent.targetAudience === 'akhwat_only'
          ? 'akhwat'
          : targetEvent.targetAudience === 'ikhwan_only'
            ? 'ikhwan'
            : null;
      // Untuk kajian umum, gender hanya dikumpulkan bila Form Builder mengaktifkannya.
      const gender = fixedGender || (targetEvent.formConfig?.requireGender === false ? null : body.gender || null);
      const email = targetEvent.formConfig?.collectEmail === true ? body.email || null : null;
      const cityRegency = targetEvent.formConfig?.collectCity !== false ? body.cityRegency || null : null;

      // 1. Audience Target Validation
      if (targetEvent.targetAudience === 'akhwat_only' && body.gender && body.gender !== 'akhwat') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Akhwat (Wanita)', 400, ctx.requestId);
      }
      if (targetEvent.targetAudience === 'ikhwan_only' && body.gender && body.gender !== 'ikhwan') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Ikhwan (Laki-laki)', 400, ctx.requestId);
      }

      // 2. Segmented Quota Validations
      const atts = targetEvent.attendances || [];
      const currentIkhwan = atts.filter((a) => a.person?.gender === 'ikhwan').length;
      const currentAkhwat = atts.filter((a) => a.person?.gender === 'akhwat').length;
      const currentCars = atts.filter((a) => a.vehicleType === 'car').length;
      const currentMotorcycles = atts.filter((a) => a.vehicleType === 'motorcycle').length;
      // Jika panitia menyembunyikan fasilitas parkir, jangan simpan atau hitung input kendaraan yang dikirim klien.
      const vehicleType = targetEvent.formConfig?.collectVehicle === false ? 'none' : body.vehicleType;
      const vehiclePlateNumber = vehicleType === 'none' ? null : body.vehiclePlateNumber || null;

      if (gender === 'ikhwan' && targetEvent.quotaIkhwan && currentIkhwan >= targetEvent.quotaIkhwan) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota pendaftaran khusus Jamaah Ikhwan telah penuh.', 400, ctx.requestId);
      }
      if (gender === 'akhwat' && targetEvent.quotaAkhwat && currentAkhwat >= targetEvent.quotaAkhwat) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota pendaftaran khusus Jamaah Akhwat telah penuh.', 400, ctx.requestId);
      }
      if (targetEvent.quota && atts.length >= targetEvent.quota) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota keseluruhan untuk kajian ini telah penuh.', 400, ctx.requestId);
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
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data jamaah', 500, ctx.requestId);
      }

      // Check if already registered for this event
      const existingAttendance = await db.query.eventAttendance.findFirst({
        where: sql`${eventAttendance.eventId} = ${body.eventId} AND ${eventAttendance.personId} = ${person.id}`,
      });

      const normalizedReferralCode = body.referralCode?.trim().toUpperCase() || null;
      let referrerAttendance: { id: string; personId: string } | null = null;
      if (normalizedReferralCode) {
        referrerAttendance = (await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, targetEvent.id),
            eq(eventAttendance.referralCode, normalizedReferralCode)
          ),
          columns: { id: true, personId: true },
        })) || null;

        if (!referrerAttendance) {
          return errorResponse('VALIDATION_ERROR', 'Kode undangan tidak ditemukan untuk kajian ini.', 400, ctx.requestId);
        }
        if (referrerAttendance.personId === person.id) {
          return errorResponse('VALIDATION_ERROR', 'Kode undangan sendiri tidak dapat digunakan.', 400, ctx.requestId);
        }
      }

      // Rombongan hanya diproses jika diaktifkan panitia; batas berlaku pula untuk payload yang dimanipulasi.
      const maxMultiParticipants = Math.min(20, Math.max(1, targetEvent.formConfig?.maxMultiParticipants ?? 10));
      // Event yang dibuat sebelum Form Builder memiliki formConfig kosong. Pertahankan
      // kemampuan rombongan untuk event lama, sementara nilai false tetap memblokir payload.
      const additionalList = targetEvent.formConfig?.allowMultiParticipant !== false
        ? (body.additionalParticipants || []).slice(0, maxMultiParticipants)
        : [];
      const isGroup = additionalList.length > 0;
      const totalParticipantsCount = 1 + additionalList.length;

      // Kode dibaca cepat oleh petugas (contoh: YTS-ILMU-NUR-482), tetapi tetap acak.
      const datePart = new Date(targetEvent.startAt).toISOString().slice(2, 10).replace(/-/g, '');
      const groupPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const registrationGroupId = isGroup ? `GRP-${datePart}-${groupPart}` : null;
      const ticketCode = existingAttendance?.ticketCode || createMemorableTicketCode();
      const referralCode = existingAttendance?.referralCode || createReferralCode();

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
          source: 'form_registration',
          status: 'registered',
          ticketCode,
          referralCode,
          referredByAttendanceId: referrerAttendance?.id || null,
          
          registrationGroupId,
          familyRelationship: isGroup ? 'Kepala Keluarga / Pendaftar Utama' : null,
          age: null,

          paymentStatus: initialPaymentStatus,
          paymentProofUrl: storedProofUrl || null,
          paymentAmountRupiah: isPaidEvent ? (body.paymentAmountRupiah || totalGroupPrice) : 0,

          vehicleType,
          vehiclePlateNumber,
          agreedToRules: body.agreedToRules !== false,
          registrationData:
            body.customResponses || body.notes
              ? {
                  ...(body.customResponses || {}),
                  ...(body.notes ? { _generalNotes: body.notes } : {}),
                }
              : null,
        });
      } else {
        // Data lama tetap memperoleh kode undangan yang tersimpan, bukan tautan sementara.
        if (!existingAttendance.referralCode) {
          await db
            .update(eventAttendance)
            .set({ referralCode })
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
          age: null,
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
              referralCode: createReferralCode(),
              referredByAttendanceId: referrerAttendance?.id || null,
              registrationGroupId,
              familyRelationship: member.relationship || 'Keluarga',
              age: member.age || null,
              paymentStatus: initialPaymentStatus,
              paymentProofUrl: body.paymentProofUrl || null,
              paymentAmountRupiah: targetEvent.priceRupiah || 0,
              vehicleType: 'none',
              agreedToRules: true,
              registrationData: member.notes ? { notes: member.notes } : null,
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
          referralCode,
          referralLink: `/kajian/${targetEvent.id}?ref=${encodeURIComponent(referralCode)}`,
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
          isPaid: isPaidEvent,
          priceRupiah: totalGroupPrice,
          eventUrl: `https://yts.web.id/kajian/${targetEvent.id}`,
        }).catch((err) => console.warn('[Email Event Ticket Error]:', err));
      }

      return res;
    })
  );

  // 5. POST /api/public/participant-ticket (Portal peserta; nomor WA menjadi verifikasi kepemilikan tiket)
  const participantTicketSchema = z.object({
    eventId: z.string().uuid('Event tidak valid'),
    ticketCode: z.string().min(4, 'Kode peserta wajib diisi'),
    phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  });

  router.post(
    '/api/public/participant-ticket',
    validateBody(participantTicketSchema, async (ctx, body) => {
      const db = getDb();
      const ticketCode = extractTicketCode(body.ticketCode);
      const phoneE164 = normalizeIndonesianPhone(body.phone);

      const attendance = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.eventId, body.eventId), eq(eventAttendance.ticketCode, ticketCode)),
        with: { person: true },
      });

      // Pesan dibuat generik supaya kode tiket tidak dapat dipakai untuk menebak data jamaah.
      if (!attendance || attendance.person?.phoneE164 !== phoneE164) {
        return errorResponse('NOT_FOUND', 'Tiket atau nomor WhatsApp tidak sesuai.', 404, ctx.requestId);
      }

      const event = await db.query.events.findFirst({ where: eq(events.id, body.eventId) });
      if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

      const groupUrl = attendance.person.gender
        ? safeWhatsAppGroupUrl(
            attendance.person.gender === 'akhwat'
              ? event.formConfig?.whatsappGroupAkhwatUrl
              : event.formConfig?.whatsappGroupIkhwanUrl
          )
        : null;

      return successResponse(
        {
          participant: {
            name: attendance.person.fullName,
            gender: attendance.person.gender,
            ticketCode: attendance.ticketCode,
            status: attendance.status,
            checkInAt: attendance.checkInAt,
            paymentStatus: attendance.paymentStatus,
            referralCode: attendance.referralCode,
            referralLink: attendance.referralCode
              ? `/kajian/${event.id}?ref=${encodeURIComponent(attendance.referralCode)}`
              : null,
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

      // Count past kajian attendance
      const attendanceRecords = await db.query.eventAttendance.findMany({
        where: eq(eventAttendance.personId, person.id),
        orderBy: [sql`${eventAttendance.checkInAt} DESC`],
        limit: 10,
      });

      const totalKajianAttended = attendanceRecords.length;

      // Check if this person has past family members registered in their groups
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
          pastFamilyMembers,
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
