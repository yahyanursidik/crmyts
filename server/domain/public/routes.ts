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
} from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';

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

const publicEventRegistrationSchema = z.object({
  eventId: z.string().uuid('Kajian / Daurah wajib dipilih'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp wajib diisi'),
  gender: z.enum(['ikhwan', 'akhwat']).default('ikhwan'),
  email: z.string().email('Format email tidak valid').optional().nullable(),
  cityRegency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customResponses: z.record(z.any()).optional().nullable(),
  vehicleType: z.enum(['none', 'motorcycle', 'car']).default('none'),
  vehiclePlateNumber: z.string().optional().nullable(),
  agreedToRules: z.boolean().default(true),
});

export function registerPublicPortalRoutes(router: Router) {
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
          address: 'Jl. Radio Tarbiyah Sunnah No. 1, Bandung, Jawa Barat',
          whatsappContact: '+6281234567890',
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
            formConfig: ev.formConfig,
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
          createdBy: amilId,
        })
        .returning();

      // Create Follow-Up Verification Task for Amil
      await db
        .insert(tasks)
        .values({
          personId: person.id,
          title: `Verifikasi Mutasi Infaq: Rp ${body.amountRupiah.toLocaleString('id-ID')} (${displayName})`,
          description: `Konfirmasi transfer online masuk via Portal Publik. Ref: ${invoiceRef}. Mohon cek mutasi rekening BSI dan terbitkan E-Receipt.`,
          priority: 'high',
          status: 'pending',
          ownerUserId: amilId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24h
        });

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

      // 1. Audience Target Validation
      if (targetEvent.targetAudience === 'akhwat_only' && body.gender !== 'akhwat') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Akhwat (Wanita)', 400, ctx.requestId);
      }
      if (targetEvent.targetAudience === 'ikhwan_only' && body.gender !== 'ikhwan') {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kajian ini dikhususkan hanya untuk Jamaah Ikhwan (Laki-laki)', 400, ctx.requestId);
      }

      // 2. Segmented Quota Validations
      const atts = targetEvent.attendances || [];
      const currentIkhwan = atts.filter((a) => a.person?.gender === 'ikhwan').length;
      const currentAkhwat = atts.filter((a) => a.person?.gender === 'akhwat').length;
      const currentCars = atts.filter((a) => a.vehicleType === 'car').length;
      const currentMotorcycles = atts.filter((a) => a.vehicleType === 'motorcycle').length;

      if (body.gender === 'ikhwan' && targetEvent.quotaIkhwan && currentIkhwan >= targetEvent.quotaIkhwan) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota pendaftaran khusus Jamaah Ikhwan telah penuh.', 400, ctx.requestId);
      }
      if (body.gender === 'akhwat' && targetEvent.quotaAkhwat && currentAkhwat >= targetEvent.quotaAkhwat) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota pendaftaran khusus Jamaah Akhwat telah penuh.', 400, ctx.requestId);
      }
      if (targetEvent.quota && atts.length >= targetEvent.quota) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, kuota keseluruhan untuk kajian ini telah penuh.', 400, ctx.requestId);
      }

      // 3. Parking Facility Quota Validations
      if (body.vehicleType === 'car' && targetEvent.carParkingQuota && currentCars >= targetEvent.carParkingQuota) {
        return errorResponse('VALIDATION_ERROR', 'Mohon maaf, slot fasilitas parkir mobil telah penuh. Silakan gunakan sepeda motor atau transportasi umum.', 400, ctx.requestId);
      }
      if (body.vehicleType === 'motorcycle' && targetEvent.motorcycleParkingQuota && currentMotorcycles >= targetEvent.motorcycleParkingQuota) {
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
            email: body.email || null,
            gender: body.gender,
            cityRegency: body.cityRegency || null,
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

      // Generate Ticket Code: TIKET-KJN-YYMMDD-RAND
      const datePart = new Date(targetEvent.startAt).toISOString().slice(2, 10).replace(/-/g, '');
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ticketCode = existingAttendance?.ticketCode || `TIKET-KJN-${datePart}-${randPart}`;

      if (!existingAttendance) {
        await db.insert(eventAttendance).values({
          eventId: targetEvent.id,
          personId: person.id,
          source: 'form_registration',
          status: 'registered',
          ticketCode,
          vehicleType: body.vehicleType || 'none',
          vehiclePlateNumber: body.vehiclePlateNumber || null,
          agreedToRules: body.agreedToRules !== false,
          registrationData: body.customResponses || null,
        });
      }

      return successResponse(
        {
          ticketCode,
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
          },
          participant: {
            name: body.fullName,
            gender: body.gender,
            phone: phoneNorm,
            vehicleType: body.vehicleType,
            vehiclePlateNumber: body.vehiclePlateNumber,
          },
          message:
            'Alhamdulillah, pendaftaran kajian Anda berhasil dicatat. Silakan simpan kode tiket ini dan hadir tepat waktu sebelum kajian dimulai.',
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
