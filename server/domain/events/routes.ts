import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { events, eventAttendance, persons } from '../../db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../../lib/phone';

const createEventSchema = z.object({
  title: z.string().min(3, 'Judul kajian minimal 3 karakter'),
  category: z.string().min(2, 'Kategori kajian diperlukan'),
  speaker: z.string().min(3, 'Nama pemateri/ustadz diperlukan'),
  description: z.string().optional().nullable(),
  startAt: z.string().min(1, 'Waktu mulai diperlukan'),
  endAt: z.string().optional().nullable(),
  deliveryMode: z.enum(['offline', 'online', 'hybrid']).default('offline'),
  locationName: z.string().optional().nullable(),
  meetingUrl: z.string().url('URL tidak valid').optional().nullable().or(z.literal('')),
  
  // Segmentation & Quota
  targetAudience: z.enum(['umum', 'ikhwan_only', 'akhwat_only', 'anak', 'itikaf_ramadan']).default('umum'),
  quota: z.number().int().positive().optional().nullable(),
  quotaIkhwan: z.number().int().positive().optional().nullable(),
  quotaAkhwat: z.number().int().positive().optional().nullable(),
  isRegistrationOpen: z.boolean().default(true),
  
  // Logistics & Rules
  carParkingQuota: z.number().int().positive().optional().nullable(),
  motorcycleParkingQuota: z.number().int().positive().optional().nullable(),
  venueRules: z.array(z.string()).optional().nullable(),
  customVenueRules: z.string().optional().nullable(),
  
  formConfig: z.record(z.any()).optional().nullable(),
});

const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'canceled']).optional(),
});

export function registerEventsRoutes(router: Router) {
  // 1. GET /api/events (List all events with participant counts, quotas & parking)
  router.get(
    '/api/events',
    requireAuth(async (ctx) => {
      const db = getDb();

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

      const participants = eventItem.attendances.map((att) => ({
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
        vehicleType: att.vehicleType,
        vehiclePlateNumber: att.vehiclePlateNumber,
        agreedToRules: att.agreedToRules,
        registrationData: att.registrationData || null,
      }));

      const ikhwanCount = participants.filter((p) => p.personGender === 'ikhwan').length;
      const akhwatCount = participants.filter((p) => p.personGender === 'akhwat').length;
      const carsCount = participants.filter((p) => p.vehicleType === 'car').length;
      const motorcyclesCount = participants.filter((p) => p.vehicleType === 'motorcycle').length;

      return successResponse(
        {
          ...eventItem,
          participants,
          totalParticipants: participants.length,
          attendedCount: participants.filter((p) => p.status === 'attended').length,
          ikhwanCount,
          akhwatCount,
          carsCount,
          motorcyclesCount,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 3. POST /api/events (Create new event with audience segment, quotas & parking)
  router.post(
    '/api/events',
    requireAuth(
      validateBody(createEventSchema, async (ctx, body) => {
        const db = getDb();
        if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const defaultFormConfig = body.formConfig || {
          collectEmail: false,
          collectCity: true,
          collectNotes: true,
          requireGender: true,
          collectVehicle: true,
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
            meetingUrl: body.meetingUrl || null,
            
            targetAudience: body.targetAudience || 'umum',
            quota: body.quota || null,
            quotaIkhwan: body.quotaIkhwan || null,
            quotaAkhwat: body.quotaAkhwat || null,
            isRegistrationOpen: body.isRegistrationOpen !== false,
            
            carParkingQuota: body.carParkingQuota || null,
            motorcycleParkingQuota: body.motorcycleParkingQuota || null,
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

  // 4. PUT /api/events/:id (Update event, quotas, venue rules & form builder)
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
        if (body.meetingUrl !== undefined) updatePayload.meetingUrl = body.meetingUrl;
        if (body.status !== undefined) updatePayload.status = body.status;
        
        if (body.targetAudience !== undefined) updatePayload.targetAudience = body.targetAudience;
        if (body.quota !== undefined) updatePayload.quota = body.quota;
        if (body.quotaIkhwan !== undefined) updatePayload.quotaIkhwan = body.quotaIkhwan;
        if (body.quotaAkhwat !== undefined) updatePayload.quotaAkhwat = body.quotaAkhwat;
        if (body.isRegistrationOpen !== undefined) updatePayload.isRegistrationOpen = body.isRegistrationOpen;
        
        if (body.carParkingQuota !== undefined) updatePayload.carParkingQuota = body.carParkingQuota;
        if (body.motorcycleParkingQuota !== undefined) updatePayload.motorcycleParkingQuota = body.motorcycleParkingQuota;
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
          const attendance = await db.query.eventAttendance.findFirst({
            where: and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.ticketCode, ticketCode)),
          });

          if (attendance) {
            const [updated] = await db
              .update(eventAttendance)
              .set({ status: 'attended', checkInAt: new Date() })
              .where(eq(eventAttendance.id, attendance.id))
              .returning();
            return successResponse(updated, { requestId: ctx.requestId });
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

          return successResponse(
            attendance || { status: 'attended', message: 'Jamaah sudah tercatat hadir' },
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

      return successResponse(updated, { requestId: ctx.requestId });
    })
  );

  // 8. POST /api/events/:id/participants/manual (Manually add participant by staff)
  router.post(
    '/api/events/:id/participants/manual',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { fullName, phone, gender, cityRegency, email, vehicleType, vehiclePlateNumber } = (ctx.body as any) || {};

      if (!eventId || !fullName || !phone) {
        return errorResponse('VALIDATION_ERROR', 'Event ID, nama lengkap, dan nomor telepon wajib diisi', 400, ctx.requestId);
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
            gender: gender || 'ikhwan',
            cityRegency: cityRegency || null,
            email: email || null,
            sourceCode: 'manual_staff_event',
          })
          .returning();
        person = newPerson;
      }

      if (!person) {
        return errorResponse('INTERNAL_ERROR', 'Gagal memproses data jamaah', 500, ctx.requestId);
      }

      const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ticketCode = `TIKET-KJN-${datePart}-${randPart}`;

      const insertQuery = db
        .insert(eventAttendance)
        .values({
          eventId,
          personId: person.id,
          source: 'manual_input',
          status: 'registered',
          ticketCode,
          vehicleType: vehicleType || 'none',
          vehiclePlateNumber: vehiclePlateNumber || null,
        });

      const onConflict = typeof (insertQuery as any).onConflictDoNothing === 'function'
        ? (insertQuery as any).onConflictDoNothing()
        : insertQuery;

      const [attendance] = await onConflict.returning();

      return successResponse(
        {
          attendance,
          person,
          ticketCode,
        },
        { requestId: ctx.requestId },
        201
      );
    })
  );
}
