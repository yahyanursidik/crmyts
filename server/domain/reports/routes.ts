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
} from '../../db/schema';
import { eq, and, sql, desc, gte, lte, ilike, or } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { logExportEvent, logAuditEvent } from '../../audit/service';
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
  rows: z.array(
    z.object({
      fullName: z.string().min(2),
      phone: z.string(),
      email: z.string().optional().nullable(),
      cityRegency: z.string().optional().nullable(),
      gender: z.string().optional().nullable(),
      sourceCode: z.string().optional().nullable(),
    })
  ).min(1, 'Data impor minimal 1 baris'),
});

const commitImportSchema = z.object({
  rows: z.array(
    z.object({
      fullName: z.string().min(2),
      phoneE164: z.string(),
      email: z.string().optional().nullable(),
      cityRegency: z.string().optional().nullable(),
      gender: z.enum(['ikhwan', 'akhwat']).optional().nullable(),
      sourceCode: z.string().optional().nullable(),
    })
  ).min(1, 'Data impor minimal 1 baris'),
  reason: z.string().min(5, 'Alasan impor data massal wajib diisi'),
});

export function registerReportsRoutes(router: Router) {
  // 1. GET /api/reports/executive-monthly
  router.get(
    '/api/reports/executive-monthly',
    requireAuth(
      requirePermission(PERMISSIONS.REPORTS_VIEW, async (ctx) => {
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
          .where(sql`${waqfCases.currentStage} NOT IN ('cancelled', 'stalled')`);

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
      requirePermission(PERMISSIONS.REPORTS_VIEW, async (ctx) => {
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
        PERMISSIONS.REPORTS_VIEW,
        validateBody(exportReportSchema, async (ctx, body) => {
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          // Log export event to audit
          await logExportEvent({
            actorUserId: user.id,
            exportType: `report_${body.reportType}`,
            rowCount: 100, // Estimated batch
            reason: body.reason,
            filterJson: { dateFrom: body.dateFrom, dateTo: body.dateTo },
            requestId: ctx.requestId,
          });

          return successResponse(
            {
              downloadUrl: `/api/reports/download/${body.reportType}.csv?req=${ctx.requestId}`,
              message: 'Ekspor laporan berhasil diotorisasi dan dicatat ke audit log.',
            },
            { requestId: ctx.requestId }
          );
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

          const existingPhones = new Set(existingPersons.map((p) => p.phoneE164));
          const existingEmails = new Set(existingPersons.filter((p) => p.email).map((p) => p.email!.toLowerCase()));

          const processed = body.rows.map((row, idx) => {
            const rawPhone = row.phone || '';
            const normalizedPhone = normalizeIndonesianPhone(rawPhone);
            const isValidPhone = isValidE164(normalizedPhone);
            const isDuplicatePhone = existingPhones.has(normalizedPhone);
            const isDuplicateEmail = row.email ? existingEmails.has(row.email.toLowerCase().trim()) : false;

            let genderParsed: 'ikhwan' | 'akhwat' | null = null;
            if (row.gender) {
              const g = row.gender.toLowerCase();
              if (g.includes('ikhwan') || g.includes('laki') || g === 'l' || g === 'm') genderParsed = 'ikhwan';
              if (g.includes('akhwat') || g.includes('perempuan') || g === 'p' || g === 'f') genderParsed = 'akhwat';
            }

            const issues: string[] = [];
            if (!isValidPhone) issues.push('Nomor HP tidak valid format Indonesia');
            if (isDuplicatePhone) issues.push('Nomor HP sudah terdaftar (Duplikat Exact)');
            if (isDuplicateEmail) issues.push('Email sudah terdaftar');

            return {
              rowNumber: idx + 1,
              fullName: row.fullName.trim(),
              rawPhone,
              normalizedPhone,
              email: row.email ? row.email.toLowerCase().trim() : null,
              cityRegency: row.cityRegency ? row.cityRegency.trim() : null,
              gender: genderParsed,
              sourceCode: row.sourceCode || 'CSV_IMPORT',
              isValid: issues.length === 0,
              isWarning: isDuplicatePhone || isDuplicateEmail,
              issues,
            };
          });

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
            { requestId: ctx.requestId }
          );
        })
      )
    )
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
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const insertedPersons = await db.transaction(async (tx) => {
            const results = [];
            for (const row of body.rows) {
              const [p] = await tx
                .insert(persons)
                .values({
                  fullName: row.fullName,
                  phoneE164: row.phoneE164,
                  email: row.email || null,
                  cityRegency: row.cityRegency || null,
                  gender: row.gender || null,
                  sourceCode: row.sourceCode || 'CSV_IMPORT',
                  ownerUserId: user.id,
                })
                .returning();
              results.push(p);
            }

            await logAuditEvent({
              actorUserId: user.id,
              action: 'bulk_import_persons',
              entityType: 'persons_batch',
              afterJson: { count: results.length, reason: body.reason },
              reason: body.reason,
              requestId: ctx.requestId,
            });

            return results;
          });

          return successResponse(
            {
              importedCount: insertedPersons.length,
              message: `Berhasil mengimpor ${insertedPersons.length} data jamaah baru ke sistem.`,
            },
            { requestId: ctx.requestId },
            201
          );
        })
      )
    )
  );
}
