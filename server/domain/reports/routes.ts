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
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { logExportEvent, logAuditEvent } from '../../audit/service';
import { normalizeIndonesianPhone, isValidE164 } from '../../lib/phone';

const exportReportSchema = z.object({
  reportType: z.enum(['executive_monthly', 'donations_reconciliation', 'attendance_summary', 'waqf_pipeline', 'jamaah_demographics']),
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

        return successResponse(
          {
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
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 2. GET /api/reports/donations-reconciliation
  router.get(
    '/api/reports/donations-reconciliation',
    requireAuth(
      requirePermission(PERMISSIONS.REPORTS_FINANCE, async (ctx) => {
        const db = getDb();
        const dateFrom = ctx.query.dateFrom ? new Date(ctx.query.dateFrom) : new Date(Date.now() - 30 * 86400000);
        const dateTo = ctx.query.dateTo ? new Date(ctx.query.dateTo) : new Date();

        const transactions = await db.query.donations.findMany({
          where: and(gte(donations.donationDate, dateFrom), lte(donations.donationDate, dateTo)),
          orderBy: [desc(donations.donationDate)],
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

        const statusCounts = {
          verified: 0,
          unverified: 0,
          rejected: 0,
          need_review: 0,
        };

        let totalVerifiedRupiah = 0;
        let totalUnverifiedRupiah = 0;

        const formatted = transactions.map((d) => {
          const amt = Number(d.amountRupiah);
          if (d.verificationStatus === 'verified') {
            statusCounts.verified++;
            totalVerifiedRupiah += amt;
          } else if (d.verificationStatus === 'unverified') {
            statusCounts.unverified++;
            totalUnverifiedRupiah += amt;
          } else if (d.verificationStatus === 'rejected') {
            statusCounts.rejected++;
          } else if (d.verificationStatus === 'need_review') {
            statusCounts.need_review++;
          }

          return {
            id: d.id,
            donorName: d.person?.fullName || 'Hamba Allah',
            donorPhone: d.person?.phoneE164 || '-',
            programName: d.program?.name || '-',
            amountRupiah: amt,
            paymentMethod: d.paymentMethod,
            donationDate: d.donationDate,
            verificationStatus: d.verificationStatus,
            verifiedByName: d.verifier?.fullName || null,
            verifiedAt: d.verifiedAt,
            rejectionReason: d.rejectionReason,
          };
        });

        return successResponse(
          {
            dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
            metrics: {
              totalTransactions: formatted.length,
              statusCounts,
              totalVerifiedRupiah,
              totalUnverifiedRupiah,
            },
            items: formatted,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 3. GET /api/reports/attendance-summary
  router.get(
    '/api/reports/attendance-summary',
    requireAuth(
      requirePermission(PERMISSIONS.REPORTS_VIEW, async (ctx) => {
        const db = getDb();

        const eventsList = await db.query.events.findMany({
          orderBy: [desc(events.startAt)],
          limit: 15,
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
          deliveryMode: e.deliveryMode,
          locationName: e.locationName,
          status: e.status,
          totalAttendees: e.attendances ? e.attendances.length : 0,
        }));

        return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length });
      })
    )
  );

  // 4. POST /api/reports/export-csv
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

  // 5. POST /api/reports/import-csv/dry-run (Validation & Dry Run)
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

  // 6. POST /api/reports/import-csv/commit (Commit valid rows)
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
