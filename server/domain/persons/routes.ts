import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  personRoles,
  personTags,
  sensitiveNotes,
  interactions,
  tasks,
  eventAttendance,
  events,
  donations,
  waqfCases,
  auditLogs,
} from '../../db/schema';
import { eq, desc, asc, ilike, or, and, sql, inArray } from 'drizzle-orm';
import { normalizePhoneE164 } from '../../lib/phone';
import { PERMISSIONS } from '../../permissions/constants';

const createPersonSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  phoneE164: z.string().optional().nullable(),
  email: z.string().email('Format email tidak valid').optional().nullable(),
  gender: z.enum(['ikhwan', 'akhwat']).optional().nullable(),
  province: z.string().optional().nullable(),
  cityRegency: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  educationLevel: z.string().optional().nullable(),
  sourceCode: z.string().optional().nullable(),
  engagementStatus: z.enum(['baru', 'aktif', 'rutin', 'sangat_aktif', 'dorman', 'kembali_aktif']).default('baru'),
  preferredChannel: z.enum(['whatsapp', 'phone', 'telegram', 'email', 'in_person']).default('whatsapp'),
  ownerUserId: z.string().uuid().optional().nullable(),
  roleCodes: z.array(z.string()).default(['jamaah']),
  tagIds: z.array(z.string().uuid()).default([]),
});

const updatePersonSchema = createPersonSchema.partial();

