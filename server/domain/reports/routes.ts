import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  events,
  eventAttendance,
  donations,
  donationPrograms,
  waqfCases,
  tasks,
  personRoles,
  auditLogs,
} from '../../db/schema';
import { eq, and, sql, desc, gte, lte, ilike, or } from 'drizzle-orm';
import { canViewReport, type ReportTab } from '../../permissions/navigation';
import { type Handler } from '../../http/middleware';
import { recordsToCsv } from '../../lib/csv';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../../permissions/constants';
import { logExportEvent } from '../../audit/service';
import { normalizeIndonesianPhone, isValidE164 } from '../../lib/phone';

// In-memory cache for fast report metric loading (TTL: 60s)
const reportCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 1000;

function getCached<T>(key: string): T | null {
  const cached = reportCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any) {
  reportCache.set(key, { timestamp: Date.now(), data });
}

export function clearReportCache() {
  reportCache.clear();
}

const exportReportSchema = z.object({
  reportType: z.enum([
    'executive_monthly',
    'donations_reconciliation',
    'attendance_summary',
    'waqf_pipeline',
    'jamaah_demographics',
  ]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  reason: z.string().min(5, 'Alasan kepatuhan ekspor minimal 5 karakter'),
});

const dryRunImportSchema = z.object({
  rows: z
    .array(
      z.object({
        fullName: z.string(),
        phone: z.string(),
        email: z.string().optional().nullable(),
        cityRegency: z.string().optional().nullable(),
        gender: z.string().optional().nullable(),
        sourceCode: z.string().optional().nullable(),
      }),
    )
    .min(1, 'Data impor minimal 1 baris')
    .max(1000, 'Maksimal 1.000 baris per impor'),
});

const commitImportSchema = z.object({
  rows: z
    .array(
      z.object({
        fullName: z.string().min(2),
        phoneE164: z.string(),
        email: z.string().optional().nullable(),
        cityRegency: z.string().optional().nullable(),
        gender: z.enum(['ikhwan', 'akhwat']).optional().nullable(),
        sourceCode: z.string().optional().nullable(),
      }),
    )
    .min(1, 'Data impor minimal 1 baris')
    .max(1000, 'Maksimal 1.000 baris per impor'),
  reason: z.string().min(5, 'Alasan impor data massal wajib diisi'),
});

function previewPersonImport(
  rows: z.infer<typeof dryRunImportSchema>['rows'],
  existing: Array<{ phoneE164: string | null; email: string | null }>,
) {
  const phones = new Set(
    existing
      .filter((row) => row.phoneE164 && !/[a-z]/i.test(row.phoneE164))
      .map((row) => normalizeIndonesianPhone(row.phoneE164)),
  );
  const emails = new Set(
    existing.map((row) => row.email?.trim().toLowerCase()).filter(Boolean),
  );
  return rows.map((row, index) => {
    const rawPhone = row.phone.trim();
    const normalizedPhone = normalizeIndonesianPhone(rawPhone);
    const email = row.email?.trim().toLowerCase() || null;
    const duplicatePhone = phones.has(normalizedPhone);
    const duplicateEmail = Boolean(email && emails.has(email));
    const issues: string[] = [];
    if (row.fullName.trim().length < 2 || row.fullName.trim().length > 160)
      issues.push('Nama lengkap harus 2–160 karakter');
    if (/[a-z]/i.test(rawPhone) || !isValidE164(normalizedPhone))
      issues.push('Nomor HP tidak valid');
    if (email && !z.string().email().safeParse(email).success)
      issues.push('Email tidak valid');
    if (duplicatePhone)
      issues.push('Nomor HP sudah terdaftar atau berulang dalam file');
    if (duplicateEmail)
      issues.push('Email sudah terdaftar atau berulang dalam file');
    const genderInput = row.gender?.toLowerCase() || '';
    let gender: 'ikhwan' | 'akhwat' | null = null;
    if (
      genderInput.includes('ikhwan') ||
      genderInput.includes('laki') ||
      ['l', 'm'].includes(genderInput)
    )
      gender = 'ikhwan';
    if (
      genderInput.includes('akhwat') ||
      genderInput.includes('perempuan') ||
      ['p', 'f'].includes(genderInput)
    )
      gender = 'akhwat';
    if (!issues.length) {
      phones.add(normalizedPhone);
      if (email) emails.add(email);
    }
    return {
      rowNumber: index + 1,
      fullName: row.fullName.trim(),
      rawPhone,
      normalizedPhone,
      email,
      cityRegency: row.cityRegency?.trim() || null,
      gender,
      sourceCode: row.sourceCode || 'CSV_IMPORT',
      isValid: !issues.length,
      isWarning: duplicatePhone || duplicateEmail,
      issues,
    };
  });
}
class PersonImportError extends Error {
  constructor(readonly preview: ReturnType<typeof previewPersonImport>) {
    super(
      'Sebagian kontak tidak valid atau sudah tercatat. Jalankan validasi CSV kembali. Tidak ada data yang disimpan.',
    );
  }
}

function reportAccess(tab: ReportTab, handler: Handler): Handler {
  return requireAuth(async (ctx) => {
    const permissions = [...new Set(ctx.user!.roles.flatMap((role) => ROLE_PERMISSIONS[role] || []))];
    if (!canViewReport(tab, permissions)) return errorResponse('FORBIDDEN', 'Laporan ini tidak tersedia untuk peran Anda.', 403, ctx.requestId);
    return handler(ctx);
  });
}

export function registerReportsRoutes(router: Router) {
  // 1. GET /api/reports/executive-monthly
  router.get(
    '/api/reports/executive-monthly',
    requireAuth(
      reportAccess('executive', async (ctx) => {
        const db = getDb();
        const monthParam = ctx.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
        const cacheKey = `executive_${monthParam}`;
        const cached = getCached<any>(cacheKey);
        if (cached) {
          return successResponse(cached, { requestId: ctx.requestId });
        }

        const startOfMonth = new Date(`${monthParam}-01T00:00:00.000Z`);
        const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1));

        // 1. Donasi bulan ini
        const [donationsMonth] = await db
          .select({
            totalRupiah: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.verificationStatus, 'verified'),
              gte(donations.donationDate, startOfMonth),
              lte(donations.donationDate, endOfMonth)
            )
          );

        // 2. Breakdown Donasi per Program
        const programBreakdown = await db
          .select({
            programId: donationPrograms.id,
            programName: donationPrograms.name,
            totalRupiah: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)::text`,
            donorsCount: sql<number>`count(distinct ${donations.personId})::int`,
            transactionsCount: sql<number>`count(*)::int`,
          })
          .from(donationPrograms)
          .leftJoin(
            donations,
            and(
              eq(donations.programId, donationPrograms.id),
              eq(donations.verificationStatus, 'verified'),
              gte(donations.donationDate, startOfMonth),
              lte(donations.donationDate, endOfMonth)
            )
          )
          .groupBy(donationPrograms.id, donationPrograms.name);

        // 3. Kehadiran Kajian Bulan Ini
        const [attendanceStats] = await db
          .select({
            totalAttendees: sql<number>`count(*)::int`,
            uniquePersons: sql<number>`count(distinct ${eventAttendance.personId})::int`,
          })
          .from(eventAttendance)
          .where(
            and(
              eq(eventAttendance.status, 'attended'),
              gte(eventAttendance.checkInAt, startOfMonth),
              lte(eventAttendance.checkInAt, endOfMonth)
            )
          );

        // 4. Progres Wakaf Aset Aktif
        const [waqfSummary] = await db
          .select({
            totalEstimatedRupiah: sql<string>`coalesce(sum(${waqfCases.estimatedValueRupiah}), 0)::text`,
            activeCasesCount: sql<number>`count(*)::int`,
          })
          .from(waqfCases)
          .where(sql`${waqfCases.currentStage} IN ('interested', 'consulted', 'pledged', 'document_preparation', 'in_progress')`);

        // 5. Follow-Up Resolution Rate
        const [tasksStats] = await db
          .select({
            totalTasks: sql<number>`count(*)::int`,
            completedTasks: sql<number>`count(case when ${tasks.status} = 'completed' then 1 end)::int`,
            overdueTasks: sql<number>`count(case when ${tasks.dueAt} < now() and ${tasks.status} != 'completed' then 1 end)::int`,
          })
          .from(tasks)
          .where(gte(tasks.createdAt, startOfMonth));

        const resolutionRate = tasksStats?.totalTasks
          ? Math.round(((tasksStats.completedTasks || 0) / tasksStats.totalTasks) * 100)
          : 100;

        const responseData = {
          period: monthParam,
          summary: {
            donasiBulanIniRupiah: Number(donationsMonth?.totalRupiah || 0),
            transaksiDonasiCount: donationsMonth?.count || 0,
            totalHadirKajian: attendanceStats?.totalAttendees || 0,
            jamaahUnikHadir: attendanceStats?.uniquePersons || 0,
            estimasiValuasiWakafRupiah: Number(waqfSummary?.totalEstimatedRupiah || 0),
            kasusWakafAktif: waqfSummary?.activeCasesCount || 0,
            resolusiFollowUpRate: resolutionRate,
            tugasOverdue: tasksStats?.overdueTasks || 0,
          },
          programBreakdown: programBreakdown.map((p) => ({
            ...p,
            totalRupiah: Number(p.totalRupiah || 0),
          })),
        };

        setCache(cacheKey, responseData);
        return successResponse(responseData, { requestId: ctx.requestId });
      })
    )
  );

  // 2. GET /api/reports/donations-reconciliation (Fast, Paginated & Searchable)
  router.get(
    '/api/reports/donations-reconciliation',
    requireAuth(
      requirePermission(PERMISSIONS.REPORTS_FINANCE, async (ctx) => {
        const db = getDb();
        const dateFrom = ctx.query.dateFrom ? new Date(ctx.query.dateFrom) : new Date(Date.now() - 90 * 86400000);
        const dateTo = ctx.query.dateTo ? new Date(ctx.query.dateTo) : new Date();
        const statusFilter = ctx.query.status as string | undefined;
        const programFilter = ctx.query.programId as string | undefined;
        const search = ctx.query.search?.trim();
        const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(ctx.query.limit || '15', 10)));
        const offset = (page - 1) * limit;

        // Build base conditions
        const conditions = [
          gte(donations.donationDate, dateFrom),
          lte(donations.donationDate, dateTo),
        ];

        if (statusFilter && statusFilter !== 'all') {
          conditions.push(eq(donations.verificationStatus, statusFilter as any));
        }
        if (programFilter && programFilter !== 'all') {
          conditions.push(eq(donations.programId, programFilter));
        }

        // Summary Aggregates
        const [aggregateStats] = await db
          .select({
            totalCount: sql<number>`count(*)::int`,
            verifiedCount: sql<number>`count(case when ${donations.verificationStatus} = 'verified' then 1 end)::int`,
            unverifiedCount: sql<number>`count(case when ${donations.verificationStatus} = 'unverified' then 1 end)::int`,
            rejectedCount: sql<number>`count(case when ${donations.verificationStatus} = 'rejected' then 1 end)::int`,
            needReviewCount: sql<number>`count(case when ${donations.verificationStatus} = 'need_review' then 1 end)::int`,
            totalVerifiedRupiah: sql<string>`coalesce(sum(case when ${donations.verificationStatus} = 'verified' then ${donations.amountRupiah} else 0 end), 0)::text`,
            totalUnverifiedRupiah: sql<string>`coalesce(sum(case when ${donations.verificationStatus} = 'unverified' then ${donations.amountRupiah} else 0 end), 0)::text`,
          })
          .from(donations)
          .where(and(gte(donations.donationDate, dateFrom), lte(donations.donationDate, dateTo)));

        // Filtered Query with Pagination
        const transactions = await db.query.donations.findMany({
          where: and(...conditions),
          orderBy: [desc(donations.donationDate)],
          limit,
          offset,
          with: {
            person: {
              columns: { id: true, fullName: true, phoneE164: true },
            },
            program: {
              columns: { id: true, name: true, code: true },
            },
            verifier: {
              columns: { id: true, fullName: true },
            },
          },
        });

        // Filter by search if specified
        let filteredItems = transactions;
        if (search) {
          const s = search.toLowerCase();
          filteredItems = transactions.filter((t: any) =>
            t.person?.fullName?.toLowerCase().includes(s) ||
            t.person?.phoneE164?.includes(s) ||
            t.program?.name?.toLowerCase().includes(s)
          );
        }

        const formatted = filteredItems.map((d: any) => ({
          id: d.id,
          donorName: d.person?.fullName || 'Hamba Allah',
          donorPhone: d.person?.phoneE164 || '-',
          programName: d.program?.name || '-',
          programCode: d.program?.code || '-',
          amountRupiah: Number(d.amountRupiah),
          paymentMethod: d.paymentMethod,
          donationDate: d.donationDate,
          verificationStatus: d.verificationStatus,
          verifiedByName: d.verifier?.fullName || null,
          verifiedAt: d.verifiedAt,
          rejectionReason: d.rejectionReason,
        }));

        const totalFiltered = aggregateStats?.totalCount || 0;

        return successResponse(
          {
            dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
            metrics: {
              totalTransactions: aggregateStats?.totalCount || 0,
              statusCounts: {
                verified: aggregateStats?.verifiedCount || 0,
                unverified: aggregateStats?.unverifiedCount || 0,
                rejected: aggregateStats?.rejectedCount || 0,
                need_review: aggregateStats?.needReviewCount || 0,
              },
              totalVerifiedRupiah: Number(aggregateStats?.totalVerifiedRupiah || 0),
              totalUnverifiedRupiah: Number(aggregateStats?.totalUnverifiedRupiah || 0),
            },
            items: formatted,
            pagination: {
              page,
              limit,
              total: totalFiltered,
              totalPages: Math.ceil(totalFiltered / limit) || 1,
            },
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 3. GET /api/reports/attendance-summary (Fast, Paginated & Searchable)
  router.get(
    '/api/reports/attendance-summary',
    requireAuth(
      requirePermission(PERMISSIONS.REPORTS_VIEW, async (ctx) => {
        const db = getDb();
        const search = ctx.query.search?.trim();
        const mode = ctx.query.mode as string | undefined;
        const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(ctx.query.limit || '15', 10)));
        const offset = (page - 1) * limit;

        const conditions: any[] = [];
        if (mode && mode !== 'all') {
          conditions.push(eq(events.deliveryMode, mode as any));
        }
        if (search) {
          conditions.push(
            or(
              ilike(events.title, `%${search}%`),
              ilike(events.speaker, `%${search}%`),
              ilike(events.locationName, `%${search}%`)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Total count
        const [totalCountRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(whereClause);

        const totalEvents = totalCountRow?.count || 0;

        const eventsList = await db.query.events.findMany({
          where: whereClause,
          orderBy: [desc(events.startAt)],
          limit,
          offset,
          with: {
            attendances: true,
          },
        });

        const formatted = eventsList.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          speaker: e.speaker,
          startAt: e.startAt,
          endAt: e.endAt,
          deliveryMode: e.deliveryMode,
          locationName: e.locationName,
          status: e.status,
          totalAttendees: e.attendances ? e.attendances.length : 0,
        }));

        // Total metrics
        const totalAttendeesSum = formatted.reduce((acc, curr) => acc + curr.totalAttendees, 0);

        return successResponse(formatted, {
          requestId: ctx.requestId,
          total: totalEvents,
          metrics: {
            totalEvents,
            totalAttendeesSum,
            avgAttendees: formatted.length ? Math.round(totalAttendeesSum / formatted.length) : 0,
          },
          pagination: {
            page,
            limit,
            total: totalEvents,
            totalPages: Math.ceil(totalEvents / limit) || 1,
          },
        });
      })
    )
  );

  // 4. GET /api/reports/waqf-portfolio (Comprehensive Waqf Pipeline Report)
  router.get(
    '/api/reports/waqf-portfolio',
    requireAuth(
      reportAccess('waqf', async (ctx) => {
        const db = getDb();
        const stageFilter = ctx.query.stage as string | undefined;
        const typeFilter = ctx.query.type as string | undefined;
        const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(ctx.query.limit || '15', 10)));
        const offset = (page - 1) * limit;

        const conditions: any[] = [];
        if (stageFilter && stageFilter !== 'all') {
          conditions.push(eq(waqfCases.currentStage, stageFilter as any));
        }
        if (typeFilter && typeFilter !== 'all') {
          conditions.push(eq(waqfCases.waqfType, typeFilter as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Stage breakdown aggregate
        const stageBreakdown = await db
          .select({
            stage: waqfCases.currentStage,
            count: sql<number>`count(*)::int`,
            totalEstimatedRupiah: sql<string>`coalesce(sum(${waqfCases.estimatedValueRupiah}), 0)::text`,
          })
          .from(waqfCases)
          .groupBy(waqfCases.currentStage);

        const [totalSummary] = await db
          .select({
            totalCases: sql<number>`count(*)::int`,
            totalValuation: sql<string>`coalesce(sum(${waqfCases.estimatedValueRupiah}), 0)::text`,
            completedCases: sql<number>`count(case when ${waqfCases.currentStage} = 'completed' or ${waqfCases.currentStage} = 'stewardship' then 1 end)::int`,
          })
          .from(waqfCases);

        const casesList = await db.query.waqfCases.findMany({
          where: whereClause,
          orderBy: [desc(waqfCases.createdAt)],
          limit,
          offset,
          with: {
            person: {
              columns: { id: true, fullName: true, phoneE164: true, cityRegency: true },
            },
            owner: {
              columns: { id: true, fullName: true },
            },
          },
        });

        const formatted = (casesList || []).map((c: any) => ({
          id: c.id,
          waqifName: c.person?.fullName || 'Hamba Allah',
          waqifPhone: c.person?.phoneE164 || '-',
          waqifCity: c.person?.cityRegency || '-',
          waqfType: c.waqfType,
          estimatedValueRupiah: Number(c.estimatedValueRupiah || 0),
          currentStage: c.currentStage,
          ownerName: c.owner?.fullName || 'Amil Wakaf',
          openedAt: c.openedAt,
          notesSummary: c.notesSummary,
        }));

        const totalCount = totalSummary?.totalCases || 0;

        return successResponse(
          {
            metrics: {
              totalCases: totalCount,
              totalValuationRupiah: Number(totalSummary?.totalValuation || 0),
              completedCases: totalSummary?.completedCases || 0,
              stageBreakdown: stageBreakdown.map((s) => ({
                stage: s.stage,
                count: s.count,
                totalRupiah: Number(s.totalEstimatedRupiah || 0),
              })),
            },
            items: formatted,
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages: Math.ceil(totalCount / limit) || 1,
            },
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 5. POST /api/reports/export-csv
  router.post(
    '/api/reports/export-csv',
    requireAuth(
      requirePermission(
        PERMISSIONS.DATA_EXPORT,
        validateBody(exportReportSchema, async (ctx, body) => {
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!hasPermission(user.roles, PERMISSIONS.DATA_EXPORT)) return errorResponse('FORBIDDEN', 'Izin ekspor data diperlukan.', 403, ctx.requestId);
          const permissions = [...new Set(user.roles.flatMap((role) => ROLE_PERMISSIONS[role] || []))];
          const definitions = {
            executive_monthly: { path: '/api/reports/executive-monthly', tab: 'executive' },
            donations_reconciliation: { path: '/api/reports/donations-reconciliation', tab: 'donations' },
            attendance_summary: { path: '/api/reports/attendance-summary', tab: 'attendance' },
            waqf_pipeline: { path: '/api/reports/waqf-portfolio', tab: 'waqf' },
          } as const;
          let rows: Record<string, unknown>[] = [];
          if (body.reportType === 'jamaah_demographics') {
            if (!hasPermission(user.roles, PERMISSIONS.PERSONS_LIST)) return errorResponse('FORBIDDEN', 'Izin direktori jamaah diperlukan.', 403, ctx.requestId);
            rows = await getDb().query.persons.findMany({ columns: { id: true, fullName: true, cityRegency: true, gender: true, engagementStatus: true }, limit: 10001 });
          } else {
            const definition = definitions[body.reportType];
            if (!canViewReport(definition.tab, permissions)) return errorResponse('FORBIDDEN', 'Laporan ini tidak tersedia untuk peran Anda.', 403, ctx.requestId);
            for (let page = 1; page <= 101; page++) {
              const response = await router.handle({ ...ctx, method: 'GET', path: definition.path, params: {}, query: { page: String(page), limit: '100', month: body.dateFrom?.slice(0, 7), from: body.dateFrom, to: body.dateTo } });
              if (response.statusCode !== 200) return response;
              const payload = JSON.parse(response.body);
              if (body.reportType === 'executive_monthly') { rows = [{ period: payload.data.period, ...payload.data.summary }]; break; }
              const batch = Array.isArray(payload.data) ? payload.data : payload.data.items || [];
              rows.push(...batch);
              const totalPages = payload.data.pagination?.totalPages ?? payload.meta?.pagination?.totalPages ?? 1;
              if (page >= totalPages || !batch.length || rows.length > 10000) break;
            }
          }
          if (rows.length > 10000) return errorResponse('VALIDATION_ERROR', 'Batasi periode ekspor hingga maksimal 10.000 baris.', 400, ctx.requestId);
          await logExportEvent({ actorUserId: user.id, exportType: `report_${body.reportType}`, rowCount: rows.length, reason: body.reason, filterJson: { dateFrom: body.dateFrom, dateTo: body.dateTo }, requestId: ctx.requestId });
          return successResponse({ csvContent: recordsToCsv(rows), filename: `yts-${body.reportType}.csv`, rowCount: rows.length, message: `${rows.length} baris berhasil diekspor.` }, { requestId: ctx.requestId });
        })
      )
    )
  );

  // 6. POST /api/reports/import-csv/dry-run (Validation & Dry Run)
  router.post(
    '/api/reports/import-csv/dry-run',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_CREATE,
        validateBody(dryRunImportSchema, async (ctx, body) => {
          const db = getDb();
          const existingPersons = await db.query.persons.findMany({
            columns: { phoneE164: true, email: true },
          });

          const processed = previewPersonImport(body.rows, existingPersons);

          const validCount = processed.filter((p) => p.isValid).length;
          const duplicateCount = processed.filter((p) => p.isWarning).length;
          const errorCount = processed.filter((p) => !p.isValid).length;

          return successResponse(
            {
              totalRows: body.rows.length,
              validCount,
              duplicateCount,
              errorCount,
              canCommit: errorCount === 0 || validCount > 0,
              preview: processed,
            },
            { requestId: ctx.requestId },
          );
        }),
      ),
    ),
  );

  // 7. POST /api/reports/import-csv/commit (Commit valid rows)
  router.post(
    '/api/reports/import-csv/commit',
    requireAuth(
      requirePermission(
        PERMISSIONS.PERSONS_CREATE,
        validateBody(commitImportSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user)
            return errorResponse(
              'UNAUTHENTICATED',
              'Login diperlukan',
              401,
              ctx.requestId,
            );

          let importedCount = 0;
          try {
            importedCount = await db.transaction(async (tx) => {
              await tx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtext('yts.persons.csv-import'))`,
              );
              const existing = await tx.query.persons.findMany({
                columns: { phoneE164: true, email: true },
              });
              const preview = previewPersonImport(
                body.rows.map((row) => ({ ...row, phone: row.phoneE164 })),
                existing,
              );
              if (preview.some((row) => !row.isValid))
                throw new PersonImportError(preview);
              const created = await tx
                .insert(persons)
                .values(
                  preview.map((row) => ({
                    fullName: row.fullName,
                    phoneE164: row.normalizedPhone,
                    email: row.email,
                    cityRegency: row.cityRegency,
                    gender: row.gender,
                    sourceCode: row.sourceCode,
                    ownerUserId: user.id,
                  })),
                )
                .returning({ id: persons.id });
              await tx
                .insert(personRoles)
                .values(
                  created.map((person) => ({
                    personId: person.id,
                    roleCode: 'jamaah',
                  })),
                );
              await tx
                .insert(auditLogs)
                .values({
                  actorUserId: user.id,
                  action: 'bulk_import_persons',
                  entityType: 'persons_batch',
                  afterJson: { count: created.length },
                  reason: body.reason,
                  requestId: ctx.requestId,
                });
              return created.length;
            });
          } catch (error) {
            if (error instanceof PersonImportError)
              return errorResponse(
                error.preview.some((row) => row.isWarning)
                  ? 'CONFLICT'
                  : 'VALIDATION_ERROR',
                error.message,
                error.preview.some((row) => row.isWarning) ? 409 : 400,
                ctx.requestId,
                {
                  issues: error.preview
                    .filter((row) => !row.isValid)
                    .map((row) => ({
                      rowNumber: row.rowNumber,
                      issues: row.issues,
                    })),
                },
              );
            throw error;
          }
          reportCache.clear();

          return successResponse(
            {
              importedCount: importedCount,
              message: `Berhasil mengimpor ${importedCount} data jamaah baru ke sistem.`,
            },
            { requestId: ctx.requestId },
            201,
          );
        }),
      ),
    ),
  );
}
