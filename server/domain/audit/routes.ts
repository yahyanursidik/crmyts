import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { auditLogs, exportLogs } from '../../db/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { logExportEvent } from '../../audit/service';

const recordExportSchema = z.object({
  exportType: z.string().min(2, 'Tipe ekspor wajib diisi'),
  rowCount: z.number().int().min(0, 'Jumlah baris wajib valid'),
  reason: z.string().min(5, 'Alasan ekspor data wajib diisi minimal 5 karakter untuk audit kepatuhan'),
  filterJson: z.record(z.string(), z.any()).optional(),
  fileReference: z.string().optional(),
});

export function registerAuditRoutes(router: Router) {
  // 1. GET /api/audit/logs (List Audit Logs - Read-Only)
  router.get(
    '/api/audit/logs',
    requireAuth(
      requirePermission(PERMISSIONS.AUDIT_VIEW, async (ctx) => {
        const db = getDb();
        const actionFilter = ctx.query.action?.trim();
        const entityTypeFilter = ctx.query.entityType?.trim();
        const actorFilter = ctx.query.actorUserId?.trim();
        const fromDate = ctx.query.from ? new Date(ctx.query.from) : undefined;
        const toDate = ctx.query.to ? new Date(ctx.query.to) : undefined;
        const limit = Math.min(100, Math.max(1, parseInt(ctx.query.limit || '50', 10)));
        const offset = Math.max(0, parseInt(ctx.query.offset || '0', 10));

        const conditions: any[] = [];
        if (actionFilter) conditions.push(eq(auditLogs.action, actionFilter));
        if (entityTypeFilter) conditions.push(eq(auditLogs.entityType, entityTypeFilter));
        if (actorFilter) conditions.push(eq(auditLogs.actorUserId, actorFilter));
        if (fromDate) conditions.push(gte(auditLogs.createdAt, fromDate));
        if (toDate) conditions.push(lte(auditLogs.createdAt, toDate));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [items, [countRes]] = await Promise.all([
          db.query.auditLogs.findMany({
            where: whereClause,
            orderBy: [desc(auditLogs.createdAt)],
            limit,
            offset,
            with: {
              actor: {
                columns: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          }),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(auditLogs)
            .where(whereClause),
        ]);

        return successResponse(
          {
            items: items.map((log) => ({
              id: log.id,
              action: log.action,
              entityType: log.entityType,
              entityId: log.entityId,
              actorName: log.actor?.fullName || 'Sistem / Anonim',
              actorEmail: log.actor?.email || '-',
              reason: log.reason,
              requestId: log.requestId,
              hasBeforeJson: log.beforeJson !== null,
              hasAfterJson: log.afterJson !== null,
              createdAt: log.createdAt,
            })),
            total: countRes?.count || 0,
            limit,
            offset,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 2. GET /api/audit/logs/:id (Audit Detail with Before/After Diff)
  router.get(
    '/api/audit/logs/:id',
    requireAuth(
      requirePermission(PERMISSIONS.AUDIT_VIEW_DETAIL, async (ctx) => {
        const db = getDb();
        const logId = ctx.params.id;
        if (!logId) return errorResponse('VALIDATION_ERROR', 'ID Log audit diperlukan', 400, ctx.requestId);

        const log = await db.query.auditLogs.findFirst({
          where: eq(auditLogs.id, logId),
          with: {
            actor: {
              columns: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

        if (!log) {
          return errorResponse('NOT_FOUND', 'Catatan audit tidak ditemukan', 404, ctx.requestId);
        }

        return successResponse(
          {
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            actor: log.actor,
            beforeJson: log.beforeJson,
            afterJson: log.afterJson,
            reason: log.reason,
            requestId: log.requestId,
            ipHash: log.ipHash,
            userAgentSummary: log.userAgentSummary,
            createdAt: log.createdAt,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 3. GET /api/audit/exports (Export Governance Logs)
  router.get(
    '/api/audit/exports',
    requireAuth(
      requirePermission(PERMISSIONS.EXPORTS_VIEW_LOG, async (ctx) => {
        const db = getDb();
        const limit = Math.min(100, Math.max(1, parseInt(ctx.query.limit || '50', 10)));
        const offset = Math.max(0, parseInt(ctx.query.offset || '0', 10));

        const [items, [countRes]] = await Promise.all([
          db.query.exportLogs.findMany({
            orderBy: [desc(exportLogs.createdAt)],
            limit,
            offset,
            with: {
              actor: {
                columns: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          }),
          db.select({ count: sql<number>`count(*)::int` }).from(exportLogs),
        ]);

        return successResponse(
          {
            items: items.map((exp) => ({
              id: exp.id,
              exportType: exp.exportType,
              actorName: exp.actor?.fullName || 'Staf Internal',
              actorEmail: exp.actor?.email || '-',
              rowCount: exp.rowCount,
              reason: exp.reason,
              filterJson: exp.filterJson,
              fileReference: exp.fileReference,
              createdAt: exp.createdAt,
            })),
            total: countRes?.count || 0,
            limit,
            offset,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 4. POST /api/audit/record-export (Record Export with Governance Reason)
  router.post(
    '/api/audit/record-export',
    requireAuth(
      requirePermission(
        PERMISSIONS.DATA_EXPORT,
        validateBody(recordExportSchema, async (ctx, body) => {
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          await logExportEvent({
            actorUserId: user.id,
            exportType: body.exportType,
            filterJson: body.filterJson,
            rowCount: body.rowCount,
            reason: body.reason,
            fileReference: body.fileReference,
            requestId: ctx.requestId,
          });

          return successResponse({ recorded: true, exportType: body.exportType }, { requestId: ctx.requestId });
        })
      )
    )
  );
}