const createInteractionSchema = z.object({
  channel: z.enum(['whatsapp', 'phone_call', 'in_person', 'telegram', 'email', 'other']),
  summary: z.string().min(3, 'Ringkasan interaksi minimal 3 karakter'),
  outcome: z.string().optional().nullable(),
  sensitivityLevel: z.enum(['standard', 'confidential', 'restricted']).default('standard'),
  nextAction: z.string().optional().nullable(),
  createFollowUpTask: z.boolean().default(false),
  taskDueAt: z.string().optional().nullable(),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const createSensitiveNoteSchema = z.object({
  noteText: z.string().min(3, 'Isi catatan minimal 3 karakter'),
  sensitivityLevel: z.enum(['standard', 'high', 'restricted']).default('high'),
  reason: z.string().min(3, 'Alasan pencatatan wajib diisi untuk kepatuhan tata kelola'),
  expiresAt: z.string().optional().nullable(),
});

let cachedPersonsStats: { data: { totalMaster: number; multiKajian: number; donorsCount: number; waqfCount: number }; timestamp: number } | null = null;
const STATS_CACHE_TTL_MS = 60_000;

export function registerPersonsRoutes(router: Router) {
  // GET /api/persons/check-duplicate
  router.get(
    '/api/persons/check-duplicate',
    requireAuth(async (ctx) => {
      const db = getDb();
      const rawPhone = ctx.query.phone?.trim();
      const rawEmail = ctx.query.email?.trim();
      const excludeId = ctx.query.excludeId?.trim();

      const normalizedPhone = normalizePhoneE164(rawPhone);

      const conditions = [];
      if (normalizedPhone) {
        conditions.push(eq(persons.phoneE164, normalizedPhone));
      }
      if (rawEmail) {
        conditions.push(ilike(persons.email, rawEmail));
      }

      if (conditions.length === 0) {
        return successResponse({ isDuplicate: false, candidates: [] }, { requestId: ctx.requestId });
      }

      const candidates = await db.query.persons.findMany({
        where: and(
          or(...conditions),
          excludeId ? sql`${persons.id} != ${excludeId}::uuid` : undefined
        ),
        limit: 5,
        with: {
          roles: true,
          owner: true,
        },
      });

      return successResponse(
        {
          isDuplicate: candidates.length > 0,
          candidates: candidates.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            phoneE164: c.phoneE164,
            email: c.email,
            engagementStatus: c.engagementStatus,
            ownerName: c.owner?.fullName || null,
          })),
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // GET /api/persons (Comprehensive Paginated and Filtered List)
  router.get(
    '/api/persons',
    requireAuth(async (ctx) => {
      const db = getDb();

      // Pagination params
      const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize || '10', 10)));
      const offset = (page - 1) * pageSize;

      // Filter params
      const search = ctx.query.search?.trim();
      const engagementStatus = ctx.query.engagementStatus?.trim();
      const domisili = ctx.query.domisili?.trim();
      const roleCode = ctx.query.roleCode?.trim();
      const tagId = ctx.query.tagId?.trim();
      const ownerUserId = ctx.query.ownerUserId?.trim();
      const attendanceFilter = ctx.query.attendanceFilter?.trim();

      // Sorting
      const sortBy = ctx.query.sortBy || 'createdAt';
      const sortOrder = ctx.query.sortOrder === 'asc' ? 'asc' : 'desc';

      const whereConditions = [];

      if (search) {
        const normalizedSearchPhone = normalizePhoneE164(search);
        const searchFilters = [
          ilike(persons.fullName, `%${search}%`),
          ilike(persons.phoneE164, `%${search}%`),
          ilike(persons.email, `%${search}%`),
        ];
        if (normalizedSearchPhone) {
          searchFilters.push(eq(persons.phoneE164, normalizedSearchPhone));
        }
        whereConditions.push(or(...searchFilters));
      }

      if (engagementStatus) {
        whereConditions.push(eq(persons.engagementStatus, engagementStatus as any));
      }

      if (domisili) {
        whereConditions.push(
          or(
            ilike(persons.cityRegency, `%${domisili}%`),
            ilike(persons.province, `%${domisili}%`)
          )
        );
      }

      if (ownerUserId) {
        whereConditions.push(eq(persons.ownerUserId, ownerUserId));
      }

      if (roleCode) {
        if (roleCode === 'donatur') {
          whereConditions.push(
            sql`(
              EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'donatur')
              OR EXISTS (SELECT 1 FROM "donations" WHERE "donations"."person_id" = "persons"."id")
            )`
          );
        } else if (roleCode === 'wakif') {
          whereConditions.push(
            sql`(
              EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'wakif')
              OR EXISTS (SELECT 1 FROM "waqf_cases" WHERE "waqf_cases"."wakif_person_id" = "persons"."id")
            )`
          );
        } else {
          whereConditions.push(
            sql`EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = ${roleCode})`
          );
        }
      }

      if (tagId) {
        whereConditions.push(
          sql`EXISTS (SELECT 1 FROM "person_tags" WHERE "person_tags"."person_id" = "persons"."id" AND "person_tags"."tag_id" = ${tagId}::uuid)`
        );
      }

      if (attendanceFilter === 'multi') {
        whereConditions.push(
          sql`"persons"."id" IN (SELECT "event_attendance"."person_id" FROM "event_attendance" GROUP BY "event_attendance"."person_id" HAVING count("event_attendance"."id") >= 2)`
        );
      } else if (attendanceFilter === 'single') {
        whereConditions.push(
          sql`"persons"."id" IN (SELECT "event_attendance"."person_id" FROM "event_attendance" GROUP BY "event_attendance"."person_id" HAVING count("event_attendance"."id") = 1)`
        );
      } else if (attendanceFilter === 'none') {
        whereConditions.push(
          sql`"persons"."id" NOT IN (SELECT "event_attendance"."person_id" FROM "event_attendance")`
        );
      }

      const combinedWhere = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Total count query
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(persons)
        .where(combinedWhere);

      const totalCount = countResult?.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Order By
      let orderByClause;
      if (sortBy === 'fullName') {
        orderByClause = sortOrder === 'asc' ? asc(persons.fullName) : desc(persons.fullName);
      } else if (sortBy === 'engagementStatus') {
        orderByClause = sortOrder === 'asc' ? asc(persons.engagementStatus) : desc(persons.engagementStatus);
      } else {
        orderByClause = sortOrder === 'asc' ? asc(persons.createdAt) : desc(persons.createdAt);
      }

      // Fetch Paginated Persons
      const personsList = await db.query.persons.findMany({
        where: combinedWhere,
        orderBy: [orderByClause],
        limit: pageSize,
        offset,
        with: {
          owner: {
            columns: {
              id: true,
              fullName: true,
            },
          },
          roles: true,
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      // Enrich with last attendance and next pending task
      const personIds = personsList.map((p) => p.id);

      const attendancesMap = new Map<string, { eventTitle: string; startAt: Date; count: number }>();
      const tasksMap = new Map<string, { id: string; title: string; dueAt: Date; priority: string; isOverdue: boolean }>();

      if (personIds.length > 0) {
        // Last attendance and total attendance count per person
        const rawAttendances = await db
          .select({
            personId: eventAttendance.personId,
            eventTitle: events.title,
            startAt: events.startAt,
          })
          .from(eventAttendance)
          .innerJoin(events, eq(eventAttendance.eventId, events.id))
          .where(inArray(eventAttendance.personId, personIds))
          .orderBy(desc(events.startAt));

        for (const att of rawAttendances) {
          const existing = attendancesMap.get(att.personId);
          if (!existing) {
            attendancesMap.set(att.personId, { eventTitle: att.eventTitle, startAt: att.startAt, count: 1 });
          } else {
            existing.count += 1;
          }
        }

        // Next pending task per person
        const rawTasks = await db.query.tasks.findMany({
          where: and(
            inArray(tasks.personId, personIds),
            eq(tasks.status, 'pending')
          ),
          orderBy: [asc(tasks.dueAt)],
        });

        const now = new Date();
        for (const t of rawTasks) {
          if (t.personId && !tasksMap.has(t.personId)) {
            tasksMap.set(t.personId, {
              id: t.id,
              title: t.title,
              dueAt: t.dueAt,
              priority: t.priority,
              isOverdue: t.dueAt < now,
            });
          }
        }
      }

      const formatted = personsList.map((p) => {
        const lastAtt = attendancesMap.get(p.id);
        const nextTsk = tasksMap.get(p.id);

        return {
          id: p.id,
          fullName: p.fullName,
          phoneE164: p.phoneE164,
          email: p.email,
          gender: p.gender,
          province: p.province,
          cityRegency: p.cityRegency,
          occupation: p.occupation,
          educationLevel: p.educationLevel,
          sourceCode: p.sourceCode,
          engagementStatus: p.engagementStatus,
          preferredChannel: p.preferredChannel,
          createdAt: p.createdAt,
          owner: p.owner ? { id: p.owner.id, fullName: p.owner.fullName } : null,
          roles: p.roles.map((r) => r.roleCode),
          tags: p.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, category: t.tag.category })),
          lastAttendance: lastAtt ? { eventTitle: lastAtt.eventTitle, startAt: lastAtt.startAt } : null,
          attendanceCount: lastAtt ? lastAtt.count : 0,
          nextTask: nextTsk || null,
        };
      });

      // Quick stats for KPI cards (cached to avoid repeated heavy queries)
      let stats = {
        totalMaster: totalCount,
        multiKajian: 0,
        donorsCount: 0,
        waqfCount: 0,
      };

      const nowTime = Date.now();
      if (cachedPersonsStats && nowTime - cachedPersonsStats.timestamp < STATS_CACHE_TTL_MS) {
        stats = cachedPersonsStats.data;
      } else {
        try {
          const [statsRes] = await db
            .select({
              totalMaster: sql<number>`(SELECT count(*)::int FROM "persons")`,
              multiKajian: sql<number>`(SELECT count(*)::int FROM (SELECT "person_id" FROM "event_attendance" GROUP BY "person_id" HAVING count("id") >= 2) sub)`,
              donorsCount: sql<number>`(
                SELECT count(distinct "id")::int FROM "persons" 
                WHERE EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'donatur')
                   OR EXISTS (SELECT 1 FROM "donations" WHERE "donations"."person_id" = "persons"."id")
              )`,
              waqfCount: sql<number>`(
                SELECT count(distinct "id")::int FROM "persons" 
                WHERE EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'wakif')
                   OR EXISTS (SELECT 1 FROM "waqf_cases" WHERE "waqf_cases"."wakif_person_id" = "persons"."id")
              )`,
            })
            .from(sql`(SELECT 1) dummy`);

          if (statsRes) {
            stats = statsRes;
            cachedPersonsStats = { data: statsRes, timestamp: nowTime };
          }
        } catch (err) {
          console.warn('[Persons Stats Query Warn]:', err);
        }
      }

      return successResponse(formatted, {
        requestId: ctx.requestId,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
        stats,
      });
    })
  );

  // GET /api/persons/:id (Person 360 View)
  router.get(
    '/api/persons/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const personId = ctx.params.id;

      if (!personId) {
        return errorResponse('VALIDATION_ERROR', 'ID Jamaah diperlukan', 400, ctx.requestId);
      }

      // Check if user has permission to view sensitive notes
      const userRoles = ctx.user?.roles || [];
      const canViewSensitiveNotes =
        userRoles.includes('crm_admin') ||
        userRoles.includes('data_steward') ||
        userRoles.includes('leadership_viewer');

      const person = await db.query.persons.findFirst({
        where: eq(persons.id, personId),
        with: {
          owner: {
            columns: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          roles: true,
          tags: {
            with: {
              tag: true,
            },
          },
          sensitiveNotes: canViewSensitiveNotes
            ? {
                with: {
                  creator: {
                    columns: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
                orderBy: [desc(sensitiveNotes.createdAt)],
              }
            : undefined,
        },
      });

      if (!person) {
        return errorResponse('NOT_FOUND', 'Data Jamaah tidak ditemukan', 404, ctx.requestId);
      }

      // Fetch Kajian, Interactions, Tasks, Donations, Waqf in parallel
      const [attendances, personInteractions, personTasks, personDonations, personWaqf] = await Promise.all([
        db
          .select({
            id: eventAttendance.id,
            status: eventAttendance.status,
            source: eventAttendance.source,
            checkInAt: eventAttendance.checkInAt,
            event: {
              id: events.id,
              title: events.title,
              category: events.category,
              speaker: events.speaker,
              deliveryMode: events.deliveryMode,
              startAt: events.startAt,
              locationName: events.locationName,
            },
          })
          .from(eventAttendance)
          .innerJoin(events, eq(eventAttendance.eventId, events.id))
          .where(eq(eventAttendance.personId, personId))
          .orderBy(desc(events.startAt)),

        db.query.interactions.findMany({
          where: eq(interactions.personId, personId),
          orderBy: [desc(interactions.occurredAt)],
          with: {
            creator: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        }),

        db.query.tasks.findMany({
          where: eq(tasks.personId, personId),
          orderBy: [desc(tasks.dueAt)],
          with: {
            owner: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        }),

        db.query.donations.findMany({
          where: eq(donations.personId, personId),
          orderBy: [desc(donations.donationDate)],
          with: {
            program: true,
            verifier: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        }),

        db.query.waqfCases.findMany({
          where: eq(waqfCases.personId, personId),
          orderBy: [desc(waqfCases.openedAt)],
          with: {
            owner: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        }),
      ]);

      // Calculate aggregated metrics
      const verifiedTotalDonationsRupiah = personDonations
        .filter((d) => d.verificationStatus === 'verified')
        .reduce((sum, d) => sum + Number(d.amountRupiah), 0);

      // Build unified 360 chronological timeline
      const timelineItems: Array<{
        id: string;
        type: 'attendance' | 'interaction' | 'task' | 'donation' | 'waqf' | 'sensitive_note';
        date: string;
        title: string;
        description: string;
        status?: string;
        extra?: any;
      }> = [];

      for (const att of attendances) {
        timelineItems.push({
          id: `att_${att.id}`,
          type: 'attendance',
          date: att.checkInAt ? att.checkInAt.toISOString() : att.event.startAt.toISOString(),
          title: `Hadir Kajian: ${att.event.title}`,
          description: `Pemateri: ${att.event.speaker} (${att.event.category})`,
          status: att.status,
          extra: { eventId: att.event.id },
        });
      }

      for (const int of personInteractions) {
        timelineItems.push({
          id: `int_${int.id}`,
          type: 'interaction',
          date: int.occurredAt.toISOString(),
          title: `Sapaan via ${int.channel.toUpperCase()}: ${int.summary}`,
          description: int.outcome || 'Catatan komunikasi dicatat staf',
          status: int.sensitivityLevel,
          extra: { loggedBy: int.creator?.fullName },
        });
      }

      for (const don of personDonations) {
        timelineItems.push({
          id: `don_${don.id}`,
          type: 'donation',
          date: don.donationDate.toISOString(),
          title: `Donasi Infaq: Rp ${Number(don.amountRupiah).toLocaleString('id-ID')}`,
          description: `Program: ${don.program?.name || '-'} (${don.paymentMethod})`,
          status: don.verificationStatus,
          extra: { verifiedBy: don.verifier?.fullName },
        });
      }

      for (const w of personWaqf) {
        timelineItems.push({
          id: `waqf_${w.id}`,
          type: 'waqf',
          date: w.openedAt.toISOString(),
          title: `Kasus Wakaf: ${w.waqfType.toUpperCase()}`,
          description: w.notesSummary || 'Inisiasi amanah wakaf aset',
          status: w.currentStage,
          extra: { estimatedValue: w.estimatedValueRupiah ? Number(w.estimatedValueRupiah) : null },
        });
      }

      for (const t of personTasks) {
        timelineItems.push({
          id: `task_${t.id}`,
          type: 'task',
          date: t.dueAt.toISOString(),
          title: `Tugas Follow-Up: ${t.title}`,
          description: `Prioritas ${t.priority.toUpperCase()} - PIC: ${t.owner?.fullName || 'Belum ditugaskan'}`,
          status: t.status,
        });
      }

      // Sort timeline newest first
      timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return successResponse(
        {
          ...person,
          roles: person.roles.map((r) => r.roleCode),
          tags: person.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, category: t.tag.category })),
          attendances,
          interactions: personInteractions,
          tasks: personTasks,
          donations: personDonations.map((d) => ({
            ...d,
            amountRupiah: Number(d.amountRupiah),
          })),
          waqfCases: personWaqf.map((w) => ({
            ...w,
            estimatedValueRupiah: w.estimatedValueRupiah ? Number(w.estimatedValueRupiah) : null,
          })),
          sensitiveNotes: person.sensitiveNotes || [],
          metrics: {
            totalAttendances: attendances.length,
            totalInteractions: personInteractions.length,
            totalTasks: personTasks.length,
            pendingTasksCount: personTasks.filter((t) => t.status === 'pending').length,
            totalDonationsCount: personDonations.length,
            verifiedTotalDonationsRupiah,
            activeWaqfCasesCount: personWaqf.filter((w) => w.currentStage !== 'completed').length,
          },
          timeline: timelineItems,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // POST /api/persons (Create Person)
  router.post(
    '/api/persons',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_CREATE,
        validateBody(createPersonSchema, async (ctx, body) => {
          const db = getDb();
          const normalizedPhone = normalizePhoneE164(body.phoneE164);

          const [created] = await db
            .insert(persons)
            .values({
              fullName: body.fullName,
              phoneE164: normalizedPhone,
              email: body.email || null,
              gender: body.gender || null,
              province: body.province || null,
              cityRegency: body.cityRegency || null,
              district: body.district || null,
              occupation: body.occupation || null,
              educationLevel: body.educationLevel || null,
              sourceCode: body.sourceCode || 'direct_input',
              engagementStatus: body.engagementStatus,
              preferredChannel: body.preferredChannel,
              ownerUserId: body.ownerUserId || ctx.user?.id,
            })
            .returning();

          if (!created) {
            return errorResponse('INTERNAL_ERROR', 'Gagal membuat data jamaah', 500, ctx.requestId);
          }

          // Insert Person Roles
          if (body.roleCodes && body.roleCodes.length > 0) {
            await db.insert(personRoles).values(
              body.roleCodes.map((rc) => ({
                personId: created.id,
                roleCode: rc,
              }))
            );
          }

          // Insert Person Tags
          if (body.tagIds && body.tagIds.length > 0) {
            await db.insert(personTags).values(
              body.tagIds.map((tid) => ({
                personId: created.id,
                tagId: tid,
              }))
            );
          }

          return successResponse(created, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // PUT /api/persons/:id (Update Person)
  router.put(
    '/api/persons/:id',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_EDIT,
        validateBody(updatePersonSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id;

          if (!personId) {
            return errorResponse('VALIDATION_ERROR', 'ID Jamaah diperlukan', 400, ctx.requestId);
          }

          const normalizedPhone = body.phoneE164 !== undefined ? normalizePhoneE164(body.phoneE164) : undefined;

          const [updated] = await db
            .update(persons)
            .set({
              ...(body.fullName !== undefined && { fullName: body.fullName }),
              ...(body.phoneE164 !== undefined && { phoneE164: normalizedPhone }),
              ...(body.email !== undefined && { email: body.email }),
              ...(body.gender !== undefined && { gender: body.gender }),
              ...(body.province !== undefined && { province: body.province }),
              ...(body.cityRegency !== undefined && { cityRegency: body.cityRegency }),
              ...(body.district !== undefined && { district: body.district }),
              ...(body.occupation !== undefined && { occupation: body.occupation }),
              ...(body.educationLevel !== undefined && { educationLevel: body.educationLevel }),
              ...(body.sourceCode !== undefined && { sourceCode: body.sourceCode }),
              ...(body.engagementStatus !== undefined && { engagementStatus: body.engagementStatus }),
              ...(body.preferredChannel !== undefined && { preferredChannel: body.preferredChannel }),
              ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId }),
              updatedAt: new Date(),
            })
            .where(eq(persons.id, personId))
            .returning();

          if (!updated) {
            return errorResponse('NOT_FOUND', 'Data Jamaah tidak ditemukan', 404, ctx.requestId);
          }

          // Sync Person Roles if provided
          if (body.roleCodes) {
            await db.delete(personRoles).where(eq(personRoles.personId, personId));
            if (body.roleCodes.length > 0) {
              await db.insert(personRoles).values(
                body.roleCodes.map((rc) => ({
                  personId,
                  roleCode: rc,
                }))
              );
            }
          }

          // Sync Person Tags if provided
          if (body.tagIds) {
            await db.delete(personTags).where(eq(personTags.personId, personId));
            if (body.tagIds.length > 0) {
              await db.insert(personTags).values(
                body.tagIds.map((tid) => ({
                  personId,
                  tagId: tid,
                }))
              );
            }
          }

          return successResponse(updated, { requestId: ctx.requestId });
        })
      )
    )
  );

  // POST /api/persons/:id/interactions (Log Interaction & Optional Follow-up Task)
  router.post(
    '/api/persons/:id/interactions',
    requireAuth(
      requirePermission(
        PERMISSIONS.INTERACTIONS_CREATE,
        validateBody(createInteractionSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id;
          if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!personId) return errorResponse('VALIDATION_ERROR', 'ID Jamaah diperlukan', 400, ctx.requestId);

          const [interaction] = await db
            .insert(interactions)
            .values({
              personId,
              channel: body.channel,
              summary: body.summary,
              outcome: body.outcome || null,
              sensitivityLevel: body.sensitivityLevel,
              ownerUserId: ctx.user.id,
              createdBy: ctx.user.id,
            })
            .returning();

          let createdTask = null;
          if (body.createFollowUpTask && body.nextAction && body.taskDueAt) {
            const [newTask] = await db
              .insert(tasks)
              .values({
                personId,
                title: `Follow-up: ${body.nextAction}`,
                priority: body.taskPriority,
                status: 'pending',
                ownerUserId: ctx.user.id,
                assignedBy: ctx.user.id,
                dueAt: new Date(body.taskDueAt),
              })
              .returning();
            createdTask = newTask;
          }

          return successResponse(
            { interaction, createdTask },
            { requestId: ctx.requestId },
            201
          );
        })
      )
    )
  );

  // POST /api/persons/:id/sensitive-notes
  router.post(
    '/api/persons/:id/sensitive-notes',
    requireAuth(
      requirePermission(
        PERMISSIONS.SENSITIVE_NOTES_CREATE,
        validateBody(createSensitiveNoteSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id;
          if (!ctx.user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!personId) return errorResponse('VALIDATION_ERROR', 'ID Jamaah diperlukan', 400, ctx.requestId);

          const [note] = await db
            .insert(sensitiveNotes)
            .values({
              personId,
              noteText: body.noteText,
              sensitivityLevel: body.sensitivityLevel,
              reason: body.reason,
              expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
              createdBy: ctx.user.id,
            })
            .returning();

          return successResponse(note, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // DELETE /api/persons/:id (Delete a jamaah and cascade records)
  router.delete(
    '/api/persons/:id',
    requireAuth(
      requirePermission(PERMISSIONS.PERSONS_DELETE, async (ctx) => {
        const db = getDb();
        const id = ctx.params.id;
        if (!id) {
          return errorResponse('VALIDATION_ERROR', 'ID Jamaah diperlukan', 400, ctx.requestId);
        }

        const person = await db.query.persons.findFirst({
          where: eq(persons.id, id),
        });

        if (!person) {
          return errorResponse('NOT_FOUND', 'Data jamaah tidak ditemukan', 404, ctx.requestId);
        }

        // Delete person record (Cascades to related records)
        await db.delete(persons).where(eq(persons.id, id));

        // Audit Trail
        if (ctx.user) {
          try {
            await db.insert(auditLogs).values({
              actorUserId: ctx.user.id,
              action: 'delete_person',
              entityType: 'persons',
              entityId: id,
              beforeJson: person,
              reason: `Penghapusan data jamaah: ${person.fullName} (${person.phoneE164 || person.email || '-'})`,
              requestId: ctx.requestId,
            });
          } catch (auditErr) {
            console.error('Failed to log audit for person deletion:', auditErr);
          }
        }

        return successResponse(
          { success: true, message: `Data jamaah ${person.fullName} berhasil dihapus` },
          { requestId: ctx.requestId }
        );
      })
    )
  );
}
