import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { events, eventAttendance, persons } from '../../db/schema';
import { desc, eq, and, inArray, sql, or, ilike } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';
import { extractTicketCode } from '../../../src/lib/participantTicket';
import { createMemorableTicketCode } from './participantCodes';
import { createStaffRegistrationToken, isSpecialInviteRegistration, isStaffFamilyRegistration, isStaffRegistration } from './registrationChannels';
import { logAuditEvent } from '../../audit/service';
import {
  getPersonsAttendanceStats,
  getSinglePersonAttendanceStats,
} from './attendanceHistory';
import { getEventEmailSettings, sendEventTicketEmail } from './emailNotifications';
import { dispatchEventBroadcast, dispatchEventReminders, listEventBroadcastSummaries } from './reminderDispatch';
import { getBroadcastDailyQuota } from '../../email/broadcastQuota';
import { createQueuedEventBroadcast, listEventEmailTemplates, listQueuedEventBroadcasts, processQueuedEventBroadcast, saveEventEmailTemplate } from './broadcastQueue';

const createEventSchema = z.object({
  title: z.string().min(3, 'Judul kajian minimal 3 karakter'),
  category: z.string().min(2, 'Kategori kajian diperlukan'),
  speaker: z.string().min(3, 'Nama pemateri/ustadz diperlukan'),
  description: z.string().optional().nullable(),
  startAt: z.string().min(1, 'Waktu mulai diperlukan'),
  endAt: z.string().optional().nullable(),
  deliveryMode: z.enum(['offline', 'online', 'hybrid']).default('offline'),
  locationName: z.string().optional().nullable(),
  locationAddress: z.string().max(500, 'Alamat lokasi maksimal 500 karakter').optional().nullable(),
  googleMapsUrl: z.string().url('Tautan Google Maps tidak valid').optional().nullable().or(z.literal('')),
  locationDirections: z.string().max(1000, 'Petunjuk lokasi maksimal 1000 karakter').optional().nullable(),
  showGoogleMaps: z.boolean().default(true),
  meetingUrl: z.string().url('URL tidak valid').optional().nullable().or(z.literal('')),
  
  // Paid Event & Banking Configuration
  isPaid: z.boolean().default(false),
  priceRupiah: z.number().int().min(0).default(0),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  
  // Segmentation & Quota
  targetAudience: z.enum(['umum', 'ikhwan_only', 'akhwat_only', 'anak', 'itikaf_ramadan']).default('umum'),
  minAge: z.number().int().min(1, 'Usia minimal setidaknya 1 tahun').max(120, 'Usia minimal tidak valid').optional().nullable(),
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
  status: z.enum(['scheduled', 'in_progress', 'completed', 'canceled']).optional(),
});

const eventBroadcastEmailSchema = z.object({
  subject: z.string().trim().min(3, 'Subjek email minimal 3 karakter.').max(160, 'Subjek email maksimal 160 karakter.'),
  message: z.string().trim().min(3, 'Isi email minimal 3 karakter.').max(5000, 'Isi email maksimal 5000 karakter.'),
  batchSize: z.number().int().min(25).max(100).optional(),
  templateId: z.string().uuid().optional().nullable(),
});

const eventBroadcastTemplateSchema = z.object({
  name: z.string().trim().min(3, 'Nama template minimal 3 karakter.').max(100),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(5000),
});

