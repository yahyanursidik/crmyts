import { z } from 'zod';
import { Router } from '../../http/router';
import {
  requireAuth,
  requirePermission,
  validateBody,
} from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  appUsers,
  tags,
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
  kajianRutinAttendance,
  kajianRutinSessions,
  kajianRutinSeries,
  bazaarTenants,
  jamaahRoomEntries,
} from '../../db/schema';
import {
  eq,
  desc,
  asc,
  ilike,
  or,
  and,
  sql,
  inArray,
  isNull,
  gt,
} from 'drizzle-orm';
import { normalizePhoneE164, isValidE164 } from '../../lib/phone';
import { PERMISSIONS, hasPermission } from '../../permissions/constants';
import {
  attendedActivityRows,
  loadAttendanceSummary,
  routineContactMatch,
} from './readModel';
import {
  registerPersonOperations,
  setPersonArchive,
  PersonConflict,
} from './operations';
import { interactionVisibility, linkedInteractionTaskVisibility } from '../interactions/visibility';
import { createPersonInteractionHandler } from '../interactions/service';

const createPersonSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(160),
  phoneE164: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        (!/[a-z]/i.test(value) && isValidE164(normalizePhoneE164(value))),
      'Nomor WhatsApp tidak valid',
    )
    .optional()
    .nullable(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid')
    .optional()
    .nullable(),
  gender: z.enum(['ikhwan', 'akhwat']).optional().nullable(),
  province: z.string().optional().nullable(),
  cityRegency: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  educationLevel: z.string().optional().nullable(),
  sourceCode: z.string().optional().nullable(),
  engagementStatus: z
    .enum(['baru', 'aktif', 'rutin', 'sangat_aktif', 'dorman', 'kembali_aktif'])
    .default('baru'),
  preferredChannel: z
    .enum(['whatsapp', 'phone', 'telegram', 'email', 'in_person'])
    .default('whatsapp'),
  ownerUserId: z.string().uuid().optional().nullable(),
  roleCodes: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .transform((values) => [...new Set(values)])
    .default(['jamaah']),
  tagIds: z
    .array(z.string().uuid())
    .max(100)
    .transform((values) => [...new Set(values)])
    .default([]),
});

const updatePersonSchema = createPersonSchema.partial();

const bulkDeletePersonsSchema = z.object({
  personIds: z
    .array(z.string().uuid('ID jamaah tidak valid'))
    .min(1, 'Pilih minimal satu jamaah')
    .max(100, 'Maksimal 100 jamaah dapat dihapus dalam satu proses')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Daftar jamaah tidak boleh berulang',
    ),
  confirmation: z.enum(['ARSIPKAN', 'HAPUS']),
});

const createSensitiveNoteSchema = z.object({
  noteText: z.string().min(3, 'Isi catatan minimal 3 karakter'),
  sensitivityLevel: z.enum(['standard', 'high', 'restricted']).default('high'),
  reason: z
    .string()
    .min(3, 'Alasan pencatatan wajib diisi untuk kepatuhan tata kelola'),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
});

let cachedPersonsStats: {
  data: {
    totalMaster: number;
    multiKajian: number;
    donorsCount: number;
    waqfCount: number;
  };
  timestamp: number;
} | null = null;
const STATS_CACHE_TTL_MS = 60_000;

