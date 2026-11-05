import { removeRegistrations } from './removeRegistrations';
import { eventScheduleError, mergeEventConfig } from './eventPolicy';
import {
  RegistrationError,
  registerStaffParticipant,
} from './staffRegistration';
import { recordsToCsv } from '../../lib/csv';
import { z } from 'zod';
import { Router } from '../../http/router';
import { validateBody } from '../../http/middleware';
import { requireEventAccess } from './access';
import { paymentCheckInError, PENDING_PAYMENT_STATUSES } from './paymentAccess';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { events, eventAttendance, persons, auditLogs } from '../../db/schema';
import {
  desc,
  eq,
  and,
  inArray,
  notInArray,
  sql,
  or,
  ilike,
} from 'drizzle-orm';
import { isValidE164, normalizeIndonesianPhone } from '../../lib/phone';
import { extractTicketCode } from '../../../src/lib/participantTicket';
import {
  createStaffRegistrationToken,
  isSpecialInviteRegistration,
  isStaffFamilyRegistration,
  isStaffRegistration,
} from './registrationChannels';
import { logAuditEvent } from '../../audit/service';
import {
  getPersonsAttendanceStats,
  getSinglePersonAttendanceStats,
} from './attendanceHistory';
import {
  getEventEmailSettings,
  sendEventTicketEmail,
} from './emailNotifications';
import {
  dispatchEventReminders,
  listEventBroadcastSummaries,
} from './reminderDispatch';
import { getBroadcastDailyQuota } from '../../email/broadcastQuota';
import {
  createQueuedEventBroadcast,
  getEventBroadcastToday,
  listEventEmailTemplates,
  listQueuedEventBroadcasts,
  processQueuedEventBroadcast,
  saveEventEmailTemplate,
} from './broadcastQueue';
import { isDuplicateEventPhoneError } from './registrationPhoneGuard';

const createEventSchema = z.object({
  title: z.string().min(3, 'Judul kajian minimal 3 karakter'),
  category: z.string().min(2, 'Kategori kajian diperlukan'),
  speaker: z.string().min(3, 'Nama pemateri/ustadz diperlukan'),
  description: z.string().optional().nullable(),
  startAt: z
    .string()
    .min(1, 'Waktu mulai diperlukan')
    .transform((value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
        ? value + ':00+07:00'
        : value,
    ),
  endAt: z
    .string()
    .transform((value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
        ? value + ':00+07:00'
        : value,
    )
    .optional()
    .nullable(),
  deliveryMode: z.enum(['offline', 'online', 'hybrid']).default('offline'),
  locationName: z.string().optional().nullable(),
  locationAddress: z
    .string()
    .max(500, 'Alamat lokasi maksimal 500 karakter')
    .optional()
    .nullable(),
  googleMapsUrl: z
    .string()
    .url('Tautan Google Maps tidak valid')
    .optional()
    .nullable()
    .or(z.literal('')),
  locationDirections: z
    .string()
    .max(1000, 'Petunjuk lokasi maksimal 1000 karakter')
    .optional()
    .nullable(),
  showGoogleMaps: z.boolean().default(true),
  meetingUrl: z
    .string()
    .url('URL tidak valid')
    .optional()
    .nullable()
    .or(z.literal('')),

  // Paid Event & Banking Configuration
  isPaid: z.boolean().default(false),
  priceRupiah: z.number().int().min(0).default(0),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),

  // Segmentation & Quota
  targetAudience: z
    .enum(['umum', 'ikhwan_only', 'akhwat_only', 'anak', 'itikaf_ramadan'])
    .default('umum'),
  minAge: z
    .number()
    .int()
    .min(1, 'Usia minimal setidaknya 1 tahun')
    .max(120, 'Usia minimal tidak valid')
    .optional()
    .nullable(),
  quota: z.number().int().min(0).optional().nullable(),
  quotaIkhwan: z.number().int().min(0).optional().nullable(),
  quotaAkhwat: z.number().int().min(0).optional().nullable(),
  quotaInvite: z.number().int().min(0).optional().nullable(),
  quotaInviteIkhwan: z.number().int().min(0).optional().nullable(),
  quotaInviteAkhwat: z.number().int().min(0).optional().nullable(),
  quotaStaff: z.number().int().min(0).optional().nullable(),
  quotaStaffIkhwan: z.number().int().min(0).optional().nullable(),
  quotaStaffAkhwat: z.number().int().min(0).optional().nullable(),
  isRegistrationOpen: z.boolean().default(true),
  isStaffRegistrationOpen: z.boolean().default(false),

  // Logistics & Rules
  carParkingQuota: z.number().int().min(0).optional().nullable(),
  motorcycleParkingQuota: z.number().int().min(0).optional().nullable(),
  venueRules: z.array(z.string()).optional().nullable(),
  customVenueRules: z.string().optional().nullable(),

  formConfig: z.record(z.any()).optional().nullable(),
});

const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).optional(),
});

const eventBroadcastEmailSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Subjek email minimal 3 karakter.')
    .max(160, 'Subjek email maksimal 160 karakter.'),
  message: z
    .string()
    .trim()
    .min(3, 'Isi email minimal 3 karakter.')
    .max(5000, 'Isi email maksimal 5000 karakter.'),
  batchSize: z.number().int().min(25).max(100).optional(),
  templateId: z.string().uuid().optional().nullable(),
});

const eventBroadcastTemplateSchema = z.object({
  name: z.string().trim().min(3, 'Nama template minimal 3 karakter.').max(100),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(5000),
});

const editEventParticipantSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Nama lengkap minimal 3 karakter.')
    .max(160),
  phone: z.string().trim().min(8, 'Nomor WhatsApp tidak valid.').max(24),
  email: z
    .string()
    .trim()
    .email('Email tidak valid.')
    .optional()
    .or(z.literal('')),
  cityRegency: z.string().trim().max(120).optional().or(z.literal('')),
});

async function checkEventPayment(
  db: ReturnType<typeof getDb>,
  eventId: string,
  attendance: { paymentStatus?: string | null },
) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { isPaid: true },
  });
  return paymentCheckInError(attendance, event?.isPaid === true);
}