export function registerEventsRoutes(router: Router) {
  // 1. GET /api/events (List all events with participant counts, quotas & parking)
  router.get(
    '/api/events',
    requireAuth(async (ctx) => {
      const db = getDb();

      try {
        const eventList = await db.select().from(events).orderBy(desc(events.startAt));

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
            attendanceCount: s.total || 0,
            attendedCount: s.attended || 0,
            registeredCount: s.registered || 0,
            ikhwanCount: g.ikhwan || 0,
            akhwatCount: g.akhwat || 0,
            carsCount: s.cars || 0,
            motorcyclesCount: s.motorcycles || 0,
          };
        });

        return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
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
          const ikhwanCount = atts.filter((a) => a.person?.gender === 'ikhwan').length;
          const akhwatCount = atts.filter((a) => a.person?.gender === 'akhwat').length;
          const carsCount = atts.filter((a) => a.vehicleType === 'car').length;
          const motorcyclesCount = atts.filter((a) => a.vehicleType === 'motorcycle').length;

          return {
            ...e,
            attendanceCount: atts.length,
            attendedCount: atts.filter((a) => a.status === 'attended').length,
            registeredCount: atts.filter((a) => a.status === 'registered').length,
            ikhwanCount,
            akhwatCount,
            carsCount,
            motorcyclesCount,
          };
        });

        return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
      }
    })
  );

  // 2. GET /api/events/:id (Detail event with full participant roster & logistics)
  router.get(
    '/api/events/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
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
        return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
      }

      const adminInviteCode =
        eventItem.formConfig?.adminInviteCode?.trim().toUpperCase() ||
        `UNDANGAN-${eventItem.id.slice(0, 6).toUpperCase()}`;

      const personIds = eventItem.attendances.map((att) => att.personId).filter(Boolean) as string[];
      const attendanceStatsMap = await getPersonsAttendanceStats(db, personIds, eventId);

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
          totalAttendedCount: pStats?.totalAttendedCount ?? (att.status === 'attended' ? 1 : 0),
          pastRegisteredCount: pStats?.pastRegisteredCount ?? 0,
          currentKajianNumber: pStats?.currentKajianNumber ?? 1,
          loyaltyTier: pStats?.loyaltyTier ?? 'perdana',
          loyaltyLabel: pStats?.loyaltyLabel ?? '🌱 Jamaah Baru',
          lastAttendedTitle: pStats?.lastAttendedTitle ?? null,
          lastAttendedDate: pStats?.lastAttendedDate ?? null,

          // Payment Information
          paymentStatus: att.paymentStatus || (eventItem.isPaid ? 'pending_payment' : 'free'),
          paymentProofUrl: att.paymentProofUrl || null,
          paymentAmountRupiah: att.paymentAmountRupiah || (eventItem.isPaid ? eventItem.priceRupiah : 0),
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

      const ikhwanCount = participants.filter((p) => p.personGender === 'ikhwan').length;
      const akhwatCount = participants.filter((p) => p.personGender === 'akhwat').length;
      const carsCount = participants.filter((p) => p.vehicleType === 'car').length;
      const motorcyclesCount = participants.filter((p) => p.vehicleType === 'motorcycle').length;
      const waitingVerificationCount = participants.filter((p) => p.paymentStatus === 'waiting_verification').length;
      const verifiedPaymentCount = participants.filter((p) => p.paymentStatus === 'verified').length;
      const pendingPaymentCount = participants.filter((p) => p.paymentStatus === 'pending_payment').length;
      const specialInviteCount = participants.filter((p) => p.isSpecialInvite).length;
      const specialInviteIkhwanCount = participants.filter((p) => p.isSpecialInvite && p.personGender === 'ikhwan').length;
      const specialInviteAkhwatCount = participants.filter((p) => p.isSpecialInvite && p.personGender === 'akhwat').length;
      const staffCount = participants.filter((p) => p.isStaffRegistration).length;
      const staffIkhwanCount = participants.filter((p) => p.isStaffRegistration && p.personGender === 'ikhwan').length;
      const staffAkhwatCount = participants.filter((p) => p.isStaffRegistration && p.personGender === 'akhwat').length;
      const regularCount = participants.filter((p) => !p.isSpecialInvite && !p.isStaffRegistration).length;
      const regularIkhwanCount = participants.filter((p) => !p.isSpecialInvite && !p.isStaffRegistration && p.personGender === 'ikhwan').length;
      const regularAkhwatCount = participants.filter((p) => !p.isSpecialInvite && !p.isStaffRegistration && p.personGender === 'akhwat').length;
      const firstTimerCount = participants.filter((p) => p.currentKajianNumber <= 1).length;
      const returningCount = participants.filter((p) => p.currentKajianNumber > 1).length;
      const emailRecipientCount = new Set(
        participants
          .map((participant) => participant.personEmail?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email))
      ).size;
      const emailReminderSentCount = participants.filter(
        (participant) => Boolean((participant.registrationData as any)?.emailNotifications?.reminderH1SentAt)
      ).length;
      const emailBroadcastQuota = await getBroadcastDailyQuota(db).catch(() => null);

      return successResponse(
        {
          ...eventItem,
          adminInviteCode,
          participants,
          totalParticipants: participants.length,
          attendedCount: participants.filter((p) => p.status === 'attended').length,
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
        { requestId: ctx.requestId }
      );
    })
  );

  // 3. POST /api/events (Create new event with audience segment, quotas, payment & parking)
  router.post(
    '/api/events',
    requireAuth(
      validateBody(createEventSchema, async (ctx, body) => {
        const db = getDb();
        if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const defaultFormConfig = body.formConfig || {
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
            "Bismillah. Pendaftaran kajian Anda telah terkonfirmasi. Tiket: {{ticket_code}}. Mohon hadir 15 menit sebelum acara dimulai dan menaati tata tertib majelis. Barakallahu fiikum.",
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
            quotaInviteIkhwan: body.quotaInviteIkhwan ? body.quotaInviteIkhwan : null,
            quotaInviteAkhwat: body.quotaInviteAkhwat ? body.quotaInviteAkhwat : null,
            quotaStaff: body.quotaStaff ? body.quotaStaff : null,
            quotaStaffIkhwan: body.quotaStaffIkhwan ? body.quotaStaffIkhwan : null,
            quotaStaffAkhwat: body.quotaStaffAkhwat ? body.quotaStaffAkhwat : null,
            isRegistrationOpen: body.isRegistrationOpen !== false,
            isStaffRegistrationOpen: body.isStaffRegistrationOpen === true,
            staffRegistrationToken: createStaffRegistrationToken(),
            
            carParkingQuota: body.carParkingQuota ? body.carParkingQuota : null,
            motorcycleParkingQuota: body.motorcycleParkingQuota ? body.motorcycleParkingQuota : null,
            venueRules: body.venueRules || [],
            customVenueRules: body.customVenueRules || null,
            
            formConfig: defaultFormConfig,
            createdBy: ctx.user.id,
          })
          .returning();

        return successResponse(created, { requestId: ctx.requestId }, 201);
      })
    )
  );

  // 4. PUT /api/events/:id (Update event, quotas, venue rules, payment & form builder)
  router.put(
    '/api/events/:id',
    requireAuth(
      validateBody(updateEventSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params.id;
        if (!eventId) {
          return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
        }

        const existing = await db.query.events.findFirst({
          where: eq(events.id, eventId),
        });

        if (!existing) {
          return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
        }

        const updatePayload: any = {
          updatedAt: new Date(),
        };

        if (body.title !== undefined) updatePayload.title = body.title;
        if (body.category !== undefined) updatePayload.category = body.category;
        if (body.speaker !== undefined) updatePayload.speaker = body.speaker;
        if (body.description !== undefined) updatePayload.description = body.description;
        if (body.startAt !== undefined) updatePayload.startAt = new Date(body.startAt);
        if (body.endAt !== undefined) updatePayload.endAt = body.endAt ? new Date(body.endAt) : null;
        if (body.deliveryMode !== undefined) updatePayload.deliveryMode = body.deliveryMode;
        if (body.locationName !== undefined) updatePayload.locationName = body.locationName;
        if (body.locationAddress !== undefined) updatePayload.locationAddress = body.locationAddress;
        if (body.googleMapsUrl !== undefined) updatePayload.googleMapsUrl = body.googleMapsUrl || null;
        if (body.locationDirections !== undefined) updatePayload.locationDirections = body.locationDirections;
        if (body.showGoogleMaps !== undefined) updatePayload.showGoogleMaps = body.showGoogleMaps;
        if (body.meetingUrl !== undefined) updatePayload.meetingUrl = body.meetingUrl;
        if (body.status !== undefined) updatePayload.status = body.status;
        
        if (body.isPaid !== undefined) updatePayload.isPaid = body.isPaid;
        if (body.priceRupiah !== undefined) updatePayload.priceRupiah = body.priceRupiah;
        if (body.bankName !== undefined) updatePayload.bankName = body.bankName;
        if (body.bankAccountNumber !== undefined) updatePayload.bankAccountNumber = body.bankAccountNumber;
        if (body.bankAccountName !== undefined) updatePayload.bankAccountName = body.bankAccountName;
        if (body.paymentInstructions !== undefined) updatePayload.paymentInstructions = body.paymentInstructions;

        if (body.targetAudience !== undefined) updatePayload.targetAudience = body.targetAudience;
        if (body.minAge !== undefined) updatePayload.minAge = body.minAge;
        if (body.quota !== undefined) updatePayload.quota = body.quota ? body.quota : null;
        if (body.quotaIkhwan !== undefined) updatePayload.quotaIkhwan = body.quotaIkhwan ? body.quotaIkhwan : null;
        if (body.quotaAkhwat !== undefined) updatePayload.quotaAkhwat = body.quotaAkhwat ? body.quotaAkhwat : null;
        if (body.quotaInvite !== undefined) updatePayload.quotaInvite = body.quotaInvite ? body.quotaInvite : null;
        if (body.quotaInviteIkhwan !== undefined) updatePayload.quotaInviteIkhwan = body.quotaInviteIkhwan ? body.quotaInviteIkhwan : null;
        if (body.quotaInviteAkhwat !== undefined) updatePayload.quotaInviteAkhwat = body.quotaInviteAkhwat ? body.quotaInviteAkhwat : null;
        if (body.quotaStaff !== undefined) updatePayload.quotaStaff = body.quotaStaff ? body.quotaStaff : null;
        if (body.quotaStaffIkhwan !== undefined) updatePayload.quotaStaffIkhwan = body.quotaStaffIkhwan ? body.quotaStaffIkhwan : null;
        if (body.quotaStaffAkhwat !== undefined) updatePayload.quotaStaffAkhwat = body.quotaStaffAkhwat ? body.quotaStaffAkhwat : null;
        if (body.isRegistrationOpen !== undefined) updatePayload.isRegistrationOpen = body.isRegistrationOpen;
        if (body.isStaffRegistrationOpen !== undefined) updatePayload.isStaffRegistrationOpen = body.isStaffRegistrationOpen;
        
        if (body.carParkingQuota !== undefined) updatePayload.carParkingQuota = body.carParkingQuota ? body.carParkingQuota : null;
        if (body.motorcycleParkingQuota !== undefined) updatePayload.motorcycleParkingQuota = body.motorcycleParkingQuota ? body.motorcycleParkingQuota : null;
        if (body.venueRules !== undefined) updatePayload.venueRules = body.venueRules;
        if (body.customVenueRules !== undefined) updatePayload.customVenueRules = body.customVenueRules;
        
        if (body.formConfig !== undefined) updatePayload.formConfig = body.formConfig;

        const [updated] = await db
          .update(events)
          .set(updatePayload)
          .where(eq(events.id, eventId))
          .returning();

        return successResponse(updated, { requestId: ctx.requestId });
      })
    )
  );

  // Regenerating a link immediately invalidates the previous staff-only link.
  router.post(
    '/api/events/:id/staff-registration-token',
    requireAuth(async (ctx) => {
      const eventId = ctx.params.id;
      if (!eventId) return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      const [updated] = await getDb()
        .update(events)
        .set({ staffRegistrationToken: createStaffRegistrationToken(), updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();
      if (!updated) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
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
      return successResponse({ staffRegistrationToken: updated.staffRegistrationToken }, { requestId: ctx.requestId });
    })
  );

  // 5. DELETE /api/events/:id (Delete / cancel event)
  router.delete(
    '/api/events/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      }

      const [deleted] = await db
        .delete(events)
        .where(eq(events.id, eventId))
        .returning();

      if (!deleted) {
        return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
      }

      return successResponse({ message: 'Kajian berhasil dihapus', id: deleted.id }, { requestId: ctx.requestId });
    })
  );

  // 6. POST /api/events/:id/attendance (Check-in by Person ID or QR)
  router.post(
    '/api/events/:id/attendance',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { personId, source, ticketCode } = (ctx.body as any) || {};

      if (!eventId || (!personId && !ticketCode)) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan Person ID / Ticket Code wajib disertakan', 400, ctx.requestId);
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
                eq(eventAttendance.ticketCode, rawCode.toUpperCase())
              )
            ),
          });

          if (attendance) {
            const [updated] = await db
              .update(eventAttendance)
              .set({ status: 'attended', checkInAt: new Date() })
              .where(eq(eventAttendance.id, attendance.id))
              .returning();
            if (!updated) {
              return errorResponse('INTERNAL_ERROR', 'Gagal mencatat presensi', 500, ctx.requestId);
            }
            const pStats = await getSinglePersonAttendanceStats(db, updated.personId, eventId);
            return successResponse(
              {
                ...updated,
                pastAttendedCount: pStats.pastAttendedCount,
                totalAttendedCount: pStats.pastAttendedCount + 1,
                currentKajianNumber: pStats.currentKajianNumber,
                loyaltyTier: pStats.loyaltyTier,
                loyaltyLabel: pStats.loyaltyLabel,
              },
              { requestId: ctx.requestId }
            );
          }
        }

        if (personId) {
          const insertQuery = db
            .insert(eventAttendance)
            .values({
              eventId,
              personId,
              source: source || 'manual_input',
              status: 'attended',
              checkInAt: new Date(),
            });

          const onConflict = typeof (insertQuery as any).onConflictDoNothing === 'function'
            ? (insertQuery as any).onConflictDoNothing()
            : insertQuery;

          const [attendance] = await onConflict.returning();
          const targetPid = attendance ? attendance.personId : personId;
          const pStats = await getSinglePersonAttendanceStats(db, targetPid, eventId);

          return successResponse(
            {
              ...(attendance || { status: 'attended', message: 'Jamaah sudah tercatat hadir' }),
              pastAttendedCount: pStats.pastAttendedCount,
              totalAttendedCount: pStats.pastAttendedCount + 1,
              currentKajianNumber: pStats.currentKajianNumber,
              loyaltyTier: pStats.loyaltyTier,
              loyaltyLabel: pStats.loyaltyLabel,
            },
            { requestId: ctx.requestId }
          );
        }

        return errorResponse('NOT_FOUND', 'Data kehadiran tidak ditemukan', 404, ctx.requestId);
      } catch (err: any) {
        return errorResponse('INTERNAL_ERROR', 'Gagal mencatat presensi', 500, ctx.requestId);
      }
    })
  );

  // 7. POST /api/events/:id/toggle-attendance (Toggle attended / registered status)
  router.post(
    '/api/events/:id/toggle-attendance',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceId } = (ctx.body as any) || {};

      if (!eventId || !attendanceId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan Attendance ID diperlukan', 400, ctx.requestId);
      }

      const existing = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
      });

      if (!existing) {
        return errorResponse('NOT_FOUND', 'Data kehadiran tidak ditemukan', 404, ctx.requestId);
      }

      const newStatus = existing.status === 'attended' ? 'registered' : 'attended';

      const [updated] = await db
        .update(eventAttendance)
        .set({ status: newStatus })
        .where(eq(eventAttendance.id, attendanceId))
        .returning();

      if (!updated) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui status presensi', 500, ctx.requestId);
      }

      const pStats = await getSinglePersonAttendanceStats(db, updated.personId, eventId);

      return successResponse(
        {
          ...updated,
          pastAttendedCount: pStats.pastAttendedCount,
          totalAttendedCount: newStatus === 'attended' ? pStats.pastAttendedCount + 1 : pStats.pastAttendedCount,
          currentKajianNumber: pStats.currentKajianNumber,
          loyaltyTier: pStats.loyaltyTier,
          loyaltyLabel: pStats.loyaltyLabel,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7b. POST /api/events/:id/attendances/:attendanceId/verify-payment (Verify/Approve Payment by Admin/Finance)
  router.post(
    '/api/events/:id/attendances/:attendanceId/verify-payment',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;

      if (!ctx.user) {
        return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
      }

      if (!eventId || !attendanceId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan Attendance ID diperlukan', 400, ctx.requestId);
      }

      const existing = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
      });

      if (!existing) {
        return errorResponse('NOT_FOUND', 'Data pendaftaran peserta tidak ditemukan', 404, ctx.requestId);
      }

      let updatedList: any[] = [];
      if (existing.registrationGroupId) {
        updatedList = await db
          .update(eventAttendance)
          .set({
            paymentStatus: 'verified',
            paymentVerifiedBy: ctx.user.id,
            paymentVerifiedAt: new Date(),
            paymentRejectionReason: null,
            status: 'registered',
          })
          .where(
            and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.registrationGroupId, existing.registrationGroupId)
            )
          )
          .returning();
      } else {
        updatedList = await db
          .update(eventAttendance)
          .set({
            paymentStatus: 'verified',
            paymentVerifiedBy: ctx.user.id,
            paymentVerifiedAt: new Date(),
            paymentRejectionReason: null,
            status: 'registered',
          })
          .where(eq(eventAttendance.id, attendanceId))
          .returning();
      }

      return successResponse(
        {
          message: existing.registrationGroupId
            ? `Bukti pembayaran untuk seluruh rombongan (${updatedList.length} orang) berhasil disetujui & tiket telah aktif.`
            : 'Bukti pembayaran berhasil disetujui & tiket telah aktif.',
          attendance: updatedList[0] || existing,
          updatedCount: updatedList.length,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7c. POST /api/events/:id/attendances/:attendanceId/reject-payment (Reject Payment Proof with Reason)
  router.post(
    '/api/events/:id/attendances/:attendanceId/reject-payment',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;
      const { rejectionReason } = (ctx.body as any) || {};

      if (!ctx.user) {
        return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
      }

      if (!eventId || !attendanceId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan Attendance ID diperlukan', 400, ctx.requestId);
      }

      if (!rejectionReason || !rejectionReason.trim()) {
        return errorResponse('VALIDATION_ERROR', 'Alasan penolakan pembayaran wajib diisi', 400, ctx.requestId);
      }

      const existing = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
      });

      if (!existing) {
        return errorResponse('NOT_FOUND', 'Data pendaftaran peserta tidak ditemukan', 404, ctx.requestId);
      }

      let updatedList: any[] = [];
      if (existing.registrationGroupId) {
        updatedList = await db
          .update(eventAttendance)
          .set({
            paymentStatus: 'rejected',
            paymentVerifiedBy: ctx.user.id,
            paymentVerifiedAt: new Date(),
            paymentRejectionReason: rejectionReason.trim(),
          })
          .where(
            and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.registrationGroupId, existing.registrationGroupId)
            )
          )
          .returning();
      } else {
        updatedList = await db
          .update(eventAttendance)
          .set({
            paymentStatus: 'rejected',
            paymentVerifiedBy: ctx.user.id,
            paymentVerifiedAt: new Date(),
            paymentRejectionReason: rejectionReason.trim(),
          })
          .where(eq(eventAttendance.id, attendanceId))
          .returning();
      }

      return successResponse(
        {
          message: existing.registrationGroupId
            ? `Status pembayaran rombongan (${updatedList.length} orang) berhasil ditolak.`
            : 'Status pembayaran berhasil ditolak.',
          attendance: updatedList[0] || existing,
          updatedCount: updatedList.length,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7d. POST /api/events/:id/attendances/:attendanceId/email-ticket (Resend current e-ticket after data correction)
  router.post(
    '/api/events/:id/attendances/:attendanceId/email-ticket',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;
      if (!eventId || !attendanceId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan data peserta diperlukan.', 400, ctx.requestId);
      }

      const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
      if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

      const attendance = await db.query.eventAttendance.findFirst({
        where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
        with: { person: true },
      });
      if (!attendance) return errorResponse('NOT_FOUND', 'Data pendaftaran peserta tidak ditemukan.', 404, ctx.requestId);
      if (!attendance.person?.email) {
        return errorResponse('VALIDATION_ERROR', 'Peserta ini belum memiliki alamat email. Perbarui data jamaah terlebih dahulu.', 400, ctx.requestId);
      }

      const groupAttendances = attendance.registrationGroupId
        ? await db.query.eventAttendance.findMany({
            where: and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.registrationGroupId, attendance.registrationGroupId)
            ),
            with: { person: true },
          })
        : [attendance];
      const delivery = await sendEventTicketEmail({ event, attendance, groupAttendances });
      if (!delivery.success) {
        return errorResponse('INTERNAL_ERROR', delivery.error || 'E-tiket gagal dikirim.', 502, ctx.requestId);
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
        afterJson: { eventId, recipientEmail: attendance.person.email, ticketCode: attendance.ticketCode },
        reason: 'Pengiriman ulang e-tiket kajian dengan detail terbaru',
        requestId: ctx.requestId,
      });

      return successResponse(
        { message: `E-tiket terbaru telah dikirim ke ${attendance.person.email}.`, messageId: delivery.messageId || null },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7e. POST /api/events/:id/email-reminder (Manual H-1 delivery, protected by the global daily broadcast limit)
  router.post(
    '/api/events/:id/email-reminder',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);

      const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
      if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

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
        { requestId: ctx.requestId }
      );
    })
  );

  // 7f. POST /api/events/:id/email-broadcast (Admin-triggered announcement to this event's participant emails only)
  router.post(
    '/api/events/:id/email-broadcast',
    requireAuth(
      validateBody(eventBroadcastEmailSchema, async (ctx, body) => {
        const db = getDb();
        const eventId = ctx.params.id;
        if (!eventId) return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
        const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
        if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

        // Admin starts the campaign explicitly. The first safe batch is sent now;
        // Netlify continues only this already-approved campaign in later batches.
        const queued = await createQueuedEventBroadcast(db, event, { ...body, createdBy: ctx.user?.id });
        const result = await processQueuedEventBroadcast(db, event, queued.campaignId);
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

        return successResponse({
          ...queued,
          ...result,
          message: result.quotaReached
            ? `Antrian ${queued.targetCount} email dibuat. Batch awal mengirim ${result.sent}; sisanya menunggu kuota WIB berikutnya.`
            : `Antrian ${queued.targetCount} email dibuat. Batch awal mengirim ${result.sent} email dan sisanya diproses bertahap.`,
        }, { requestId: ctx.requestId });
      })
    )
  );

  // 7g. GET /api/events/:id/email-broadcasts (Persisted, provider-confirmed broadcast metrics)
  router.get(
    '/api/events/:id/email-broadcasts',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      if (!eventId) return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan.', 400, ctx.requestId);
      const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true } });
      if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan.', 404, ctx.requestId);

      const broadcasts = await listQueuedEventBroadcasts(db, eventId).catch(() => listEventBroadcastSummaries(db, eventId));
      return successResponse(broadcasts, { requestId: ctx.requestId });
    })
  );

  router.get(
    '/api/events/:id/email-broadcast-templates',
    requireAuth(async (ctx) => successResponse(await listEventEmailTemplates(getDb()), { requestId: ctx.requestId }))
  );

  router.post(
    '/api/events/:id/email-broadcast-templates',
    requireAuth(validateBody(eventBroadcastTemplateSchema, async (ctx, body) => {
      const template = await saveEventEmailTemplate(getDb(), { ...body, createdBy: ctx.user?.id });
      await logAuditEvent({ actorUserId: ctx.user?.id, action: 'save_event_email_broadcast_template', entityType: 'event', entityId: ctx.params.id, afterJson: { templateId: template.id, name: template.name }, requestId: ctx.requestId });
      return successResponse(template, { requestId: ctx.requestId }, 201);
    }))
  );

  // 7d. POST /api/events/:id/attendances/bulk-checkin (Bulk Check-in / Uncheck-in)
  router.post(
    '/api/events/:id/attendances/bulk-checkin',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceIds = [], status = 'attended' } = (ctx.body as any) || {};

      if (!eventId || !Array.isArray(attendanceIds) || attendanceIds.length === 0) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan daftar Attendance ID diperlukan', 400, ctx.requestId);
      }

      const validStatus = status === 'attended' ? 'attended' : 'registered';

      const updated = await db
        .update(eventAttendance)
        .set({
          status: validStatus,
          checkInAt: validStatus === 'attended' ? new Date() : undefined,
        })
        .where(
          and(
            eq(eventAttendance.eventId, eventId),
            inArray(eventAttendance.id, attendanceIds)
          )
        )
        .returning();

      return successResponse(
        {
          message: `Berhasil mengubah status ${updated.length} peserta menjadi ${validStatus === 'attended' ? 'Hadir' : 'Terdaftar'}.`,
          updatedCount: updated.length,
          attendances: updated,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7e-1. DELETE /api/events/:id/attendances/:attendanceId (Remove Single Registrant & Restore Quota)
  router.delete(
    '/api/events/:id/attendances/:attendanceId',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const attendanceId = ctx.params.attendanceId;
      const deleteGroup = ctx.query.deleteGroup === 'true' || (ctx.body as any)?.deleteGroup === true;

      if (!eventId || !attendanceId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan Attendance ID diperlukan', 400, ctx.requestId);
      }

      const existing = await db.query.eventAttendance.findFirst({
        where: and(
          eq(eventAttendance.id, attendanceId),
          eq(eventAttendance.eventId, eventId)
        ),
        with: {
          person: true,
        },
      });

      if (!existing) {
        return errorResponse('NOT_FOUND', 'Data pendaftaran peserta tidak ditemukan', 404, ctx.requestId);
      }

      let deleted: any[] = [];
      const hasGroup = Boolean(existing.registrationGroupId);

      if (deleteGroup && existing.registrationGroupId) {
        deleted = await db
          .delete(eventAttendance)
          .where(
            and(
              eq(eventAttendance.eventId, eventId),
              eq(eventAttendance.registrationGroupId, existing.registrationGroupId)
            )
          )
          .returning();
      } else {
        deleted = await db
          .delete(eventAttendance)
          .where(
            and(
              eq(eventAttendance.id, attendanceId),
              eq(eventAttendance.eventId, eventId)
            )
          )
          .returning();
      }

      try {
        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'delete_event_attendance',
          entityType: 'event_attendance',
          entityId: attendanceId,
          beforeJson: {
            eventId,
            personName: existing.person?.fullName,
            ticketCode: existing.ticketCode,
            registrationGroupId: existing.registrationGroupId,
            deletedCount: deleted.length,
            deleteGroupApplied: deleteGroup && hasGroup,
          },
          reason: 'Pembersihan data pendaftar/uji coba untuk mengembalikan kuota kajian',
          requestId: ctx.requestId,
        });
      } catch (e) {
        console.error('Gagal mencatat audit log delete_event_attendance:', e);
      }

      return successResponse(
        {
          message: `Berhasil menghapus ${deleted.length} pendaftaran peserta. Kuota kajian telah dikembalikan.`,
          deletedCount: deleted.length,
          freedQuota: deleted.length,
          ticketCode: existing.ticketCode,
          personName: existing.person?.fullName || 'Peserta',
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7e-2. POST /api/events/:id/attendances/bulk-delete (Bulk Remove Attendances & Restore Quota)
  router.post(
    '/api/events/:id/attendances/bulk-delete',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceIds = [], deleteAssociatedGroups = false } = (ctx.body as any) || {};

      if (!eventId || !Array.isArray(attendanceIds) || attendanceIds.length === 0) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan daftar Attendance ID diperlukan', 400, ctx.requestId);
      }

      let targetIds = [...attendanceIds];

      if (deleteAssociatedGroups) {
        // Cari seluruh registrationGroupId dari attendanceIds yang dipilih
        const selectedAtts = await db.query.eventAttendance.findMany({
          where: and(
            eq(eventAttendance.eventId, eventId),
            inArray(eventAttendance.id, attendanceIds)
          ),
          columns: {
            id: true,
            registrationGroupId: true,
          },
        });

        const groupIds = selectedAtts
          .map((a) => a.registrationGroupId)
          .filter((gid): gid is string => Boolean(gid));

        if (groupIds.length > 0) {
          const allGroupMembers = await db.query.eventAttendance.findMany({
            where: and(
              eq(eventAttendance.eventId, eventId),
              inArray(eventAttendance.registrationGroupId, groupIds)
            ),
            columns: {
              id: true,
            },
          });

          const groupMemberIds = allGroupMembers.map((m) => m.id);
          targetIds = Array.from(new Set([...targetIds, ...groupMemberIds]));
        }
      }

      const deleted = await db
        .delete(eventAttendance)
        .where(
          and(
            eq(eventAttendance.eventId, eventId),
            inArray(eventAttendance.id, targetIds)
          )
        )
        .returning();

      try {
        await logAuditEvent({
          actorUserId: ctx.user?.id,
          action: 'bulk_delete_event_attendances',
          entityType: 'event_attendance',
          beforeJson: {
            eventId,
            deletedAttendanceIds: targetIds,
            deletedCount: deleted.length,
            deleteAssociatedGroups,
          },
          reason: 'Pembersihan massal pendaftar untuk mengembalikan kuota kajian',
          requestId: ctx.requestId,
        });
      } catch (e) {
        console.error('Gagal mencatat audit log bulk_delete_event_attendances:', e);
      }

      return successResponse(
        {
          message: `Berhasil menghapus ${deleted.length} pendaftaran peserta. Kuota kajian telah dikembalikan.`,
          deletedCount: deleted.length,
          freedQuota: deleted.length,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7f. POST /api/events/:id/attendances/scan (Fast Gate Scanner with Ticket / Phone / ID Verification)
  router.post(
    '/api/events/:id/attendances/scan',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { ticketCode, phoneQuery, attendanceId } = (ctx.body as any) || {};

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      }

      let targetAttendance: any = null;

      if (attendanceId) {
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(eq(eventAttendance.id, attendanceId), eq(eventAttendance.eventId, eventId)),
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
              ilike(eventAttendance.ticketCode, `%${rawCode}%`)
            )
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
              ilike(eventAttendance.ticketCode, `%${rawQuery}%`)
            )
          ),
          with: { person: true },
        });

        // 2. If not found, try person by phone or fullName
        if (!targetAttendance) {
          const candidatePersons = await db.query.persons.findMany({
            where: or(
              inArray(persons.phoneE164, [norm, `+${rawQuery}`, rawQuery]),
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
        { requestId: ctx.requestId }
      );
    })
  );

  // 8. POST /api/events/:id/participants/manual (Manually add participant by staff with invite support & wa.me)
  router.post(
    '/api/events/:id/participants/manual',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const {
        fullName,
        phone,
        gender,
        cityRegency,
        email,
        age,
        vehicleType,
        vehiclePlateNumber,
        isSpecialInvite = false,
        inviteNotes,
      } = (ctx.body as any) || {};

      if (!eventId || !fullName || !phone) {
        return errorResponse('VALIDATION_ERROR', 'Event ID, nama lengkap, dan nomor telepon wajib diisi', 400, ctx.requestId);
      }

      const targetEvent = await db.query.events.findFirst({
        where: eq(events.id, eventId),
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

      if (!targetEvent) {
        return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);
      }

      const atts = targetEvent.attendances || [];
      const regGender = gender || 'ikhwan';

      if (isSpecialInvite) {
        const currentInviteAtts = atts.filter(
          (a) =>
            (a.registrationData as any)?.isSpecialInvite === true ||
            (a.registrationData as any)?.inviteSource === 'admin_invite' ||
            (a.registrationData as any)?.inviteSource === 'admin_dashboard' ||
            Boolean(a.referredByAttendanceId)
        );
        const currentInviteIkhwan = currentInviteAtts.filter((a) => a.person?.gender === 'ikhwan').length;
        const currentInviteAkhwat = currentInviteAtts.filter((a) => a.person?.gender === 'akhwat').length;

        if (regGender === 'ikhwan' && targetEvent.quotaInviteIkhwan && currentInviteIkhwan >= targetEvent.quotaInviteIkhwan) {
          return errorResponse('VALIDATION_ERROR', `Kuota jalur undangan khusus Ikhwan telah penuh (${currentInviteIkhwan}/${targetEvent.quotaInviteIkhwan}).`, 400, ctx.requestId);
        }
        if (regGender === 'akhwat' && targetEvent.quotaInviteAkhwat && currentInviteAkhwat >= targetEvent.quotaInviteAkhwat) {
          return errorResponse('VALIDATION_ERROR', `Kuota jalur undangan khusus Akhwat telah penuh (${currentInviteAkhwat}/${targetEvent.quotaInviteAkhwat}).`, 400, ctx.requestId);
        }
        if (targetEvent.quotaInvite && currentInviteAtts.length >= targetEvent.quotaInvite) {
          return errorResponse('VALIDATION_ERROR', `Kuota keseluruhan jalur undangan telah penuh (${currentInviteAtts.length}/${targetEvent.quotaInvite}).`, 400, ctx.requestId);
        }
      } else {
        const currentRegAtts = atts.filter(
          (a) =>
            !(
              (a.registrationData as any)?.isSpecialInvite === true ||
              (a.registrationData as any)?.inviteSource === 'admin_invite' ||
              (a.registrationData as any)?.inviteSource === 'admin_dashboard' ||
              Boolean(a.referredByAttendanceId)
            )
        );
        const currentRegIkhwan = currentRegAtts.filter((a) => a.person?.gender === 'ikhwan').length;
        const currentRegAkhwat = currentRegAtts.filter((a) => a.person?.gender === 'akhwat').length;

        if (regGender === 'ikhwan' && targetEvent.quotaIkhwan && currentRegIkhwan >= targetEvent.quotaIkhwan) {
          return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran reguler khusus Ikhwan telah penuh (${currentRegIkhwan}/${targetEvent.quotaIkhwan}).`, 400, ctx.requestId);
        }
        if (regGender === 'akhwat' && targetEvent.quotaAkhwat && currentRegAkhwat >= targetEvent.quotaAkhwat) {
          return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran reguler khusus Akhwat telah penuh (${currentRegAkhwat}/${targetEvent.quotaAkhwat}).`, 400, ctx.requestId);
        }
        if (targetEvent.quota && currentRegAtts.length >= targetEvent.quota) {
          return errorResponse('VALIDATION_ERROR', `Kuota pendaftaran reguler telah penuh (${currentRegAtts.length}/${targetEvent.quota}).`, 400, ctx.requestId);
        }
      }

      const phoneNorm = normalizeIndonesianPhone(phone);

      let person = await db.query.persons.findFirst({
        where: eq(persons.phoneE164, phoneNorm),
      });

      if (!person) {
        const [newPerson] = await db
          .insert(persons)
          .values({
            fullName,
            phoneE164: phoneNorm,
            gender: regGender,
            cityRegency: cityRegency || null,
            email: email || null,
            sourceCode: isSpecialInvite ? 'admin_dashboard_invite' : 'manual_staff_event',
          })
          .returning();
        person = newPerson;
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data jamaah', 500, ctx.requestId);
      }

      const ticketCode = createMemorableTicketCode();

      const insertQuery = db
        .insert(eventAttendance)
        .values({
          eventId,
          personId: person.id,
          source: 'manual_input',
          status: 'registered',
          ticketCode,
          age: age ? Number(age) : null,
          vehicleType: vehicleType || 'none',
          vehiclePlateNumber: vehiclePlateNumber || null,
          registrationData: {
            ...(isSpecialInvite
              ? {
                  isSpecialInvite: true,
                  inviteSource: 'admin_dashboard',
                  inviteNotes: inviteNotes || null,
                }
              : {}),
            registeredByAdmin: ctx.user?.email || 'admin',
            addedVia: 'admin_dashboard_manual',
          },
        });

      const onConflict = typeof (insertQuery as any).onConflictDoNothing === 'function'
        ? (insertQuery as any).onConflictDoNothing()
        : insertQuery;

      const [attendance] = await onConflict.returning();

      const cleanPhone = phoneNorm.replace(/\+/g, '');
      const eventTitle = targetEvent.title || 'Kajian Sunnah';
      const speaker = targetEvent.speaker || 'Pemateri';
      const startAtFormatted = targetEvent.startAt
        ? new Date(targetEvent.startAt).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const locationName = targetEvent.locationName || 'Masjid Tarbiyah Sunnah';
      const ticketUrl = `/peserta/${eventId}?ticket=${encodeURIComponent(ticketCode)}`;
      const fullTicketUrl = `${process.env.APP_URL || 'https://tarbiyahsunnah.or.id'}${ticketUrl}`;
      const waText = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nKepada Yth. Bapak/Ibu/Asatidzah *${fullName}*,\n\nAhlan wa Sahlan. Pendaftaran antum/anda sebagai *${isSpecialInvite ? 'Tamu Undangan Khusus (VIP)' : 'Peserta'}* telah terkonfirmasi resmi:\n\n📖 *${eventTitle}*\n🎙️ Pemateri: *${speaker}*\n🗓️ Waktu: *${startAtFormatted}*\n📍 Tempat: *${locationName}*\n\n🎫 *KODE E-TIKET PRESENSI:* *${ticketCode}*\n\nSilakan buka tautan berikut untuk melihat E-Tiket & QR Code kehadiran Anda:\n👉 ${fullTicketUrl}\n\nTunjukkan QR Code tersebut kepada petugas di pintu gerbang kedatangan.\n\nJazakumullahu khairan wa barakallahu fiikum.\n— Panitia Yayasan Tarbiyah Sunnah`;
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;

      return successResponse(
        {
          attendance,
          person,
          ticketCode,
          ticketUrl,
          fullTicketUrl,
          waText,
          waUrl,
          isSpecialInvite: Boolean(isSpecialInvite),
        },
        { requestId: ctx.requestId },
        201
      );
    })
  );

  // 9. POST /api/events/:id/import-participants (Bulk import participants with duplicate skip feature)
  router.post(
    '/api/events/:id/import-participants',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const body = (ctx.body as any) || {};
      const { participants = [], skipDuplicates = true, updateExistingPerson = true } = body;

      if (!eventId) {
        return errorResponse('VALIDATION_ERROR', 'Event ID diperlukan', 400, ctx.requestId);
      }

      if (!Array.isArray(participants) || participants.length === 0) {
        return errorResponse('VALIDATION_ERROR', 'Daftar peserta tidak boleh kosong', 400, ctx.requestId);
      }

      const eventItem = await db.query.events.findFirst({
        where: eq(events.id, eventId),
      });

      if (!eventItem) {
        return errorResponse('NOT_FOUND', 'Kajian / Event tidak ditemukan', 404, ctx.requestId);
      }

      // Fetch all existing attendances for this event to detect duplicates quickly
      const existingAttendances = await db.query.eventAttendance.findMany({
        where: eq(eventAttendance.eventId, eventId),
        columns: {
          id: true,
          personId: true,
          ticketCode: true,
        },
      });

      const existingPersonIdMap = new Map<string, string>();
      existingAttendances.forEach((att) => {
        existingPersonIdMap.set(att.personId, att.id);
      });

      // Pre-fetch all existing persons matching normalized phones in this batch
      const phoneNormMap = new Map<string, string>();
      participants.forEach((p: any) => {
        const raw = String(p.phone || '').trim();
        if (raw) {
          const norm = normalizeIndonesianPhone(raw);
          if (norm) phoneNormMap.set(norm, norm);
        }
      });

      const allPhoneNorms = Array.from(phoneNormMap.keys());
      const existingPersonsList =
        allPhoneNorms.length > 0
          ? await db.query.persons.findMany({
              where: inArray(persons.phoneE164, allPhoneNorms),
            })
          : [];

      const personByPhoneMap = new Map<string, any>();
      existingPersonsList.forEach((p) => {
        if (p.phoneE164) {
          personByPhoneMap.set(p.phoneE164, p);
        }
      });

      let importedCount = 0;
      let skippedCount = 0;
      let updatedCount = 0;
      const errors: Array<{ row: number; name: string; phone: string; reason: string }> = [];

      for (let i = 0; i < participants.length; i++) {
        const item = participants[i];
        const rowNum = i + 1;
        const fullName = String(item.fullName || '').trim();
        const rawPhone = String(item.phone || '').trim();

        if (!fullName || !rawPhone) {
          errors.push({
            row: rowNum,
            name: fullName || '(Kosong)',
            phone: rawPhone || '(Kosong)',
            reason: 'Nama lengkap dan nomor telepon wajib diisi',
          });
          continue;
        }

        try {
          const phoneNorm = normalizeIndonesianPhone(rawPhone);

          // Find or create Person
          let person = personByPhoneMap.get(phoneNorm);

          if (!person) {
            const [newPerson] = await db
              .insert(persons)
              .values({
                fullName,
                phoneE164: phoneNorm,
                gender: item.gender === 'akhwat' ? 'akhwat' : 'ikhwan',
                email: item.email ? String(item.email).trim().toLowerCase() : null,
                province: item.province ? String(item.province).trim() : null,
                cityRegency: item.city ? String(item.city).trim() : null,
                district: item.district ? String(item.district).trim() : null,
                sourceCode: 'csv_import',
                engagementStatus: 'baru',
                donorStage: 'new_lead',
              })
              .returning();
            person = newPerson;
            if (person && person.phoneE164) {
              personByPhoneMap.set(person.phoneE164, person);
            }
          } else if (updateExistingPerson) {
            // Update missing profile info if existing
            const updates: Record<string, any> = {};
            if (!person.cityRegency && item.city) updates.cityRegency = String(item.city).trim();
            if (!person.province && item.province) updates.province = String(item.province).trim();
            if (!person.district && item.district) updates.district = String(item.district).trim();
            if (!person.email && item.email) updates.email = String(item.email).trim().toLowerCase();
            if (!person.gender && item.gender) updates.gender = item.gender === 'akhwat' ? 'akhwat' : 'ikhwan';

            if (Object.keys(updates).length > 0) {
              await db.update(persons).set(updates).where(eq(persons.id, person.id));
              Object.assign(person, updates);
            }
          }

          if (!person) {
            errors.push({
              row: rowNum,
              name: fullName,
              phone: rawPhone,
              reason: 'Gagal membuat profil jamaah di database',
            });
            continue;
          }

          // Check duplicate in event
          const existingAttendanceId = existingPersonIdMap.get(person.id);

          if (existingAttendanceId) {
            if (skipDuplicates) {
              skippedCount++;
              continue;
            } else {
              // Update existing attendance
              await db
                .update(eventAttendance)
                .set({
                  status: item.status === 'attended' ? 'attended' : 'registered',
                  ticketCode: item.ticketCode || undefined,
                  vehicleType: item.vehicleType || 'none',
                  vehiclePlateNumber: item.vehiclePlateNumber || null,
                  registrationData: item.registrationData || null,
                })
                .where(eq(eventAttendance.id, existingAttendanceId));
              updatedCount++;
              continue;
            }
          }

          // Generate ticket code if not provided
          const ticketCode = item.ticketCode ? extractTicketCode(item.ticketCode) : createMemorableTicketCode();

          await db.insert(eventAttendance).values({
            eventId,
            personId: person.id,
            source: 'csv_import',
            status: item.status === 'attended' ? 'attended' : 'registered',
            ticketCode,
            vehicleType: item.vehicleType || 'none',
            vehiclePlateNumber: item.vehiclePlateNumber || null,
            registrationData: item.registrationData || null,
          });

          // Auto-upgrade engagement status to active if joining events
          if (person.engagementStatus === 'baru') {
            await db
              .update(persons)
              .set({ engagementStatus: 'aktif', updatedAt: new Date() })
              .where(eq(persons.id, person.id));
            person.engagementStatus = 'aktif';
          }

          existingPersonIdMap.set(person.id, ticketCode);
          importedCount++;
        } catch (err: any) {
          console.error(`[Import CSV Error Row ${rowNum}]:`, err);
          errors.push({
            row: rowNum,
            name: fullName,
            phone: rawPhone,
            reason: err.message || 'Terjadi kesalahan sistem',
          });
        }
      }

      return successResponse(
        {
          totalProcessed: participants.length,
          importedCount,
          skippedCount,
          updatedCount,
          errorCount: errors.length,
          errors: errors.slice(0, 50), // Return sample of errors
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