export function registerPersonsRoutes(router: Router) {
  registerPersonOperations(router, () => {
    cachedPersonsStats = null;
  });
  // GET /api/persons/check-duplicate
  router.get(
    '/api/persons/check-duplicate',
    requirePermission(PERMISSIONS.PERSONS_LIST, async (ctx) => {
      const db = getDb();
      const rawPhone = ctx.query.phone?.trim();
      const rawEmail = ctx.query.email?.trim();
      const excludeId = ctx.query.excludeId?.trim();

      if (excludeId && !z.string().uuid().safeParse(excludeId).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'ID jamaah tidak valid.',
          400,
          ctx.requestId,
        );
      const normalizedPhone = normalizePhoneE164(rawPhone);

      const conditions = [];
      if (normalizedPhone) {
        conditions.push(eq(persons.phoneE164, normalizedPhone));
      }
      if (rawEmail) {
        conditions.push(ilike(persons.email, rawEmail));
      }

      if (conditions.length === 0) {
        return successResponse(
          { isDuplicate: false, candidates: [] },
          { requestId: ctx.requestId },
        );
      }

      const candidates = await db.query.persons.findMany({
        where: and(
          or(...conditions),
          excludeId ? sql`${persons.id} != ${excludeId}::uuid` : undefined,
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
            isActive: c.isActive,
            phoneE164: c.phoneE164,
            email: c.email,
            engagementStatus: c.engagementStatus,
            ownerName: c.owner?.fullName || null,
          })),
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // GET /api/persons (Comprehensive Paginated and Filtered List)
  router.get(
    '/api/persons',
    requirePermission(PERMISSIONS.PERSONS_LIST, async (ctx) => {
      const db = getDb();

      const filters = z
        .object({
          page: z.coerce.number().int().min(1).max(1000000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(15),
          search: z.string().trim().max(160).optional(),
          engagementStatus: z
            .enum([
              'baru',
              'aktif',
              'rutin',
              'sangat_aktif',
              'dorman',
              'kembali_aktif',
            ])
            .optional(),
          domisili: z.string().trim().max(160).optional(),
          roleCode: z.string().max(40).optional(),
          tagId: z.string().uuid().optional(),
          ownerUserId: z
            .union([z.string().uuid(), z.literal('unassigned')])
            .optional(),
          attendanceFilter: z.enum(['multi', 'single', 'none']).optional(),
          status: z.enum(['active', 'archived', 'all']).default('active'),
          sortBy: z
            .enum(['createdAt', 'fullName', 'engagementStatus'])
            .default('createdAt'),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
        })
        .safeParse(ctx.query);
      if (!filters.success)
        return errorResponse(
          'VALIDATION_ERROR',
          'Filter jamaah tidak valid.',
          400,
          ctx.requestId,
        );
      const {
        page,
        pageSize,
        search,
        engagementStatus,
        domisili,
        roleCode,
        tagId,
        ownerUserId,
        attendanceFilter,
        status,
        sortBy,
        sortOrder,
      } = filters.data;
      const offset = (page - 1) * pageSize;
      const forceStatsRefresh = ctx.query.refreshStats === '1';
      const whereConditions = [];
      if (status !== 'all')
        whereConditions.push(eq(persons.isActive, status === 'active'));

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
        whereConditions.push(
          eq(persons.engagementStatus, engagementStatus as any),
        );
      }

      if (domisili) {
        whereConditions.push(
          or(
            ilike(persons.cityRegency, `%${domisili}%`),
            ilike(persons.province, `%${domisili}%`),
          ),
        );
      }

      if (ownerUserId) {
        whereConditions.push(
          ownerUserId === 'unassigned'
            ? isNull(persons.ownerUserId)
            : eq(persons.ownerUserId, ownerUserId),
        );
      }

      if (roleCode) {
        if (roleCode === 'donatur') {
          whereConditions.push(
            sql`(
              EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'donatur')
              OR EXISTS (SELECT 1 FROM "donations" WHERE "donations"."person_id" = "persons"."id")
            )`,
          );
        } else if (roleCode === 'wakif') {
          whereConditions.push(
            sql`(
              EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = 'wakif')
              OR EXISTS (SELECT 1 FROM "waqf_cases" WHERE "waqf_cases"."person_id" = "persons"."id")
            )`,
          );
        } else if (roleCode === 'wakif_relawan') {
          whereConditions.push(
            sql`(
              EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" IN ('wakif', 'relawan'))
              OR EXISTS (SELECT 1 FROM "waqf_cases" WHERE "waqf_cases"."person_id" = "persons"."id")
            )`,
          );
        } else {
          whereConditions.push(
            sql`EXISTS (SELECT 1 FROM "person_roles" WHERE "person_roles"."person_id" = "persons"."id" AND "person_roles"."role_code" = ${roleCode})`,
          );
        }
      }

      if (tagId) {
        whereConditions.push(
          sql`EXISTS (SELECT 1 FROM "person_tags" WHERE "person_tags"."person_id" = "persons"."id" AND "person_tags"."tag_id" = ${tagId}::uuid)`,
        );
      }

      if (attendanceFilter) {
        const comparator =
          attendanceFilter === 'multi'
            ? sql`>= 2`
            : attendanceFilter === 'single'
              ? sql`= 1`
              : sql`= 0`;
        whereConditions.push(
          sql`(SELECT count(*) FROM (${attendedActivityRows()}) activity WHERE activity.person_id=${persons.id}) ${comparator}`,
        );
      }

      const combinedWhere =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Total count query
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(persons)
        .where(combinedWhere);

      const totalCount = countResult?.count || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      // Order By
      let orderByClause;
      if (sortBy === 'fullName') {
        orderByClause =
          sortOrder === 'asc' ? asc(persons.fullName) : desc(persons.fullName);
      } else if (sortBy === 'engagementStatus') {
        orderByClause =
          sortOrder === 'asc'
            ? asc(persons.engagementStatus)
            : desc(persons.engagementStatus);
      } else {
        orderByClause =
          sortOrder === 'asc'
            ? asc(persons.createdAt)
            : desc(persons.createdAt);
      }

      // Fetch Paginated Persons
      const personsList = await db.query.persons.findMany({
        where: combinedWhere,
        orderBy: [orderByClause, asc(persons.id)],
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

      const attendancesMap = await loadAttendanceSummary(db, personIds);
      const tasksMap = new Map<
        string,
        {
          id: string;
          title: string;
          dueAt: Date;
          priority: string;
          isOverdue: boolean;
        }
      >();
      const canReadTasks =
        hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_VIEW_OWN) ||
        hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_VIEW_ALL);
      if (personIds.length > 0 && canReadTasks) {
        // Next pending task per person
        const rawTasks = await db.query.tasks.findMany({
          where: and(
            inArray(tasks.personId, personIds),
            inArray(tasks.status, ['pending', 'in_progress', 'waiting']),
            hasPermission(ctx.user!.roles, PERMISSIONS.TASKS_VIEW_ALL)
              ? undefined
              : eq(tasks.ownerUserId, ctx.user!.id),
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
          isActive: p.isActive,
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
          owner: p.owner
            ? { id: p.owner.id, fullName: p.owner.fullName }
            : null,
          roles: p.roles.map((r) => r.roleCode),
          tags: p.tags.map((t) => ({
            id: t.tag.id,
            name: t.tag.name,
            category: t.tag.category,
          })),
          lastAttendance: lastAtt || null,
          attendanceCount: lastAtt ? lastAtt.count : 0,
          nextTask: nextTsk || null,
        };
      });

      let stats;
      if (
        !forceStatsRefresh &&
        cachedPersonsStats &&
        Date.now() - cachedPersonsStats.timestamp < STATS_CACHE_TTL_MS
      )
        stats = cachedPersonsStats.data;
      else {
        const result = await db.execute(sql`
          WITH activity AS (${attendedActivityRows()}), repeats AS (SELECT person_id FROM activity GROUP BY person_id HAVING count(*) >= 2)
          SELECT count(*) FILTER(WHERE p.is_active)::int AS "totalMaster",
            count(*) FILTER(WHERE NOT p.is_active)::int AS "archivedCount",
            count(*) FILTER(WHERE p.is_active AND p.id IN (SELECT person_id FROM repeats))::int AS "multiKajian",
            count(*) FILTER(WHERE p.is_active AND (EXISTS(SELECT 1 FROM person_roles r WHERE r.person_id=p.id AND r.role_code='donatur') OR EXISTS(SELECT 1 FROM donations d WHERE d.person_id=p.id)))::int AS "donorsCount",
            count(*) FILTER(WHERE p.is_active AND (EXISTS(SELECT 1 FROM person_roles r WHERE r.person_id=p.id AND r.role_code IN ('wakif','relawan')) OR EXISTS(SELECT 1 FROM waqf_cases w WHERE w.person_id=p.id)))::int AS "waqfCount"
          FROM persons p`);
        stats = (
          Array.isArray(result) ? result : (result as { rows: any[] }).rows
        )[0];
        cachedPersonsStats = { data: stats, timestamp: Date.now() };
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
    }),
  );

  // GET /api/persons/:id (Person 360 View)
  router.get(
    '/api/persons/:id',
    requireAuth(async (ctx) => {
      const roles = ctx.user!.roles;
      if (
        ![PERMISSIONS.PERSONS_VIEW, PERMISSIONS.PERSONS_VIEW_OPERATIONAL].some(
          (permission) => hasPermission(roles, permission),
        )
      )
        return errorResponse(
          'FORBIDDEN',
          'Izin melihat profil jamaah diperlukan.',
          403,
          ctx.requestId,
        );
      const db = getDb();
      const personId = ctx.params.id!;

      if (!z.string().uuid().safeParse(personId).success)
        return errorResponse(
          'VALIDATION_ERROR',
          'ID jamaah tidak valid.',
          400,
          ctx.requestId,
        );

      // Check if user has permission to view sensitive notes
      const canViewSensitiveNotes = hasPermission(
        roles,
        PERMISSIONS.SENSITIVE_NOTES_VIEW,
      );
      const canInteractions = hasPermission(
        roles,
        PERMISSIONS.INTERACTIONS_VIEW,
      );
      const canTasks =
        hasPermission(roles, PERMISSIONS.TASKS_VIEW_OWN) ||
        hasPermission(roles, PERMISSIONS.TASKS_VIEW_ALL);
      const canDonations =
        hasPermission(roles, PERMISSIONS.DONATIONS_VIEW_DETAIL) ||
        hasPermission(roles, PERMISSIONS.DONATIONS_VIEW_UNVERIFIED);
      const canWaqf = hasPermission(roles, PERMISSIONS.WAQF_VIEW_DETAIL);
      const canBazaar = hasPermission(roles, PERMISSIONS.EVENTS_VIEW);

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
                where: and(
                  isNull(sensitiveNotes.deletedAt),
                  or(
                    isNull(sensitiveNotes.expiresAt),
                    gt(sensitiveNotes.expiresAt, new Date()),
                  ),
                ),
                orderBy: [desc(sensitiveNotes.createdAt)],
              }
            : undefined,
        },
      });

      if (!person) {
        return errorResponse(
          'NOT_FOUND',
          'Data Jamaah tidak ditemukan',
          404,
          ctx.requestId,
        );
      }

      // Fetch Kajian, Interactions, Tasks, Donations, Waqf in parallel
      const [
        attendances,
        personInteractions,
        personTasks,
        personDonations,
        personWaqf,
      ] = await Promise.all([
        db
          .select({
            id: eventAttendance.id,
            status: eventAttendance.status,
            ticketCode: eventAttendance.ticketCode,
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

        canInteractions
          ? db.query.interactions.findMany({
              where: and(
                eq(interactions.personId, personId),
                isNull(interactions.archivedAt),
                interactionVisibility(roles, ctx.user!.id),
              ),
              orderBy: [desc(interactions.occurredAt)],
              with: {
                creator: {
                  columns: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            })
          : [],

        canTasks
          ? db.query.tasks.findMany({
              where: and(
                eq(tasks.personId, personId),
                linkedInteractionTaskVisibility(roles, ctx.user!.id),
                hasPermission(roles, PERMISSIONS.TASKS_VIEW_ALL)
                  ? undefined
                  : eq(tasks.ownerUserId, ctx.user!.id),
              ),
              orderBy: [desc(tasks.dueAt)],
              with: {
                owner: {
                  columns: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            })
          : [],

        canDonations
          ? db.query.donations.findMany({
              where: and(
                eq(donations.personId, personId),
                hasPermission(roles, PERMISSIONS.DONATIONS_VIEW_DETAIL)
                  ? undefined
                  : eq(donations.verificationStatus, 'unverified'),
              ),
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
            })
          : [],

        canWaqf
          ? db.query.waqfCases.findMany({
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
            })
          : [],
      ]);

      // Calculate aggregated metrics
      const verifiedTotalDonationsRupiah = personDonations
        .filter((d) => d.verificationStatus === 'verified')
        .reduce((sum, d) => sum + Number(d.amountRupiah), 0);

      // Match both verified portal email and the normalized contact used by staff.
      const routineRows =
        person.id
          ? await db
              .selectDistinctOn([kajianRutinAttendance.sessionId], {
                id: kajianRutinAttendance.id,
                sessionId: kajianRutinAttendance.sessionId,
                seriesId: kajianRutinAttendance.seriesId,
                seriesTitle: kajianRutinSeries.title,
                speaker: kajianRutinSessions.speaker,
                sessionDate: kajianRutinSessions.sessionDate,
                startAt: kajianRutinSessions.startAt,
                checkInAt: kajianRutinAttendance.checkInAt,
                source: kajianRutinAttendance.source,
                status: kajianRutinAttendance.status,
              })
              .from(kajianRutinAttendance)
              .innerJoin(
                kajianRutinSessions,
                eq(kajianRutinAttendance.sessionId, kajianRutinSessions.id),
              )
              .innerJoin(
                kajianRutinSeries,
                eq(kajianRutinAttendance.seriesId, kajianRutinSeries.id),
              )
              .where(
                routineContactMatch(
                  sql`${person.email}::text`,
                  sql`${person.phoneE164}::text`,
                  sql`${kajianRutinAttendance.email}`,
                  sql`${kajianRutinAttendance.phone}`,
                  sql`${person.id}::uuid`,
                  sql`${kajianRutinAttendance.personId}`,
                ),
              )
              .orderBy(
                asc(kajianRutinAttendance.sessionId),
                sql`CASE WHEN ${kajianRutinAttendance.status}='present' THEN 0 ELSE 1 END`,
                desc(kajianRutinAttendance.checkInAt),
              )
          : [];
      const routineAttendance = routineRows
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
        .slice(0, 100);

      const attendanceSummary = (
        await loadAttendanceSummary(db, [personId])
      ).get(personId);

      // Build unified 360 chronological timeline
      const timelineItems: Array<{
        id: string;
        type:
          | 'attendance'
          | 'interaction'
          | 'task'
          | 'donation'
          | 'waqf'
          | 'sensitive_note';
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
          date: att.checkInAt
            ? att.checkInAt.toISOString()
            : att.event.startAt.toISOString(),
          title: `${att.status === 'attended' ? 'Hadir' : 'Pendaftaran'}: ${att.event.title}`,
          description: `Pemateri: ${att.event.speaker} (${att.event.category})`,
          status: att.status,
          extra: { eventId: att.event.id },
        });
      }

      for (const routine of routineAttendance) {
        timelineItems.push({
          id: `rutin_${routine.id}`,
          type: 'attendance',
          date: routine.checkInAt.toISOString(),
          title: `${routine.status === 'present' ? 'Hadir' : 'Izin'} kajian rutin: ${routine.seriesTitle}`,
          description: `Absensi mandiri (${routine.source === 'manual_input' ? 'input panitia' : 'portal jamaah'})${routine.speaker ? ` • Pemateri: ${routine.speaker}` : ''}`,
          status: routine.status,
          extra: { sessionId: routine.sessionId, seriesId: routine.seriesId },
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
          extra: {
            estimatedValue: w.estimatedValueRupiah
              ? Number(w.estimatedValueRupiah)
              : null,
          },
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
      timelineItems.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const bazaarProfiles = canBazaar ? await db.query.bazaarTenants.findMany({where:eq(bazaarTenants.personId,personId),columns:{id:true,brandName:true,businessCategory:true},with:{applications:{columns:{id:true,status:true,checkedInAt:true},with:{bazaar:{columns:{eventId:true,title:true}},assignedBooth:{columns:{code:true}}}}}}) : [];
      return successResponse(
        {
          ...person,
          roomEntries: canInteractions ? await db.query.jamaahRoomEntries.findMany({where:and(eq(jamaahRoomEntries.personId,personId),isNull(jamaahRoomEntries.archivedAt)),columns:{id:true,subject:true,status:true,createdAt:true},orderBy:[desc(jamaahRoomEntries.createdAt)],limit:100}) : [],
          bazaarProfiles,
          roles: person.roles.map((r) => r.roleCode),
          tags: person.tags.map((t) => ({
            id: t.tag.id,
            name: t.tag.name,
            category: t.tag.category,
          })),
          attendances,
          routineAttendance,
          interactions: personInteractions,
          tasks: personTasks.map((task) => ({ ...task, assignee: task.owner })),
          donations: personDonations.map((d) => ({
            ...d,
            amountRupiah: Number(d.amountRupiah),
          })),
          waqfCases: personWaqf.map((w) => ({
            ...w,
            estimatedValueRupiah: w.estimatedValueRupiah
              ? Number(w.estimatedValueRupiah)
              : null,
          })),
          sensitiveNotes: canViewSensitiveNotes
            ? person.sensitiveNotes || []
            : [],
          metrics: {
            totalAttendances: attendanceSummary?.count || 0,
            totalInteractions: personInteractions.length,
            totalTasks: personTasks.length,
            pendingTasksCount: personTasks.filter((t) =>
              ['pending', 'in_progress', 'waiting'].includes(t.status),
            ).length,
            totalDonationsCount: personDonations.length,
            verifiedTotalDonationsRupiah,
            activeWaqfCasesCount: personWaqf.filter((w) =>
              [
                'interested',
                'consulted',
                'pledged',
                'document_preparation',
                'in_progress',
              ].includes(w.currentStage),
            ).length,
          },
          timeline: timelineItems,
        },
        { requestId: ctx.requestId },
      );
    }),
  );

  // POST /api/persons (Create Person)
  router.post(
    '/api/persons',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_CREATE,
        validateBody(createPersonSchema, async (ctx, body) => {
          const db = getDb();
          return db.transaction(async (tx) => {
            if (body.ownerUserId) {
              const owner = await tx.query.appUsers.findFirst({
                where: and(
                  eq(appUsers.id, body.ownerUserId),
                  eq(appUsers.isActive, true),
                ),
                columns: { id: true },
              });
              if (!owner)
                return errorResponse(
                  'VALIDATION_ERROR',
                  'PIC staf tidak aktif atau tidak ditemukan.',
                  400,
                  ctx.requestId,
                );
            }
            if (body.tagIds?.length) {
              const existingTags = await tx.query.tags.findMany({
                where: inArray(tags.id, body.tagIds),
                columns: { id: true },
              });
              if (existingTags.length !== body.tagIds.length)
                return errorResponse(
                  'VALIDATION_ERROR',
                  'Sebagian tag tidak ditemukan.',
                  400,
                  ctx.requestId,
                );
            }
            const normalizedPhone = normalizePhoneE164(body.phoneE164);

            const [created] = await tx
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
                ownerUserId:
                  body.ownerUserId === undefined
                    ? ctx.user!.id
                    : body.ownerUserId,
              })
              .returning();

            if (!created) {
              return errorResponse(
                'INTERNAL_ERROR',
                'Gagal membuat data jamaah',
                500,
                ctx.requestId,
              );
            }

            // Insert Person Roles
            if (body.roleCodes && body.roleCodes.length > 0) {
              await tx.insert(personRoles).values(
                body.roleCodes.map((rc) => ({
                  personId: created.id,
                  roleCode: rc,
                })),
              );
            }

            // Insert Person Tags
            if (body.tagIds && body.tagIds.length > 0) {
              await tx.insert(personTags).values(
                body.tagIds.map((tid) => ({
                  personId: created.id,
                  tagId: tid,
                })),
              );
            }

            await tx.insert(auditLogs).values({
              actorUserId: ctx.user!.id,
              action: 'create_person',
              entityType: 'persons',
              entityId: created.id,
              afterJson: created,
              reason: 'Pencatatan jamaah',
              requestId: ctx.requestId,
            });
            cachedPersonsStats = null;
            return successResponse(created, { requestId: ctx.requestId }, 201);
          });
        }),
      ),
    ),
  );

  // PUT /api/persons/:id (Update Person)
  router.put(
    '/api/persons/:id',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_EDIT,
        validateBody(updatePersonSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id!;

          if (!z.string().uuid().safeParse(personId).success) {
            return errorResponse(
              'VALIDATION_ERROR',
              'ID Jamaah diperlukan',
              400,
              ctx.requestId,
            );
          }

          return db.transaction(async (tx) => {
            if (body.ownerUserId) {
              const owner = await tx.query.appUsers.findFirst({
                where: and(
                  eq(appUsers.id, body.ownerUserId),
                  eq(appUsers.isActive, true),
                ),
                columns: { id: true },
              });
              if (!owner)
                return errorResponse(
                  'VALIDATION_ERROR',
                  'PIC staf tidak aktif atau tidak ditemukan.',
                  400,
                  ctx.requestId,
                );
            }
            if (body.tagIds?.length) {
              const existingTags = await tx.query.tags.findMany({
                where: inArray(tags.id, body.tagIds),
                columns: { id: true },
              });
              if (existingTags.length !== body.tagIds.length)
                return errorResponse(
                  'VALIDATION_ERROR',
                  'Sebagian tag tidak ditemukan.',
                  400,
                  ctx.requestId,
                );
            }
            const previous = await tx.query.persons.findFirst({
              where: eq(persons.id, personId),
              with: { roles: true, tags: true },
            });
            if (!previous)
              return errorResponse(
                'NOT_FOUND',
                'Data jamaah tidak ditemukan.',
                404,
                ctx.requestId,
              );
            const normalizedPhone =
              body.phoneE164 !== undefined
                ? normalizePhoneE164(body.phoneE164)
                : undefined;

            const [updated] = await tx
              .update(persons)
              .set({
                ...(body.fullName !== undefined && { fullName: body.fullName }),
                ...(body.phoneE164 !== undefined && {
                  phoneE164: normalizedPhone,
                }),
                ...(body.email !== undefined && { email: body.email }),
                ...(body.gender !== undefined && { gender: body.gender }),
                ...(body.province !== undefined && { province: body.province }),
                ...(body.cityRegency !== undefined && {
                  cityRegency: body.cityRegency,
                }),
                ...(body.district !== undefined && { district: body.district }),
                ...(body.occupation !== undefined && {
                  occupation: body.occupation,
                }),
                ...(body.educationLevel !== undefined && {
                  educationLevel: body.educationLevel,
                }),
                ...(body.sourceCode !== undefined && {
                  sourceCode: body.sourceCode,
                }),
                ...(body.engagementStatus !== undefined && {
                  engagementStatus: body.engagementStatus,
                }),
                ...(body.preferredChannel !== undefined && {
                  preferredChannel: body.preferredChannel,
                }),
                ...(body.ownerUserId !== undefined && {
                  ownerUserId: body.ownerUserId,
                }),
                updatedAt: new Date(),
              })
              .where(eq(persons.id, personId))
              .returning();

            if (!updated) {
              return errorResponse(
                'NOT_FOUND',
                'Data Jamaah tidak ditemukan',
                404,
                ctx.requestId,
              );
            }

            if (body.roleCodes) {
              const oldRoles = previous.roles.map((role) => role.roleCode);
              const removed = oldRoles.filter(
                (role) => !body.roleCodes!.includes(role),
              );
              const added = body.roleCodes.filter(
                (role) => !oldRoles.includes(role),
              );
              if (removed.length)
                await tx
                  .delete(personRoles)
                  .where(
                    and(
                      eq(personRoles.personId, personId),
                      inArray(personRoles.roleCode, removed),
                    ),
                  );
              if (added.length)
                await tx
                  .insert(personRoles)
                  .values(added.map((roleCode) => ({ personId, roleCode })));
            }
            if (body.tagIds) {
              const oldTags = previous.tags.map((tag) => tag.tagId);
              const removed = oldTags.filter(
                (tag) => !body.tagIds!.includes(tag),
              );
              const added = body.tagIds.filter((tag) => !oldTags.includes(tag));
              if (removed.length)
                await tx
                  .delete(personTags)
                  .where(
                    and(
                      eq(personTags.personId, personId),
                      inArray(personTags.tagId, removed),
                    ),
                  );
              if (added.length)
                await tx
                  .insert(personTags)
                  .values(added.map((tagId) => ({ personId, tagId })));
            }

            await tx.insert(auditLogs).values({
              actorUserId: ctx.user!.id,
              action: 'update_person',
              entityType: 'persons',
              entityId: personId,
              beforeJson: previous,
              afterJson: updated,
              reason: 'Pembaruan profil jamaah',
              requestId: ctx.requestId,
            });
            cachedPersonsStats = null;
            return successResponse(updated, { requestId: ctx.requestId });
          });
        }),
      ),
    ),
  );

  router.post('/api/persons/:id/interactions', createPersonInteractionHandler);

  // POST /api/persons/:id/sensitive-notes
  router.post(
    '/api/persons/:id/sensitive-notes',
    requireAuth(
      requirePermission(
        PERMISSIONS.SENSITIVE_NOTES_CREATE,
        validateBody(createSensitiveNoteSchema, async (ctx, body) => {
          const db = getDb();
          const personId = ctx.params.id!;
          if (!ctx.user)
            return errorResponse(
              'UNAUTHENTICATED',
              'Login diperlukan',
              401,
              ctx.requestId,
            );
          if (!z.string().uuid().safeParse(personId).success)
            return errorResponse(
              'VALIDATION_ERROR',
              'ID jamaah tidak valid.',
              400,
              ctx.requestId,
            );
          if (
            body.expiresAt &&
            new Date(body.expiresAt).getTime() <= Date.now()
          )
            return errorResponse(
              'VALIDATION_ERROR',
              'Batas berlaku harus setelah waktu saat ini.',
              400,
              ctx.requestId,
            );
          return db.transaction(async (tx) => {
            if (
              !(await tx.query.persons.findFirst({
                where: eq(persons.id, personId),
                columns: { id: true },
              }))
            )
              return errorResponse(
                'NOT_FOUND',
                'Jamaah tidak ditemukan.',
                404,
                ctx.requestId,
              );
            const [note] = await tx
              .insert(sensitiveNotes)
              .values({
                personId,
                noteText: body.noteText,
                sensitivityLevel: body.sensitivityLevel,
                reason: body.reason,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                createdBy: ctx.user!.id,
              })
              .returning();
            await tx.insert(auditLogs).values({
              actorUserId: ctx.user!.id,
              action: 'create_sensitive_note',
              entityType: 'sensitive_notes',
              entityId: note!.id,
              reason: body.reason,
              requestId: ctx.requestId,
            });
            return successResponse(note, { requestId: ctx.requestId }, 201);
          });
        }),
      ),
    ),
  );

  // DELETE compatibility route archives a person without cascading history.
  router.delete(
    '/api/persons/:id',
    requireAuth(
      requirePermission(PERMISSIONS.PERSONS_DELETE, async (ctx) => {
        const id = ctx.params.id;
        if (!id) {
          return errorResponse(
            'VALIDATION_ERROR',
            'ID Jamaah diperlukan',
            400,
            ctx.requestId,
          );
        }

        if (!z.string().uuid().safeParse(id).success)
          return errorResponse(
            'VALIDATION_ERROR',
            'ID jamaah tidak valid.',
            400,
            ctx.requestId,
          );
        try {
          const people = await setPersonArchive(
            [id],
            false,
            ctx.user!.id,
            ctx.requestId,
          );
          cachedPersonsStats = null;
          return successResponse(
            {
              success: true,
              archived: true,
              message: `Jamaah ${people[0]!.fullName} diarsipkan; riwayat tetap tersimpan.`,
            },
            { requestId: ctx.requestId },
          );
        } catch (error) {
          if (error instanceof PersonConflict)
            return errorResponse(
              'NOT_FOUND',
              error.message,
              404,
              ctx.requestId,
            );
          throw error;
        }
      }),
    ),
  );

  // Legacy bulk-delete route now performs a reversible, audited archive.
  router.post(
    '/api/persons/bulk-delete',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_DELETE,
        validateBody(bulkDeletePersonsSchema, async (ctx, body) => {
          const user = ctx.user;
          if (!user)
            return errorResponse(
              'UNAUTHENTICATED',
              'Login diperlukan',
              401,
              ctx.requestId,
            );

          const deletedPeople = await setPersonArchive(
            body.personIds,
            false,
            user.id,
            ctx.requestId,
          ).catch((error) => {
            if (error instanceof PersonConflict) return error;
            throw error;
          });
          if (deletedPeople instanceof PersonConflict)
            return errorResponse(
              'CONFLICT',
              'Sebagian jamaah tidak ditemukan. Segarkan daftar.',
              409,
              ctx.requestId,
              { missingIds: deletedPeople.missingIds },
            );

          cachedPersonsStats = null;
          return successResponse(
            {
              success: true,
              archived: true,
              archivedCount: deletedPeople.length,
              archivedPersonIds: deletedPeople.map((person) => person.id),
              message: `${deletedPeople.length} jamaah diarsipkan; seluruh riwayat tetap tersimpan.`,
            },
            { requestId: ctx.requestId },
          );
        }),
      ),
    ),
  );
}