export function registerEventsRoutes(router: Router) {
  // 1. GET /api/events (List all events with participant counts, quotas & parking)
  router.get(
    '/api/events',
    requireEventAccess(async (ctx) => {
      const db = getDb();

      try {
        const eventList = await db
          .select()
          .from(events)
          .orderBy(desc(events.startAt));

        // Grouped aggregation query for event attendances (extremely fast & indexed)
        const stats = await db
          .select({
            eventId: eventAttendance.eventId,
            total: sql<number>`cast(count(${eventAttendance.id}) as integer)`,
            attended: sql<number>`cast(count(case when ${eventAttendance.status} = 'attended' then 1 end) as integer)`,
            registered: sql<number>`cast(count(case when ${eventAttendance.status} = 'registered' then 1 end) as integer)`,
            cars: sql<number>`cast(count(case when ${eventAttendance.vehicleType} = 'car' then 1 end) as integer)`,
            motorcycles: sql<number>`cast(count(case when ${eventAttendance.vehicleType} = 'motorcycle' then 1 end) as integer)`,
          })
          .from(eventAttendance)
          .groupBy(eventAttendance.eventId);

        const statsMap = new Map<string, any>();
        for (const s of stats) {
          if (s.eventId) statsMap.set(s.eventId, s);
        }

        // Grouped aggregation for gender counts
        const genderStats = await db
          .select({
            eventId: eventAttendance.eventId,
            ikhwan: sql<number>`cast(count(case when ${persons.gender} = 'ikhwan' then 1 end) as integer)`,
            akhwat: sql<number>`cast(count(case when ${persons.gender} = 'akhwat' then 1 end) as integer)`,
          })
          .from(eventAttendance)
          .leftJoin(persons, eq(eventAttendance.personId, persons.id))
          .groupBy(eventAttendance.eventId);

        const genderMap = new Map<string, any>();
        for (const g of genderStats) {
          if (g.eventId) genderMap.set(g.eventId, g);
        }

        const formatted = eventList.map((e) => {
          const s = statsMap.get(e.id) || {};
          const g = genderMap.get(e.id) || {};

          return {
            ...e,
            formConfig: undefined,
            staffRegistrationToken: undefined,
            attendances: undefined,
            attendanceCount: s.total || 0,
            attendedCount: s.attended || 0,
            registeredCount: s.registered || 0,
            ikhwanCount: g.ikhwan || 0,
            akhwatCount: g.akhwat || 0,
            carsCount: s.cars || 0,
            motorcyclesCount: s.motorcycles || 0,
          };
        });

        return successResponse(formatted, {
          requestId: ctx.requestId,
          total: formatted.length,
        });
      } catch (err) {
        // Fallback for minimal testing / legacy contexts
        const list = await db.query.events.findMany({
          orderBy: [desc(events.startAt)],
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

        const formatted = list.map((e) => {
          const atts = e.attendances || [];
          const ikhwanCount = atts.filter(
            (a) => a.person?.gender === 'ikhwan',
          ).length;
          const akhwatCount = atts.filter(
            (a) => a.person?.gender === 'akhwat',
          ).length;
          const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
          const motorcyclesCount = atts.filter(
            (a) => a.vehicleType === 'motorcycle',
          ).length;

          return {
            ...e,
            formConfig: undefined,
            staffRegistrationToken: undefined,
            attendances: undefined,
            attendanceCount: atts.length,
            attendedCount: atts.filter((a) => a.status === 'attended').length,
            registeredCount: atts.filter((a) => a.status === 'registered')
              .length,
            ikhwanCount,
            akhwatCount,
            carsCount,
            motorcyclesCount,
          };
        });

        return successResponse(formatted, {
          requestId: ctx.requestId,
          total: formatted.length,
        });
      }
    }),
  );

  router.get(
    '/api/events/:id/settings',
    requireEventAccess(async (ctx) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID tidak valid.',
          400,
          ctx.requestId,
        );
      const db = getDb();
      const event = await db.query.events.findFirst({
        where: eq(events.id, ctx.params.id!),
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );
      const result = await db.execute(sql`SELECT
      count(*)::int AS "totalParticipants",
      count(*) FILTER (WHERE a.status = 'attended')::int AS "attendedCount",
      count(*) FILTER (WHERE p.gender = 'ikhwan')::int AS "ikhwanCount",
      count(*) FILTER (WHERE p.gender = 'akhwat')::int AS "akhwatCount",
      count(*) FILTER (WHERE a.vehicle_type = 'car')::int AS "carsCount",
      count(*) FILTER (WHERE a.vehicle_type = 'motorcycle')::int AS "motorcyclesCount",
      count(*) FILTER (WHERE a.registration_data->>'registrationChannel' IN ('staff_yayasan', 'staff_yayasan_family'))::int AS "staffCount",
      count(DISTINCT lower(p.email)) FILTER (WHERE p.email IS NOT NULL AND p.email <> '')::int AS "emailRecipientCount"
      FROM event_attendance a LEFT JOIN persons p ON p.id = a.person_id WHERE a.event_id = ${event.id}`);
      return successResponse(
        {
          ...event,
          ...result.rows[0],
          participants: [],
          adminInviteCode:
            event.formConfig?.adminInviteCode?.trim().toUpperCase() ||
            `UNDANGAN-${event.id.slice(0, 6).toUpperCase()}`,
          emailSettings: getEventEmailSettings(event.formConfig),
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  router.post(
    '/api/events/:id/participants/export',
    requireEventAccess(async (ctx) => {
      const parsed = z
        .object({ attendanceIds: z.array(z.string().uuid()).min(1).max(20000) })
        .safeParse(ctx.body);
      if (!parsed.success)
        return errorResponse(
          'VALIDATION_ERROR',
          'Pilih peserta yang akan diekspor.',
          400,
          ctx.requestId,
        );
      const db = getDb();
      const roster = await db.query.eventAttendance.findMany({
        where: and(
          eq(eventAttendance.eventId, ctx.params.id!),
          inArray(eventAttendance.id, parsed.data.attendanceIds),
        ),
        with: { person: true },
      });
      const event = await db.query.events.findFirst({
        where: eq(events.id, ctx.params.id!),
      });
      const fields = (event?.formConfig?.customFields || []) as Array<{
        id: string;
        label: string;
      }>;
      const csvContent = recordsToCsv(
        roster.map((row) => ({
          'Kode tiket': row.ticketCode,
          Nama: row.person?.fullName,
          WhatsApp: row.person?.phoneE164,
          Email: row.person?.email,
          Gender: row.person?.gender,
          Kota: row.person?.cityRegency,
          Status: row.status,
          'Hadir (WIB)': row.checkInAt
            ? new Date(row.checkInAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
              })
            : '',
          Pembayaran:
            event?.isPaid &&
            row.paymentStatus === 'free' &&
            !isStaffRegistration(row)
              ? 'Perlu ditinjau'
              : row.paymentStatus,
          Kendaraan: row.vehicleType,
          'Nomor polisi': row.vehiclePlateNumber,
          Rombongan: row.registrationGroupId,
          Usia: row.age,
          ...Object.fromEntries(
            fields.map((field) => [
              `Form: ${field.label} (${field.id})`,
              row.registrationData?.[field.id],
            ]),
          ),
        })),
      );
      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'export_event_participants',
        entityType: 'event',
        entityId: ctx.params.id!,
        afterJson: { count: roster.length },
        reason: 'Ekspor daftar peserta sesuai filter/pilihan',
        requestId: ctx.requestId,
      });
      return successResponse(
        {
          csvContent,
          count: roster.length,
          filename: `peserta-${ctx.params.id}.csv`,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 2. GET /api/events/:id (Detail event with full participant roster & logistics)
  router.get(
    '/api/events/:id',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      const eventItem = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        with: {
          creator: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          attendances: {
            with: {
              person: true,
            },
            orderBy: [desc(eventAttendance.checkInAt)],
          },
        },
      });

      if (!eventItem) {
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan',
          404,
          ctx.requestId,
        );
      }

      const adminInviteCode =
        eventItem.formConfig?.adminInviteCode?.trim().toUpperCase() ||
        `UNDANGAN-${eventItem.id.slice(0, 6).toUpperCase()}`;

      const personIds = eventItem.attendances
        .map((att) => att.personId)
        .filter(Boolean) as string[];
      const attendanceStatsMap = await getPersonsAttendanceStats(
        db,
        personIds,
        eventId,
      );

      const participants = eventItem.attendances.map((att) => {
        const pStats = attendanceStatsMap.get(att.personId);
        const isStaffRegistrant = isStaffRegistration(att);
        const isSpecialInvite = isSpecialInviteRegistration(att);

        return {
          id: att.id,
          personId: att.personId,
          personName: att.person?.fullName || 'Anonim',
          personPhone: att.person?.phoneE164 || '-',
          personGender: att.person?.gender || 'ikhwan',
          personEmail: att.person?.email || null,
          personCity: att.person?.cityRegency || null,
          status: att.status,
          source: att.source,
          checkInAt: att.checkInAt,
          ticketCode: att.ticketCode,
          referralCode: att.referralCode,
          isSpecialInvite,
          isStaffRegistration: isStaffRegistrant,
          isStaffFamilyRegistration: isStaffFamilyRegistration(att),
          referredByAttendanceId: att.referredByAttendanceId,

          // Attendance History & Loyalty
          pastAttendedCount: pStats?.pastAttendedCount ?? 0,
          totalAttendedCount:
            pStats?.totalAttendedCount ?? (att.status === 'attended' ? 1 : 0),
          pastRegisteredCount: pStats?.pastRegisteredCount ?? 0,
          currentKajianNumber: pStats?.currentKajianNumber ?? 1,
          loyaltyTier: pStats?.loyaltyTier ?? 'perdana',
          loyaltyLabel: pStats?.loyaltyLabel ?? '🌱 Jamaah Baru',
          lastAttendedTitle: pStats?.lastAttendedTitle ?? null,
          lastAttendedDate: pStats?.lastAttendedDate ?? null,

          // Payment Information
          paymentNeedsReview: Boolean(
            eventItem.isPaid &&
              !isStaffRegistration(att) &&
              (!att.paymentStatus || att.paymentStatus === 'free'),
          ),
          paymentStatus:
            att.paymentStatus ||
            (eventItem.isPaid ? 'pending_payment' : 'free'),
          paymentProofUrl: att.paymentProofUrl || null,
          paymentAmountRupiah:
            att.paymentAmountRupiah ||
            (eventItem.isPaid ? eventItem.priceRupiah : 0),
          paymentVerifiedAt: att.paymentVerifiedAt || null,
          paymentRejectionReason: att.paymentRejectionReason || null,

          // Group / Family Registration
          registrationGroupId: att.registrationGroupId || null,
          familyRelationship: att.familyRelationship || null,
          age: att.age || null,

          vehicleType: att.vehicleType,
          vehiclePlateNumber: att.vehiclePlateNumber,
          agreedToRules: att.agreedToRules,
          registrationData: att.registrationData || null,
        };
      });

      // Existing legacy duplicates stay visible for an admin decision; they are
      // not deleted automatically because either ticket may contain payment or
      // gate history. New duplicates are blocked by the registration guard.
      const physicalPhoneCounts = new Map<string, number>();
      for (const participant of participants) {
        if (/^\+[1-9][0-9]{7,14}$/.test(participant.personPhone)) {
          physicalPhoneCounts.set(
            participant.personPhone,
            (physicalPhoneCounts.get(participant.personPhone) || 0) + 1,
          );
        }
      }
      const participantsWithDuplicateContact = participants.map(
        (participant) => ({
          ...participant,
          duplicatePhoneCount:
            physicalPhoneCounts.get(participant.personPhone) || 0,
        }),
      );

      const ikhwanCount = participants.filter(
        (p) => p.personGender === 'ikhwan',
      ).length;
      const akhwatCount = participants.filter(
        (p) => p.personGender === 'akhwat',
      ).length;
      const carsCount = participants.filter(
        (p) => p.vehicleType === 'car',
      ).length;
      const motorcyclesCount = participants.filter(
        (p) => p.vehicleType === 'motorcycle',
      ).length;
      const waitingVerificationCount = participants.filter(
        (p) => p.paymentStatus === 'waiting_verification',
      ).length;
      const verifiedPaymentCount = participants.filter(
        (p) => p.paymentStatus === 'verified',
      ).length;
      const pendingPaymentCount = participants.filter(
        (p) => p.paymentStatus === 'pending_payment',
      ).length;
      const specialInviteCount = participants.filter(
        (p) => p.isSpecialInvite,
      ).length;
      const specialInviteIkhwanCount = participants.filter(
        (p) => p.isSpecialInvite && p.personGender === 'ikhwan',
      ).length;
      const specialInviteAkhwatCount = participants.filter(
        (p) => p.isSpecialInvite && p.personGender === 'akhwat',
      ).length;
      const staffCount = participants.filter(
        (p) => p.isStaffRegistration,
      ).length;
      const staffIkhwanCount = participants.filter(
        (p) => p.isStaffRegistration && p.personGender === 'ikhwan',
      ).length;
      const staffAkhwatCount = participants.filter(
        (p) => p.isStaffRegistration && p.personGender === 'akhwat',
      ).length;
      const regularCount = participants.filter(
        (p) => !p.isSpecialInvite && !p.isStaffRegistration,
      ).length;
      const regularIkhwanCount = participants.filter(
        (p) =>
          !p.isSpecialInvite &&
          !p.isStaffRegistration &&
          p.personGender === 'ikhwan',
      ).length;
      const regularAkhwatCount = participants.filter(
        (p) =>
          !p.isSpecialInvite &&
          !p.isStaffRegistration &&
          p.personGender === 'akhwat',
      ).length;
      const firstTimerCount = participants.filter(
        (p) => p.currentKajianNumber <= 1,
      ).length;
      const returningCount = participants.filter(
        (p) => p.currentKajianNumber > 1,
      ).length;
      const emailRecipientCount = new Set(
        participants
          .map((participant) => participant.personEmail?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ).size;
      const emailReminderSentCount = participants.filter((participant) =>
        Boolean(
          (participant.registrationData as any)?.emailNotifications
            ?.reminderH1SentAt,
        ),
      ).length;
      const emailBroadcastQuota = await getBroadcastDailyQuota(db).catch(
        () => null,
      );

      return successResponse(
        {
          ...eventItem,
          attendances: undefined,
          paymentReviewCount: participants.filter((p) => p.paymentNeedsReview)
            .length,
          adminInviteCode,
          participants: participantsWithDuplicateContact,
          totalParticipants: participants.length,
          attendedCount: participants.filter((p) => p.status === 'attended')
            .length,
          ikhwanCount,
          akhwatCount,
          carsCount,
          motorcyclesCount,
          waitingVerificationCount,
          verifiedPaymentCount,
          pendingPaymentCount,
          specialInviteCount,
          specialInviteIkhwanCount,
          specialInviteAkhwatCount,
          staffCount,
          staffIkhwanCount,
          staffAkhwatCount,
          regularCount,
          regularIkhwanCount,
          regularAkhwatCount,
          referralSignups: specialInviteCount,
          firstTimerCount,
          returningCount,
          emailRecipientCount,
          emailReminderSentCount,
          emailSettings: getEventEmailSettings(eventItem.formConfig),
          emailBroadcastQuota,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 3. POST /api/events (Create new event with audience segment, quotas, payment & parking)
  router.post(
    '/api/events',
    requireEventAccess(
      validateBody(createEventSchema, async (ctx, body) => {
        const db = getDb();
        if (!ctx.user)
          return errorResponse(
            'UNAUTHENTICATED',
            'Login diperlukan',
            401,
            ctx.requestId,
          );

        const scheduleError = eventScheduleError(body);
        if (scheduleError)
          return errorResponse(
            'VALIDATION_ERROR',
            scheduleError,
            400,
            ctx.requestId,
          );

        const defaultFormConfig = {
          collectEmail: true,
          requireEmail: false,
          collectCity: true,
          collectNotes: true,
          requireGender: true,
          collectVehicle: true,
          allowMultiParticipant: false,
          maxMultiParticipants: 10,
          allowStaffFamilyRegistration: false,
          maxStaffFamilyParticipants: 4,
          customFields: [],
          whatsappMessageTemplate:
            'Bismillah. Pendaftaran kajian Anda telah terkonfirmasi. Tiket: {{ticket_code}}. Mohon hadir 15 menit sebelum acara dimulai dan menaati tata tertib majelis. Barakallahu fiikum.',
          ...body.formConfig,
          gateAccessToken: createStaffRegistrationToken(),
        };

        const [created] = await db
          .insert(events)
          .values({
            title: body.title,
            category: body.category,
            speaker: body.speaker,
            description: body.description || null,
            startAt: new Date(body.startAt),
            endAt: body.endAt ? new Date(body.endAt) : null,
            deliveryMode: body.deliveryMode,
            locationName: body.locationName || null,
            locationAddress: body.locationAddress || null,
            googleMapsUrl: body.googleMapsUrl || null,
            locationDirections: body.locationDirections || null,
            showGoogleMaps: body.showGoogleMaps !== false,
            meetingUrl: body.meetingUrl || null,

            isPaid: body.isPaid || false,
            priceRupiah: body.priceRupiah || 0,
            bankName: body.bankName || null,
            bankAccountNumber: body.bankAccountNumber || null,
            bankAccountName: body.bankAccountName || null,
            paymentInstructions: body.paymentInstructions || null,

            targetAudience: body.targetAudience || 'umum',
            minAge: body.minAge !== undefined ? body.minAge : null,
            quota: body.quota ? body.quota : null,
            quotaIkhwan: body.quotaIkhwan ? body.quotaIkhwan : null,
            quotaAkhwat: body.quotaAkhwat ? body.quotaAkhwat : null,
            quotaInvite: body.quotaInvite ? body.quotaInvite : null,
            quotaInviteIkhwan: body.quotaInviteIkhwan
              ? body.quotaInviteIkhwan
              : null,
            quotaInviteAkhwat: body.quotaInviteAkhwat
              ? body.quotaInviteAkhwat
              : null,
            quotaStaff: body.quotaStaff ? body.quotaStaff : null,
            quotaStaffIkhwan: body.quotaStaffIkhwan
              ? body.quotaStaffIkhwan
              : null,
            quotaStaffAkhwat: body.quotaStaffAkhwat
              ? body.quotaStaffAkhwat
              : null,
            isRegistrationOpen: body.isRegistrationOpen !== false,
            isStaffRegistrationOpen: body.isStaffRegistrationOpen === true,
            staffRegistrationToken: createStaffRegistrationToken(),

            carParkingQuota: body.carParkingQuota ? body.carParkingQuota : null,
            motorcycleParkingQuota: body.motorcycleParkingQuota
              ? body.motorcycleParkingQuota
              : null,
            venueRules: body.venueRules || [],
            customVenueRules: body.customVenueRules || null,

            formConfig: defaultFormConfig,
            createdBy: ctx.user!.id,
          })
          .returning();

        return successResponse(created, { requestId: ctx.requestId }, 201);
      }),
    ),
  );

  // 4. PUT /api/events/:id (Update event, quotas, venue rules, payment & form builder)
  router.put(
    '/api/events/:id',
    requireEventAccess(
      validateBody(updateEventSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params.id;
        if (!eventId) {
          return errorResponse(
            'VALIDATION_ERROR',
            'Event ID diperlukan',
            400,
            ctx.requestId,
          );
        }

        return db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`,
          );
          const existing = await tx.query.events.findFirst({
            where: eq(events.id, eventId),
          });

          if (!existing) {
            return errorResponse(
              'NOT_FOUND',
              'Kajian tidak ditemukan',
              404,
              ctx.requestId,
            );
          }

          const scheduleError = eventScheduleError({ ...existing, ...body });
          if (scheduleError)
            return errorResponse(
              'VALIDATION_ERROR',
              scheduleError,
              400,
              ctx.requestId,
            );

          const updatePayload: any = {
            updatedAt: new Date(),
          };

          if (body.title !== undefined) updatePayload.title = body.title;
          if (body.category !== undefined)
            updatePayload.category = body.category;
          if (body.speaker !== undefined) updatePayload.speaker = body.speaker;
          if (body.description !== undefined)
            updatePayload.description = body.description;
          if (body.startAt !== undefined)
            updatePayload.startAt = new Date(body.startAt);
          if (body.endAt !== undefined)
            updatePayload.endAt = body.endAt ? new Date(body.endAt) : null;
          if (body.deliveryMode !== undefined)
            updatePayload.deliveryMode = body.deliveryMode;
          if (body.locationName !== undefined)
            updatePayload.locationName = body.locationName;
          if (body.locationAddress !== undefined)
            updatePayload.locationAddress = body.locationAddress;
          if (body.googleMapsUrl !== undefined)
            updatePayload.googleMapsUrl = body.googleMapsUrl || null;
          if (body.locationDirections !== undefined)
            updatePayload.locationDirections = body.locationDirections;
          if (body.showGoogleMaps !== undefined)
            updatePayload.showGoogleMaps = body.showGoogleMaps;
          if (body.meetingUrl !== undefined)
            updatePayload.meetingUrl = body.meetingUrl;
          if (body.status !== undefined) updatePayload.status = body.status;

          if (body.isPaid !== undefined) updatePayload.isPaid = body.isPaid;
          if (body.priceRupiah !== undefined)
            updatePayload.priceRupiah = body.priceRupiah;
          if (body.bankName !== undefined)
            updatePayload.bankName = body.bankName;
          if (body.bankAccountNumber !== undefined)
            updatePayload.bankAccountNumber = body.bankAccountNumber;
          if (body.bankAccountName !== undefined)
            updatePayload.bankAccountName = body.bankAccountName;
          if (body.paymentInstructions !== undefined)
            updatePayload.paymentInstructions = body.paymentInstructions;

          if (body.targetAudience !== undefined)
            updatePayload.targetAudience = body.targetAudience;
          if (body.minAge !== undefined) updatePayload.minAge = body.minAge;
          if (body.quota !== undefined)
            updatePayload.quota = body.quota ? body.quota : null;
          if (body.quotaIkhwan !== undefined)
            updatePayload.quotaIkhwan = body.quotaIkhwan
              ? body.quotaIkhwan
              : null;
          if (body.quotaAkhwat !== undefined)
            updatePayload.quotaAkhwat = body.quotaAkhwat
              ? body.quotaAkhwat
              : null;
          if (body.quotaInvite !== undefined)
            updatePayload.quotaInvite = body.quotaInvite
              ? body.quotaInvite
              : null;
          if (body.quotaInviteIkhwan !== undefined)
            updatePayload.quotaInviteIkhwan = body.quotaInviteIkhwan
              ? body.quotaInviteIkhwan
              : null;
          if (body.quotaInviteAkhwat !== undefined)
            updatePayload.quotaInviteAkhwat = body.quotaInviteAkhwat
              ? body.quotaInviteAkhwat
              : null;
          if (body.quotaStaff !== undefined)
            updatePayload.quotaStaff = body.quotaStaff ? body.quotaStaff : null;
          if (body.quotaStaffIkhwan !== undefined)
            updatePayload.quotaStaffIkhwan = body.quotaStaffIkhwan
              ? body.quotaStaffIkhwan
              : null;
          if (body.quotaStaffAkhwat !== undefined)
            updatePayload.quotaStaffAkhwat = body.quotaStaffAkhwat
              ? body.quotaStaffAkhwat
              : null;
          if (body.isRegistrationOpen !== undefined)
            updatePayload.isRegistrationOpen = body.isRegistrationOpen;
          if (body.isStaffRegistrationOpen !== undefined)
            updatePayload.isStaffRegistrationOpen =
              body.isStaffRegistrationOpen;

          if (body.carParkingQuota !== undefined)
            updatePayload.carParkingQuota = body.carParkingQuota
              ? body.carParkingQuota
              : null;
          if (body.motorcycleParkingQuota !== undefined)
            updatePayload.motorcycleParkingQuota = body.motorcycleParkingQuota
              ? body.motorcycleParkingQuota
              : null;
          if (body.venueRules !== undefined)
            updatePayload.venueRules = body.venueRules;
          if (body.customVenueRules !== undefined)
            updatePayload.customVenueRules = body.customVenueRules;

          if (body.formConfig !== undefined)
            updatePayload.formConfig = {
              ...mergeEventConfig(existing.formConfig, body.formConfig),
              gateAccessToken:
                existing.formConfig?.gateAccessToken ||
                createStaffRegistrationToken(),
            };
          if (
            ['cancelled', 'completed'].includes(body.status || existing.status)
          ) {
            updatePayload.isRegistrationOpen = false;
            updatePayload.isStaffRegistrationOpen = false;
          }

          const [updated] = await tx
            .update(events)
            .set(updatePayload)
            .where(eq(events.id, eventId))
            .returning();

          await tx.insert(auditLogs).values({
            actorUserId: ctx.user?.id,
            action: 'update_event',
            entityType: 'event',
            entityId: eventId,
            beforeJson: { status: existing.status },
            afterJson: { fields: Object.keys(body), status: updated?.status },
            reason: 'Perubahan pengaturan event',
            requestId: ctx.requestId,
          });
          return successResponse(updated, { requestId: ctx.requestId });
        });
      }),
    ),
  );

  // Regenerating a link immediately invalidates the previous staff-only link.
  router.post(
    '/api/events/:id/staff-registration-token',
    requireEventAccess(async (ctx) => {
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      const [updated] = await getDb()
        .update(events)
        .set({
          staffRegistrationToken: createStaffRegistrationToken(),
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId))
        .returning();
      if (!updated)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan',
          404,
          ctx.requestId,
        );
      try {
        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'rotate_event_staff_registration_token',
          entityType: 'event',
          entityId: eventId,
          beforeJson: { eventId },
          reason: 'Regenerasi tautan pendaftaran staff kajian',
          requestId: ctx.requestId,
        });
      } catch (error) {
        console.error('Gagal mencatat audit regenerasi tautan staff:', error);
      }
      return successResponse(
        { staffRegistrationToken: updated.staffRegistrationToken },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 5. DELETE /api/events/:id (Delete / cancel event)
  router.delete(
    '/api/events/:id',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`,
        );
        const existing = await tx.query.events.findFirst({
          where: eq(events.id, eventId),
        });
        if (!existing)
          return errorResponse(
            'NOT_FOUND',
            'Kajian tidak ditemukan',
            404,
            ctx.requestId,
          );
        // Include dynamically provisioned broadcast/phone-claim tables and SET NULL references.
        const references = await tx.execute(sql`
          SELECT ns.nspname AS schema_name, child.relname AS table_name, col.attname AS column_name
          FROM pg_constraint fk
          JOIN pg_class child ON child.oid = fk.conrelid
          JOIN pg_namespace ns ON ns.oid = child.relnamespace
          JOIN pg_attribute col ON col.attrelid = child.oid AND col.attnum = ANY(fk.conkey)
          WHERE fk.contype = 'f' AND fk.confrelid = 'public.events'::regclass`);
        for (const ref of references.rows as Array<{
          schema_name: string;
          table_name: string;
          column_name: string;
        }>) {
          const check = await tx.execute(
            sql`SELECT EXISTS(SELECT 1 FROM ${sql.identifier(ref.schema_name)}.${sql.identifier(ref.table_name)} WHERE ${sql.identifier(ref.column_name)} = ${eventId}::uuid) AS present`,
          );
          if (check.rows[0]?.present)
            return errorResponse(
              'CONFLICT',
              'Event memiliki riwayat peserta atau operasional. Gunakan status Dibatalkan agar data tetap tersimpan.',
              409,
              ctx.requestId,
            );
        }
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user?.id,
          action: 'delete_empty_event',
          entityType: 'event',
          entityId: eventId,
          beforeJson: existing,
          reason: 'Menghapus jadwal kosong tanpa riwayat',
          requestId: ctx.requestId,
        });
        await tx.delete(events).where(eq(events.id, eventId));
        return successResponse(
          { message: 'Jadwal kosong berhasil dihapus', id: eventId },
          { requestId: ctx.requestId },
        );
      });
    }),
  );

  // 6. POST /api/events/:id/attendance (Check-in by Person ID or QR)
  router.post(
    '/api/events/:id/attendance',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { personId, source, ticketCode } = (ctx.body as any) || {};

      if (!eventId || (!personId && !ticketCode)) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan Person ID / Ticket Code wajib disertakan',
          400,
          ctx.requestId,
        );
      }

      try {
        if (ticketCode) {
          const rawCode = String(ticketCode).trim();
          const normalizedTicketCode = extractTicketCode(rawCode);
          const attendance = await db.query.eventAttendance.findFirst({
            where: and(
              eq(eventAttendance.eventId, eventId),
              or(
                eq(eventAttendance.ticketCode, normalizedTicketCode),
                eq(eventAttendance.ticketCode, rawCode.toUpperCase()),
              ),
            ),
          });

          if (attendance) {
            const paymentError = await checkEventPayment(
              db,
              eventId,
              attendance,
            );
            if (paymentError)
              return errorResponse(
                'INVALID_STATE_TRANSITION',
                paymentError,
                400,
                ctx.requestId,
              );
            const [updated] = await db
              .update(eventAttendance)
              .set({ status: 'attended', checkInAt: new Date() })
              .where(eq(eventAttendance.id, attendance.id))
              .returning();
            if (!updated) {
              return errorResponse(
                'INTERNAL_ERROR',
                'Gagal mencatat presensi',
                500,
                ctx.requestId,
              );
            }
            const pStats = await getSinglePersonAttendanceStats(
              db,
              updated.personId,
              eventId,
            );
            return successResponse(
              {
                ...updated,
                pastAttendedCount: pStats.pastAttendedCount,
                totalAttendedCount: pStats.pastAttendedCount + 1,
                currentKajianNumber: pStats.currentKajianNumber,
                loyaltyTier: pStats.loyaltyTier,
                loyaltyLabel: pStats.loyaltyLabel,
              },
              { requestId: ctx.requestId },
            );
          }
        }

        if (personId) {
          const existingAttendance = await db.query.eventAttendance.findFirst({
            where: and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.personId, personId),
            ),
          });
          if (existingAttendance) {
            const paymentError = await checkEventPayment(
              db,
              eventId,
              existingAttendance,
            );
            if (paymentError)
              return errorResponse(
                'INVALID_STATE_TRANSITION',
                paymentError,
                400,
                ctx.requestId,
              );
            const [updated] = await db
              .update(eventAttendance)
              .set({ status: 'attended', checkInAt: new Date() })
              .where(eq(eventAttendance.id, existingAttendance.id))
              .returning();
            return successResponse(updated, { requestId: ctx.requestId });
          }
          const event = await db.query.events.findFirst({
            where: eq(events.id, eventId),
          });
          if (!event)
            return errorResponse(
              'NOT_FOUND',
              'Kajian tidak ditemukan.',
              404,
              ctx.requestId,
            );
          if (event.isPaid)
            return errorResponse(
              'INVALID_STATE_TRANSITION',
              'Daftarkan peserta dan verifikasi pembayaran terlebih dahulu.',
              400,
              ctx.requestId,
            );
          const insertQuery = db.insert(eventAttendance).values({
            eventId,
            personId,
            source: source || 'manual_input',
            status: 'attended',
            checkInAt: new Date(),
          });

          const onConflict =
            typeof (insertQuery as any).onConflictDoNothing === 'function'
              ? (insertQuery as any).onConflictDoNothing()
              : insertQuery;

          const [attendance] = await onConflict.returning();
          const targetPid = attendance ? attendance.personId : personId;
          const pStats = await getSinglePersonAttendanceStats(
            db,
            targetPid,
            eventId,
          );

          return successResponse(
            {
              ...(attendance || {
                status: 'attended',
                message: 'Jamaah sudah tercatat hadir',
              }),
              pastAttendedCount: pStats.pastAttendedCount,
              totalAttendedCount: pStats.pastAttendedCount + 1,
              currentKajianNumber: pStats.currentKajianNumber,
              loyaltyTier: pStats.loyaltyTier,
              loyaltyLabel: pStats.loyaltyLabel,
            },
            { requestId: ctx.requestId },
          );
        }

        return errorResponse(
          'NOT_FOUND',
          'Data kehadiran tidak ditemukan',
          404,
          ctx.requestId,
        );
      } catch (err: any) {
        return errorResponse(
          'INTERNAL_ERROR',
          'Gagal mencatat presensi',
          500,
          ctx.requestId,
        );
      }
    }),
  );

  // 7. POST /api/events/:id/toggle-attendance (Toggle attended / registered status)
  router.post(
    '/api/events/:id/toggle-attendance',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceId } = (ctx.body as any) || {};

      if (!eventId || !attendanceId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan Attendance ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      const existing = await db.query.eventAttendance.findFirst({
        where: and(
          eq(eventAttendance.id, attendanceId),
          eq(eventAttendance.eventId, eventId),
        ),
      });

      if (!existing) {
        return errorResponse(
          'NOT_FOUND',
          'Data kehadiran tidak ditemukan',
          404,
          ctx.requestId,
        );
      }

      const newStatus =
        existing.status === 'attended' ? 'registered' : 'attended';
      const paymentError =
        newStatus === 'attended'
          ? await checkEventPayment(db, eventId, existing)
          : null;
      if (paymentError)
        return errorResponse(
          'INVALID_STATE_TRANSITION',
          paymentError,
          400,
          ctx.requestId,
        );

      const [updated] = await db
        .update(eventAttendance)
        .set({
          status: newStatus,
          checkInAt: newStatus === 'attended' ? new Date() : null,
        })
        .where(eq(eventAttendance.id, attendanceId))
        .returning();

      if (!updated) {
        return errorResponse(
          'INTERNAL_ERROR',
          'Gagal memperbarui status presensi',
          500,
          ctx.requestId,
        );
      }

      const pStats = await getSinglePersonAttendanceStats(
        db,
        updated.personId,
        eventId,
      );

      return successResponse(
        {
          ...updated,
          pastAttendedCount: pStats.pastAttendedCount,
          totalAttendedCount:
            newStatus === 'attended'
              ? pStats.pastAttendedCount + 1
              : pStats.pastAttendedCount,
          currentKajianNumber: pStats.currentKajianNumber,
          loyaltyTier: pStats.loyaltyTier,
          loyaltyLabel: pStats.loyaltyLabel,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 7b. POST /api/events/:id/attendances/:attendanceId/verify-payment (Verify/Approve Payment by Admin/Finance)
  router.post(
    '/api/events/:id/attendances/:attendanceId/verify-payment',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;

      if (!ctx.user) {
        return errorResponse(
          'UNAUTHENTICATED',
          'Login diperlukan',
          401,
          ctx.requestId,
        );
      }

      if (!eventId || !attendanceId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan Attendance ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM event_attendance WHERE event_id = ${eventId} FOR UPDATE`,
        );
        const existing = await tx.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.id, attendanceId),
            eq(eventAttendance.eventId, eventId),
          ),
        });

        if (!existing) {
          return errorResponse(
            'NOT_FOUND',
            'Data pendaftaran peserta tidak ditemukan',
            404,
            ctx.requestId,
          );
        }

        let updatedList: any[] = [];
        if (existing.registrationGroupId) {
          updatedList = await tx
            .update(eventAttendance)
            .set({
              paymentStatus: 'verified',
              paymentVerifiedBy: ctx.user!.id,
              paymentVerifiedAt: new Date(),
              paymentRejectionReason: null,
            })
            .where(
              and(
                eq(eventAttendance.eventId, eventId),
                eq(
                  eventAttendance.registrationGroupId,
                  existing.registrationGroupId,
                ),
              ),
            )
            .returning();
        } else {
          updatedList = await tx
            .update(eventAttendance)
            .set({
              paymentStatus: 'verified',
              paymentVerifiedBy: ctx.user!.id,
              paymentVerifiedAt: new Date(),
              paymentRejectionReason: null,
            })
            .where(eq(eventAttendance.id, attendanceId))
            .returning();
        }

        await tx.insert(auditLogs).values({
          actorUserId: ctx.user!.id,
          action: 'verify_event_payment',
          entityType: 'event_attendance',
          entityId: attendanceId,
          beforeJson: { paymentStatus: existing.paymentStatus },
          afterJson: { updatedIds: updatedList.map((row) => row.id) },
          reason: 'Verifikasi pembayaran oleh pengelola',
          requestId: ctx.requestId,
        });
        return successResponse(
          {
            message: existing.registrationGroupId
              ? `Bukti pembayaran untuk seluruh rombongan (${updatedList.length} orang) berhasil disetujui & tiket telah aktif.`
              : 'Bukti pembayaran berhasil disetujui & tiket telah aktif.',
            attendance: updatedList[0] || existing,
            updatedCount: updatedList.length,
          },
          { requestId: ctx.requestId },
        );
      });
    }),
  );

  // 7c. POST /api/events/:id/attendances/:attendanceId/reject-payment (Reject Payment Proof with Reason)
  router.post(
    '/api/events/:id/attendances/:attendanceId/reject-payment',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;
      const { rejectionReason } = (ctx.body as any) || {};

      if (!ctx.user) {
        return errorResponse(
          'UNAUTHENTICATED',
          'Login diperlukan',
          401,
          ctx.requestId,
        );
      }

      if (!eventId || !attendanceId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan Attendance ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      if (!rejectionReason || !rejectionReason.trim()) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Alasan penolakan pembayaran wajib diisi',
          400,
          ctx.requestId,
        );
      }

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM event_attendance WHERE event_id = ${eventId} FOR UPDATE`,
        );
        const existing = await tx.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.id, attendanceId),
            eq(eventAttendance.eventId, eventId),
          ),
        });

        if (!existing) {
          return errorResponse(
            'NOT_FOUND',
            'Data pendaftaran peserta tidak ditemukan',
            404,
            ctx.requestId,
          );
        }

        let updatedList: any[] = [];
        if (existing.registrationGroupId) {
          updatedList = await tx
            .update(eventAttendance)
            .set({
              paymentStatus: 'rejected',
              paymentVerifiedBy: ctx.user!.id,
              paymentVerifiedAt: new Date(),
              paymentRejectionReason: rejectionReason.trim(),
            })
            .where(
              and(
                eq(eventAttendance.eventId, eventId),
                eq(
                  eventAttendance.registrationGroupId,
                  existing.registrationGroupId,
                ),
              ),
            )
            .returning();
        } else {
          updatedList = await tx
            .update(eventAttendance)
            .set({
              paymentStatus: 'rejected',
              paymentVerifiedBy: ctx.user!.id,
              paymentVerifiedAt: new Date(),
              paymentRejectionReason: rejectionReason.trim(),
            })
            .where(eq(eventAttendance.id, attendanceId))
            .returning();
        }

        await tx.insert(auditLogs).values({
          actorUserId: ctx.user!.id,
          action: 'reject_event_payment',
          entityType: 'event_attendance',
          entityId: attendanceId,
          beforeJson: { paymentStatus: existing.paymentStatus },
          afterJson: { updatedIds: updatedList.map((row) => row.id) },
          reason: rejectionReason.trim(),
          requestId: ctx.requestId,
        });
        return successResponse(
          {
            message: existing.registrationGroupId
              ? `Status pembayaran rombongan (${updatedList.length} orang) berhasil ditolak.`
              : 'Status pembayaran berhasil ditolak.',
            attendance: updatedList[0] || existing,
            updatedCount: updatedList.length,
          },
          { requestId: ctx.requestId },
        );
      });
    }),
  );

  // The public gate remains login-free for field volunteers, but its private
  // URL is protected by an event-specific random token instead of exposing
  // participant data to anyone who guesses an event ID.
  router.get(
    '/api/events/:id/gate-access',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan',
          404,
          ctx.requestId,
        );

      const formConfig = { ...(event.formConfig || {}) } as Record<string, any>;
      const existingToken =
        typeof formConfig.gateAccessToken === 'string'
          ? formConfig.gateAccessToken
          : '';
      const gateAccessToken = existingToken || createStaffRegistrationToken();
      if (!existingToken) {
        formConfig.gateAccessToken = gateAccessToken;
        await db
          .update(events)
          .set({ formConfig, updatedAt: new Date() })
          .where(eq(events.id, eventId));
      }
      return successResponse({ gateAccessToken }, { requestId: ctx.requestId });
    }),
  );

  router.post(
    '/api/events/:id/gate-access',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan',
          404,
          ctx.requestId,
        );

      const formConfig = {
        ...(event.formConfig || {}),
        gateAccessToken: createStaffRegistrationToken(),
      };
      const [updated] = await db
        .update(events)
        .set({ formConfig, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();
      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'rotate_event_gate_access',
        entityType: 'event',
        entityId: eventId,
        afterJson: { rotated: true },
        reason: 'Regenerasi tautan privat gate scanner',
        requestId: ctx.requestId,
      });
      return successResponse(
        { gateAccessToken: (updated?.formConfig as any)?.gateAccessToken },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 7a. PATCH participant contact details. Ticket/QR and attendance fields are intentionally immutable here.
  router.patch(
    '/api/events/:id/attendances/:attendanceId',
    requireEventAccess(
      validateBody(editEventParticipantSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params.id;
        const attendanceId = ctx.params.attendanceId;
        if (!eventId || !attendanceId)
          return errorResponse(
            'VALIDATION_ERROR',
            'Kajian dan peserta diperlukan.',
            400,
            ctx.requestId,
          );

        const attendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.id, attendanceId),
            eq(eventAttendance.eventId, eventId),
          ),
          with: { person: true },
        });
        if (!attendance?.person)
          return errorResponse(
            'NOT_FOUND',
            'Peserta kajian tidak ditemukan.',
            404,
            ctx.requestId,
          );

        const phoneE164 = normalizeIndonesianPhone(body.phone);
        if (!isValidE164(phoneE164))
          return errorResponse(
            'VALIDATION_ERROR',
            'Nomor WhatsApp harus menggunakan format yang valid.',
            400,
            ctx.requestId,
          );

        const phoneOwner = await db.query.persons.findFirst({
          where: eq(persons.phoneE164, phoneE164),
          columns: { id: true, fullName: true },
        });
        if (phoneOwner && phoneOwner.id !== attendance.personId) {
          const sameEvent = await db.query.eventAttendance.findFirst({
            where: and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.personId, phoneOwner.id),
            ),
            columns: { id: true },
          });
          if (sameEvent)
            return errorResponse(
              'CONFLICT',
              `Nomor ini sudah digunakan peserta lain pada kajian ini (${phoneOwner.fullName}).`,
              409,
              ctx.requestId,
            );
        }

        const before = {
          fullName: attendance.person.fullName,
          phoneE164: attendance.person.phoneE164,
          email: attendance.person.email,
          cityRegency: attendance.person.cityRegency,
          ticketCode: attendance.ticketCode,
        };
        const [updatedPerson] = await db
          .update(persons)
          .set({
            fullName: body.fullName,
            phoneE164,
            email: body.email || null,
            cityRegency: body.cityRegency || null,
            updatedAt: new Date(),
          })
          .where(eq(persons.id, attendance.personId))
          .returning();
        if (!updatedPerson)
          return errorResponse(
            'INTERNAL_ERROR',
            'Data peserta tidak berhasil diperbarui.',
            500,
            ctx.requestId,
          );

        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'edit_event_participant_contact',
          entityType: 'event_attendance',
          entityId: attendanceId,
          beforeJson: before,
          afterJson: {
            fullName: updatedPerson.fullName,
            phoneE164: updatedPerson.phoneE164,
            email: updatedPerson.email,
            cityRegency: updatedPerson.cityRegency,
            ticketCode: attendance.ticketCode,
            ticketPreserved: true,
          },
          reason:
            'Perbaikan kontak peserta kajian tanpa mengganti tiket atau QR.',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            message: 'Data peserta diperbarui. Kode tiket dan QR tetap sama.',
            participant: {
              id: attendance.id,
              personId: attendance.personId,
              personName: updatedPerson.fullName,
              personPhone: updatedPerson.phoneE164,
              personEmail: updatedPerson.email,
              personCity: updatedPerson.cityRegency,
              ticketCode: attendance.ticketCode,
            },
          },
          { requestId: ctx.requestId },
        );
      }),
    ),
  );

  // 7d. POST /api/events/:id/attendances/:attendanceId/email-ticket (Resend current e-ticket after data correction)
  router.post(
    '/api/events/:id/attendances/:attendanceId/email-ticket',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;
      if (!eventId || !attendanceId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan data peserta diperlukan.',
          400,
          ctx.requestId,
        );
      }

      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );

      const attendance = await db.query.eventAttendance.findFirst({
        where: and(
          eq(eventAttendance.id, attendanceId),
          eq(eventAttendance.eventId, eventId),
        ),
        with: { person: true },
      });
      if (!attendance)
        return errorResponse(
          'NOT_FOUND',
          'Data pendaftaran peserta tidak ditemukan.',
          404,
          ctx.requestId,
        );
      if (!attendance.person?.email) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Peserta ini belum memiliki alamat email. Perbarui data jamaah terlebih dahulu.',
          400,
          ctx.requestId,
        );
      }

      const groupAttendances = attendance.registrationGroupId
        ? await db.query.eventAttendance.findMany({
            where: and(
              eq(eventAttendance.eventId, eventId),
              eq(
                eventAttendance.registrationGroupId,
                attendance.registrationGroupId,
              ),
            ),
            with: { person: true },
          })
        : [attendance];
      const delivery = await sendEventTicketEmail({
        event,
        attendance,
        groupAttendances,
      });
      if (!delivery.success) {
        return errorResponse(
          'INTERNAL_ERROR',
          delivery.error || 'E-tiket gagal dikirim.',
          502,
          ctx.requestId,
        );
      }

      const previous = attendance.registrationData || {};
      await db
        .update(eventAttendance)
        .set({
          registrationData: {
            ...previous,
            emailNotifications: {
              ...(previous as any).emailNotifications,
              ticketLastSentAt: new Date().toISOString(),
              ticketLastMessageId: delivery.messageId || null,
            },
          },
        })
        .where(eq(eventAttendance.id, attendance.id));

      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'resend_event_ticket_email',
        entityType: 'event_attendance',
        entityId: attendance.id,
        afterJson: {
          eventId,
          recipientEmail: attendance.person.email,
          ticketCode: attendance.ticketCode,
        },
        reason: 'Pengiriman ulang e-tiket kajian dengan detail terbaru',
        requestId: ctx.requestId,
      });

      return successResponse(
        {
          message: `E-tiket terbaru telah dikirim ke ${attendance.person.email}.`,
          messageId: delivery.messageId || null,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 7e. POST /api/events/:id/email-reminder (Manual H-1 delivery, protected by the global daily broadcast limit)
  router.post(
    '/api/events/:id/email-reminder',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan.',
          400,
          ctx.requestId,
        );

      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );

      const result = await dispatchEventReminders(db, event);
      await logAuditEvent({
        actorUserId: ctx.user?.id,
        action: 'send_event_email_reminder',
        entityType: 'event',
        entityId: eventId,
        afterJson: result,
        reason: 'Pengiriman reminder email manual oleh admin',
        requestId: ctx.requestId,
      });

      return successResponse(
        {
          ...result,
          message: result.quotaReached
            ? `Pengiriman dihentikan karena batas broadcast harian. ${result.sent} email berhasil dikirim.`
            : `${result.sent} reminder berhasil dikirim.`,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // 7f. POST /api/events/:id/email-broadcast (Admin-triggered announcement to this event's participant emails only)
  router.post(
    '/api/events/:id/email-broadcast',
    requireEventAccess(
      validateBody(eventBroadcastEmailSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params.id;
        if (!eventId)
          return errorResponse(
            'VALIDATION_ERROR',
            'Event ID diperlukan.',
            400,
            ctx.requestId,
          );
        const event = await db.query.events.findFirst({
          where: eq(events.id, eventId),
        });
        if (!event)
          return errorResponse(
            'NOT_FOUND',
            'Kajian tidak ditemukan.',
            404,
            ctx.requestId,
          );

        // Admin starts the campaign explicitly. The first safe batch is sent now;
        // Netlify continues only this already-approved campaign in later batches.
        const queued = await createQueuedEventBroadcast(db, event, {
          ...body,
          createdBy: ctx.user?.id,
        });
        const result = await processQueuedEventBroadcast(
          db,
          event,
          queued.campaignId,
        );
        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'send_event_email_broadcast',
          entityType: 'event',
          entityId: eventId,
          afterJson: {
            subject: body.subject,
            messageLength: body.message.length,
            ...queued,
            ...result,
          },
          reason: 'Broadcast email manual khusus peserta kajian',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            ...queued,
            ...result,
            message: result.quotaReached
              ? `Antrian ${queued.targetCount} email dibuat. Batch awal mengirim ${result.sent}; sisanya menunggu kuota WIB berikutnya.`
              : `Antrian ${queued.targetCount} email dibuat. Batch awal mengirim ${result.sent} email dan sisanya diproses bertahap.`,
          },
          { requestId: ctx.requestId },
        );
      }),
    ),
  );

  // 7g. GET /api/events/:id/email-broadcasts (Persisted, provider-confirmed broadcast metrics)
  router.get(
    '/api/events/:id/email-broadcasts',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan.',
          400,
          ctx.requestId,
        );
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { id: true },
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );

      const broadcasts = await listQueuedEventBroadcasts(db, eventId).catch(
        () => listEventBroadcastSummaries(db, eventId),
      );
      return successResponse(broadcasts, { requestId: ctx.requestId });
    }),
  );

  // Event-specific count for the current WIB day. This remains separate from
  // the global SMTP quota because other automation may also use that quota.
  router.get(
    '/api/events/:id/email-broadcasts/today',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan.',
          400,
          ctx.requestId,
        );
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { id: true },
      });
      if (!event)
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );

      return successResponse(await getEventBroadcastToday(db, eventId), {
        requestId: ctx.requestId,
      });
    }),
  );

  router.get(
    '/api/events/:id/email-broadcast-templates',
    requireEventAccess(async (ctx) =>
      successResponse(await listEventEmailTemplates(getDb()), {
        requestId: ctx.requestId,
      }),
    ),
  );

  router.post(
    '/api/events/:id/email-broadcast-templates',
    requireEventAccess(
      validateBody(eventBroadcastTemplateSchema, async (ctx, body) => {
        const template = await saveEventEmailTemplate(getDb(), {
          ...body,
          createdBy: ctx.user?.id,
        });
        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'save_event_email_broadcast_template',
          entityType: 'event',
          entityId: ctx.params.id!,
          afterJson: { templateId: template.id, name: template.name },
          requestId: ctx.requestId,
        });
        return successResponse(template, { requestId: ctx.requestId }, 201);
      }),
    ),
  );

  // 7d. POST /api/events/:id/attendances/bulk-checkin (Bulk Check-in / Uncheck-in)
  router.post(
    '/api/events/:id/attendances/bulk-checkin',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceIds = [], status = 'attended' } =
        (ctx.body as any) || {};

      if (
        !eventId ||
        !Array.isArray(attendanceIds) ||
        attendanceIds.length === 0
      ) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID dan daftar Attendance ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      const validStatus = status === 'attended' ? 'attended' : 'registered';

      const updated = await db
        .update(eventAttendance)
        .set({
          status: validStatus,
          checkInAt: validStatus === 'attended' ? new Date() : null,
        })
        .where(
          and(
            eq(eventAttendance.eventId, eventId),
            inArray(eventAttendance.id, attendanceIds),
            validStatus === 'attended'
              ? and(
                  notInArray(eventAttendance.paymentStatus, [
                    ...PENDING_PAYMENT_STATUSES,
                  ]),
                  or(
                    eq(eventAttendance.paymentStatus, 'verified'),
                    sql`NOT EXISTS (SELECT 1 FROM events WHERE id = ${eventId} AND is_paid = true)`,
                    sql`(${eventAttendance.paymentStatus} = 'free' AND ${eventAttendance.registrationData}->>'registrationChannel' IN ('staff_yayasan', 'staff_yayasan_family'))`,
                  ),
                )
              : undefined,
          ),
        )
        .returning();

      return successResponse(
        {
          message: `Berhasil mengubah status ${updated.length} peserta menjadi ${validStatus === 'attended' ? 'Hadir' : 'Terdaftar'}.${attendanceIds.length > updated.length ? ` ${attendanceIds.length - updated.length} peserta dilewati; periksa status pembayaran atau data peserta.` : ''}`,
          updatedCount: updated.length,
          skippedCount: attendanceIds.length - updated.length,
          attendances: updated,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  router.delete(
    '/api/events/:id/attendances/:attendanceId',
    requireEventAccess(async (ctx) => {
      if (
        !z.string().uuid().safeParse(ctx.params.id).success ||
        !z.string().uuid().safeParse(ctx.params.attendanceId).success
      )
        return errorResponse(
          'VALIDATION_ERROR',
          'ID pendaftaran tidak valid.',
          400,
          ctx.requestId,
        );
      try {
        return successResponse(
          await removeRegistrations(
            getDb(),
            ctx.params.id!,
            [ctx.params.attendanceId!],
            ctx.query.deleteGroup === 'true' ||
              (ctx.body as any)?.deleteGroup === true,
            ctx.user!.id,
            ctx.requestId,
          ),
          { requestId: ctx.requestId },
        );
      } catch (error) {
        if (error instanceof RegistrationError)
          return errorResponse(
            error.status === 404 ? 'NOT_FOUND' : 'CONFLICT',
            error.message,
            error.status,
            ctx.requestId,
          );
        throw error;
      }
    }),
  );

  router.post(
    '/api/events/:id/attendances/bulk-delete',
    requireEventAccess(async (ctx) => {
      const parsed = z
        .object({
          attendanceIds: z.array(z.string().uuid()).min(1).max(10000),
          deleteAssociatedGroups: z.boolean().default(false),
        })
        .safeParse(ctx.body);
      if (!parsed.success)
        return errorResponse(
          'VALIDATION_ERROR',
          'Pilih pendaftaran yang valid.',
          400,
          ctx.requestId,
        );
      try {
        return successResponse(
          await removeRegistrations(
            getDb(),
            ctx.params.id!,
            parsed.data.attendanceIds,
            parsed.data.deleteAssociatedGroups,
            ctx.user!.id,
            ctx.requestId,
          ),
          { requestId: ctx.requestId },
        );
      } catch (error) {
        if (error instanceof RegistrationError)
          return errorResponse(
            error.status === 404 ? 'NOT_FOUND' : 'CONFLICT',
            error.message,
            error.status,
            ctx.requestId,
          );
        throw error;
      }
    }),
  );

  // 7f. POST /api/events/:id/attendances/scan (Fast Gate Scanner with Ticket / Phone / ID Verification)
  router.post(
    '/api/events/:id/attendances/scan',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { ticketCode, phoneQuery, attendanceId } = (ctx.body as any) || {};

      if (!eventId) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID diperlukan',
          400,
          ctx.requestId,
        );
      }

      let targetAttendance: any = null;

      if (attendanceId) {
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.id, attendanceId),
            eq(eventAttendance.eventId, eventId),
          ),
          with: { person: true },
        });
      } else if (ticketCode) {
        const rawCode = String(ticketCode).trim();
        const cleanCode = extractTicketCode(rawCode);
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, eventId),
            or(
              eq(eventAttendance.ticketCode, cleanCode),
              eq(eventAttendance.ticketCode, rawCode.toUpperCase()),
              ilike(eventAttendance.ticketCode, `%${rawCode}%`),
            ),
          ),
          with: { person: true },
        });
      } else if (phoneQuery || (ctx.body as any).query) {
        const rawQuery = String(phoneQuery || (ctx.body as any).query).trim();
        const cleanTicket = extractTicketCode(rawQuery);
        const norm = normalizeIndonesianPhone(rawQuery);

        // 1. Try direct ticket code or code substring
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, eventId),
            or(
              eq(eventAttendance.ticketCode, cleanTicket),
              eq(eventAttendance.ticketCode, rawQuery.toUpperCase()),
              ilike(eventAttendance.ticketCode, `%${rawQuery}%`),
            ),
          ),
          with: { person: true },
        });

        // 2. If not found, try person by phone or fullName
        if (!targetAttendance) {
          const candidatePersons = await db.query.persons.findMany({
            where: or(
              inArray(persons.phoneE164, [norm, `+${rawQuery}`, rawQuery]),
              ilike(persons.fullName, `%${rawQuery}%`),
              ilike(persons.phoneE164, `%${rawQuery}%`),
            ),
            columns: { id: true },
            limit: 15,
          });

          const personIds = candidatePersons.map((p) => p.id);
          if (personIds.length > 0) {
            targetAttendance = await db.query.eventAttendance.findFirst({
              where: and(
                eq(eventAttendance.eventId, eventId),
                inArray(eventAttendance.personId, personIds),
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
          ctx.requestId,
        );
      }

      const alreadyCheckedIn = targetAttendance.status === 'attended';
      const paymentError = await checkEventPayment(
        db,
        eventId,
        targetAttendance,
      );
      if (paymentError)
        return errorResponse(
          'INVALID_STATE_TRANSITION',
          paymentError,
          400,
          ctx.requestId,
        );
      const previousCheckInAt = targetAttendance.checkInAt;

      // Update to attended if not already
      let updatedAttendance = targetAttendance;
      if (!alreadyCheckedIn) {
        const [updated] = await db
          .update(eventAttendance)
          .set({ status: 'attended', checkInAt: new Date() })
          .where(eq(eventAttendance.id, targetAttendance.id))
          .returning();
        updatedAttendance = { ...targetAttendance, ...updated };
      }

      return successResponse(
        {
          success: true,
          alreadyCheckedIn,
          previousCheckInAt,
          checkedInNow: !alreadyCheckedIn,
          attendance: {
            id: updatedAttendance.id,
            personId: updatedAttendance.personId,
            personName: updatedAttendance.person?.fullName || 'Anonim',
            personPhone: updatedAttendance.person?.phoneE164 || '-',
            personGender: updatedAttendance.person?.gender || 'ikhwan',
            personCity: updatedAttendance.person?.cityRegency || null,
            ticketCode: updatedAttendance.ticketCode,
            status: 'attended',
            checkInAt: updatedAttendance.checkInAt,
            vehicleType: updatedAttendance.vehicleType,
            vehiclePlateNumber: updatedAttendance.vehiclePlateNumber,
            registrationData: updatedAttendance.registrationData,
          },
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // Staff and CSV channels use the same capacity/payment/identity transaction as public registration.
  router.post(
    '/api/events/:id/participants/manual',
    requireEventAccess(async (ctx) => {
      if (!z.string().uuid().safeParse(ctx.params.id).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'Event ID tidak valid.',
          400,
          ctx.requestId,
        );
      try {
        const result = await registerStaffParticipant(
          getDb(),
          ctx.params.id!,
          ctx.body,
          ctx.user!,
          ctx.requestId,
          { source: 'manual_input' },
        );
        const { attendance, person, event } = result;
        const ticketUrl = `/peserta/${event.id}?ticket=${encodeURIComponent(attendance.ticketCode!)}`;
        const fullTicketUrl = `${process.env.APP_URL || 'https://app.yts.web.id'}${ticketUrl}`;
        const waText = `Assalamu'alaikum ${person.fullName}. Pendaftaran ${event.title} tercatat. Kode tiket: ${attendance.ticketCode}. ${event.isPaid ? 'Pembayaran perlu diverifikasi sebelum check-in. ' : ''}${fullTicketUrl}`;
        return successResponse(
          {
            attendance,
            person,
            ticketCode: attendance.ticketCode,
            ticketUrl,
            fullTicketUrl,
            waText,
            waUrl: `https://wa.me/${person.phoneE164?.replace(/\D/g, '')}?text=${encodeURIComponent(waText)}`,
            isSpecialInvite: Boolean((ctx.body as any)?.isSpecialInvite),
          },
          { requestId: ctx.requestId },
          201,
        );
      } catch (error) {
        if (error instanceof RegistrationError)
          return errorResponse(
            error.status === 409
              ? 'CONFLICT'
              : error.status === 404
                ? 'NOT_FOUND'
                : 'VALIDATION_ERROR',
            error.message,
            error.status,
            ctx.requestId,
          );
        if (isDuplicateEventPhoneError(error))
          return errorResponse(
            'CONFLICT',
            'Nomor WhatsApp ini sudah terdaftar pada kajian ini.',
            409,
            ctx.requestId,
          );
        throw error;
      }
    }),
  );

  router.post(
    '/api/events/:id/import-participants',
    requireEventAccess(async (ctx) => {
      const db = getDb();
      const body = (ctx.body as any) || {};
      if (
        !z.string().uuid().safeParse(ctx.params.id).success ||
        !Array.isArray(body.participants) ||
        !body.participants.length ||
        body.participants.length > 100
      )
        return errorResponse(
          'VALIDATION_ERROR',
          'Pilih event dan kirim 1–100 peserta per batch.',
          400,
          ctx.requestId,
        );
      if (
        !(await db.query.events.findFirst({
          where: eq(events.id, ctx.params.id!),
        }))
      )
        return errorResponse(
          'NOT_FOUND',
          'Kajian tidak ditemukan.',
          404,
          ctx.requestId,
        );
      let importedCount = 0,
        skippedCount = 0;
      const errors: Array<{
        row: number;
        name: string;
        phone: string;
        reason: string;
      }> = [];
      for (const [index, item] of body.participants.entries()) {
        try {
          await registerStaffParticipant(
            db,
            ctx.params.id!,
            item,
            ctx.user!,
            ctx.requestId,
            {
              source: 'csv_import',
              fillMissing: body.updateExistingPerson !== false,
            },
          );
          importedCount++;
        } catch (error) {
          if (
            (error instanceof RegistrationError &&
              /sudah terdaftar/.test(error.message)) ||
            isDuplicateEventPhoneError(error)
          ) {
            skippedCount++;
            continue;
          }
          errors.push({
            row: index + 1,
            name: String(item?.fullName || ''),
            phone: String(item?.phone || ''),
            reason:
              error instanceof RegistrationError
                ? error.message
                : 'Gagal menyimpan baris. Data baris ini dibatalkan; coba kembali.',
          });
        }
      }
      return successResponse(
        {
          totalProcessed: body.participants.length,
          importedCount,
          skippedCount,
          updatedCount: 0,
          errorCount: errors.length,
          errors,
        },
        { requestId: ctx.requestId },
      );
    }),
  );
}
