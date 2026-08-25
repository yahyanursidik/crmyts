import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { events, eventAttendance, persons } from '../../db/schema';
import { desc, eq, and, inArray } from 'drizzle-orm';
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
  
  // Paid Event & Banking Configuration
  isPaid: z.boolean().default(false),
  priceRupiah: z.number().int().min(0).default(0),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  
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
      }));

      const ikhwanCount = participants.filter((p) => p.personGender === 'ikhwan').length;
      const akhwatCount = participants.filter((p) => p.personGender === 'akhwat').length;
      const carsCount = participants.filter((p) => p.vehicleType === 'car').length;
      const motorcyclesCount = participants.filter((p) => p.vehicleType === 'motorcycle').length;
      const waitingVerificationCount = participants.filter((p) => p.paymentStatus === 'waiting_verification').length;
      const verifiedPaymentCount = participants.filter((p) => p.paymentStatus === 'verified').length;
      const pendingPaymentCount = participants.filter((p) => p.paymentStatus === 'pending_payment').length;

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
          waitingVerificationCount,
          verifiedPaymentCount,
          pendingPaymentCount,
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
            
            isPaid: body.isPaid || false,
            priceRupiah: body.priceRupiah || 0,
            bankName: body.bankName || null,
            bankAccountNumber: body.bankAccountNumber || null,
            bankAccountName: body.bankAccountName || null,
            paymentInstructions: body.paymentInstructions || null,

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
        if (body.meetingUrl !== undefined) updatePayload.meetingUrl = body.meetingUrl;
        if (body.status !== undefined) updatePayload.status = body.status;
        
        if (body.isPaid !== undefined) updatePayload.isPaid = body.isPaid;
        if (body.priceRupiah !== undefined) updatePayload.priceRupiah = body.priceRupiah;
        if (body.bankName !== undefined) updatePayload.bankName = body.bankName;
        if (body.bankAccountNumber !== undefined) updatePayload.bankAccountNumber = body.bankAccountNumber;
        if (body.bankAccountName !== undefined) updatePayload.bankAccountName = body.bankAccountName;
        if (body.paymentInstructions !== undefined) updatePayload.paymentInstructions = body.paymentInstructions;

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

  // 7e. POST /api/events/:id/attendances/bulk-delete (Bulk Remove Attendances)
  router.post(
    '/api/events/:id/attendances/bulk-delete',
    requireAuth(async (ctx) => {
      const db = getDb();
      const eventId = ctx.params.id;
      const { attendanceIds = [] } = (ctx.body as any) || {};

      if (!eventId || !Array.isArray(attendanceIds) || attendanceIds.length === 0) {
        return errorResponse('VALIDATION_ERROR', 'Event ID dan daftar Attendance ID diperlukan', 400, ctx.requestId);
      }

      const deleted = await db
        .delete(eventAttendance)
        .where(
          and(
            eq(eventAttendance.eventId, eventId),
            inArray(eventAttendance.id, attendanceIds)
          )
        )
        .returning();

      return successResponse(
        {
          message: `Berhasil menghapus ${deleted.length} pendaftaran peserta.`,
          deletedCount: deleted.length,
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
        const cleanCode = String(ticketCode).trim().toUpperCase();
        targetAttendance = await db.query.eventAttendance.findFirst({
          where: and(
            eq(eventAttendance.eventId, eventId),
            eq(eventAttendance.ticketCode, cleanCode)
          ),
          with: { person: true },
        });
      } else if (phoneQuery) {
        const cleanQuery = String(phoneQuery).trim();
        const norm = normalizeIndonesianPhone(cleanQuery);
        const candidatePersons = await db.query.persons.findMany({
          where: inArray(persons.phoneE164, [norm, `+${cleanQuery}`, cleanQuery]),
          columns: { id: true },
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
          const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
          const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          const ticketCode = item.ticketCode || `TIKET-KJN-${datePart}-${randPart}`;

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
