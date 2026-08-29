import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { 
  waqfCases, 
  waqfStageHistory, 
  waqfChecklistItems, 
  waqfDocuments,
  tasks,
  personRoles,
  auditLogs
} from '../../db/schema';
import { eq, desc, and, sql, or, ilike } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';
import { defaultAttachmentService } from '../../storage/service';

let cachedWaqfStats: { data: any; timestamp: number } | null = null;
const STATS_CACHE_TTL_MS = 60_000;

export const WAQF_STAGES = [
  'interested',
  'consulted',
  'pledged',
  'document_preparation',
  'in_progress',
  'completed',
  'stewardship',
] as const;

export type WaqfStageCode = (typeof WAQF_STAGES)[number];

const createWaqfSchema = z.object({
  personId: z.string().uuid('ID Wakif wajib dipilih'),
  waqfType: z.enum(['tanah', 'bangunan', 'uang', 'kendaraan', 'logistik_dakwah', 'sarana_air', 'lainnya']),
  estimatedValueRupiah: z.number().int().positive('Estimasi nilai wakaf harus lebih dari 0').optional().nullable(),
  notesSummary: z.string().optional().nullable(),
});

const transitionStageSchema = z.object({
  toStage: z.enum(WAQF_STAGES),
  reason: z.string().min(3, 'Alasan perpindahan tahapan wajib diisi minimal 3 karakter'),
  checklistUpdates: z.array(
    z.object({
      itemId: z.string().uuid(),
      isCompleted: z.boolean(),
    })
  ).optional().default([]),
  nextAction: z.string().optional().nullable(),
  taskDueAt: z.string().optional().nullable(),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const toggleChecklistSchema = z.object({
  isCompleted: z.boolean(),
});

export function registerWaqfRoutes(router: Router) {
  // GET /api/waqf (List with Kanban metrics, checklist completeness, and aging)
  router.get(
    '/api/waqf',
    requireAuth(async (ctx) => {
      const db = getDb();

      const search = ctx.query.search?.trim();
      const stage = ctx.query.stage?.trim();
      const waqfType = ctx.query.waqfType?.trim();
      const personId = ctx.query.personId?.trim();
      const ownerUserId = ctx.query.ownerUserId?.trim();

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(waqfCases.notesSummary, `%${search}%`),
            sql`EXISTS (SELECT 1 FROM people WHERE people.id = ${waqfCases.personId} AND (people.full_name ILIKE ${'%' + search + '%'} OR people.phone_e164 ILIKE ${'%' + search + '%'} OR people.city_regency ILIKE ${'%' + search + '%'}))`
          )
        );
      }
      if (stage) conditions.push(eq(waqfCases.currentStage, stage as any));
      if (waqfType) conditions.push(eq(waqfCases.waqfType, waqfType as any));
      if (personId) conditions.push(eq(waqfCases.personId, personId));
      if (ownerUserId) conditions.push(eq(waqfCases.ownerUserId, ownerUserId));

      const combinedWhere = conditions.length > 0 ? and(...conditions) : undefined;

      const list = await db.query.waqfCases.findMany({
        where: combinedWhere,
        orderBy: [desc(waqfCases.openedAt)],
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
              cityRegency: true,
            },
          },
          owner: {
            columns: {
              id: true,
              fullName: true,
            },
          },
          checklistItems: true,
          stageHistories: {
            orderBy: [desc(waqfStageHistory.changedAt)],
            limit: 5,
            with: {
              changer: {
                columns: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      const now = Date.now();

      // Compute or retrieve cached stats
      let stats = {
        totalCases: 0,
        totalEstimatedValueRupiah: 0,
        completedCases: 0,
        inProgressCases: 0,
      };

      if (cachedWaqfStats && now - cachedWaqfStats.timestamp < STATS_CACHE_TTL_MS) {
        stats = cachedWaqfStats.data;
      } else {
        try {
          const [statsRes] = await db
            .select({
              totalCases: sql<number>`(SELECT count(*)::int FROM "waqf_cases")`,
              totalEstimatedValueRupiah: sql<number>`COALESCE((SELECT SUM("estimated_value_rupiah")::bigint FROM "waqf_cases"), 0)`,
              completedCases: sql<number>`(SELECT count(*)::int FROM "waqf_cases" WHERE "current_stage" IN ('completed', 'stewardship'))`,
              inProgressCases: sql<number>`(SELECT count(*)::int FROM "waqf_cases" WHERE "current_stage" IN ('in_progress', 'document_preparation', 'pledged'))`,
            })
            .from(sql`(SELECT 1) dummy`);

          if (statsRes) {
            stats = {
              totalCases: Number(statsRes.totalCases || 0),
              totalEstimatedValueRupiah: Number(statsRes.totalEstimatedValueRupiah || 0),
              completedCases: Number(statsRes.completedCases || 0),
              inProgressCases: Number(statsRes.inProgressCases || 0),
            };
            cachedWaqfStats = { data: stats, timestamp: now };
          }
        } catch (err) {
          console.warn('[Waqf Stats Warn]:', err);
        }
      }

      const formatted = list.map((w) => {
        // Calculate aging in days since opened
        const openedTime = new Date(w.openedAt).getTime();
        const agingDays = Math.max(0, Math.floor((now - openedTime) / (1000 * 60 * 60 * 24)));

        // Calculate document / checklist completeness
        const totalItems = w.checklistItems.length;
        const completedItems = w.checklistItems.filter((i) => i.isCompleted).length;
        const completenessPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;

        return {
          id: w.id,
          waqfType: w.waqfType,
          estimatedValueRupiah: w.estimatedValueRupiah ? Number(w.estimatedValueRupiah) : null,
          currentStage: w.currentStage,
          openedAt: w.openedAt,
          completedAt: w.completedAt,
          notesSummary: w.notesSummary,
          agingDays,
          checklistProgress: {
            total: totalItems,
            completed: completedItems,
            percentage: completenessPercent,
          },
          person: w.person || null,
          owner: w.owner || null,
          checklistItems: w.checklistItems,
          stageHistories: w.stageHistories.map((h) => ({
            id: h.id,
            fromStage: h.fromStage,
            toStage: h.toStage,
            reason: h.reason,
            changedAt: h.changedAt,
            changerName: h.changer?.fullName || 'Staf',
          })),
        };
      });

      return successResponse(formatted, { requestId: ctx.requestId, total: formatted.length, stats });
    })
  );

  // POST /api/waqf (Initiate Waqf Case + Init Checklists + Auto-assign role 'wakif')
  router.post(
    '/api/waqf',
    requireAuth(
      requirePermission(
        PERMISSIONS.WAQF_CREATE,
        validateBody(createWaqfSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const result = await db.transaction(async (tx) => {
            // 1. Insert Waqf Case
            const [newCase] = await tx
              .insert(waqfCases)
              .values({
                personId: body.personId,
                waqfType: body.waqfType,
                estimatedValueRupiah: body.estimatedValueRupiah ? BigInt(body.estimatedValueRupiah) : null,
                currentStage: 'interested',
                ownerUserId: user.id,
                notesSummary: body.notesSummary || null,
                createdBy: user.id,
              })
              .returning();

            if (!newCase) {
              throw new Error('Gagal menginisiasi kasus wakaf');
            }

            // 2. Auto-assign role 'wakif' to person
            const existingRole = await tx.query.personRoles.findFirst({
              where: and(
                eq(personRoles.personId, body.personId),
                eq(personRoles.roleCode, 'wakif')
              ),
            });

            if (!existingRole) {
              await tx.insert(personRoles).values({
                personId: body.personId,
                roleCode: 'wakif',
              });
            }

            // 3. Initialize Standard Checklist Items
            const defaultChecklists = [
              { itemCode: 'ktp_wakif', label: 'Salinan KTP & KK Wakif', isRequired: true },
              { itemCode: 'legal_ownership', label: 'Bukti Kepemilikan Sah / Sertifikat Hak Milik', isRequired: true },
              { itemCode: 'draft_aiw', label: 'Draf Akta Ikrar Wakaf (AIW) & Saksi', isRequired: true },
              { itemCode: 'nazhir_minutes', label: 'Berita Acara Nazhir & Peruntukan Manfaat', isRequired: true },
            ];

            await tx.insert(waqfChecklistItems).values(
              defaultChecklists.map((c) => ({
                waqfCaseId: newCase.id,
                itemCode: c.itemCode,
                label: c.label,
                isRequired: c.isRequired,
                isCompleted: false,
              }))
            );

            // 4. Initial Stage History & Audit
            await tx.insert(waqfStageHistory).values({
              waqfCaseId: newCase.id,
              fromStage: null,
              toStage: 'interested',
              reason: 'Inisiasi amanah wakaf baru',
              changedBy: user.id,
            });

            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'create_waqf_case',
              entityType: 'waqf_case',
              entityId: newCase.id,
              afterJson: {
                personId: body.personId,
                waqfType: body.waqfType,
                estimatedValueRupiah: body.estimatedValueRupiah,
                stage: 'interested',
              },
              reason: 'Inisiasi kasus wakaf baru',
              requestId: ctx.requestId,
            });

            return newCase;
          });

          cachedWaqfStats = null;

          return successResponse(
            { ...result, estimatedValueRupiah: result.estimatedValueRupiah ? Number(result.estimatedValueRupiah) : null },
            { requestId: ctx.requestId },
            201
          );
        })
      )
    )
  );

  // POST /api/waqf/:id/transition (Server-side 6-Step Stage Transition)
  router.post(
    '/api/waqf/:id/transition',
    requireAuth(
      requirePermission(
        PERMISSIONS.WAQF_TRANSITION,
        validateBody(transitionStageSchema, async (ctx, body) => {
          const db = getDb();
          const caseId = ctx.params.id;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          if (!caseId) return errorResponse('VALIDATION_ERROR', 'ID Kasus Wakaf diperlukan', 400, ctx.requestId);

          // Atomic Transaction for Stage Transition
          const transitionResult = await db.transaction(async (tx) => {
            // 1. Read current waqf case
            const current = await tx.query.waqfCases.findFirst({
              where: eq(waqfCases.id, caseId),
            });

            if (!current) {
              throw new Error('NOT_FOUND: Kasus Wakaf tidak ditemukan');
            }

            const fromStage = current.currentStage;
            const toStage = body.toStage;
            const now = new Date();

            // 2. Update Case Stage
            const [updatedCase] = await tx
              .update(waqfCases)
              .set({
                currentStage: toStage,
                completedAt: toStage === 'completed' ? now : current.completedAt,
                updatedAt: now,
              })
              .where(eq(waqfCases.id, caseId))
              .returning();

            // 3. Update Checklist Items if provided
            if (body.checklistUpdates && body.checklistUpdates.length > 0) {
              for (const update of body.checklistUpdates) {
                await tx
                  .update(waqfChecklistItems)
                  .set({
                    isCompleted: update.isCompleted,
                    completedBy: update.isCompleted ? user.id : null,
                    completedAt: update.isCompleted ? now : null,
                  })
                  .where(and(eq(waqfChecklistItems.id, update.itemId), eq(waqfChecklistItems.waqfCaseId, caseId)));
              }
            }

            // 4. Record Stage History
            const [stageHistoryEntry] = await tx
              .insert(waqfStageHistory)
              .values({
                waqfCaseId: caseId,
                fromStage,
                toStage,
                reason: body.reason,
                changedBy: user.id,
              })
              .returning();

            // 5. Create Audit Log
            await tx.insert(auditLogs).values({
              actorUserId: user.id,
              action: 'transition_waqf_stage',
              entityType: 'waqf_case',
              entityId: caseId,
              beforeJson: { stage: fromStage },
              afterJson: { stage: toStage, reason: body.reason },
              reason: body.reason,
              requestId: ctx.requestId,
            });

            // 6. Optional Follow-up Task Creation
            let createdTask = null;
            if (body.nextAction && body.nextAction.trim()) {
              const defaultDue = new Date();
              defaultDue.setDate(defaultDue.getDate() + 3); // Default H+3
              const taskDue = body.taskDueAt ? new Date(body.taskDueAt) : defaultDue;

              const [newTask] = await tx
                .insert(tasks)
                .values({
                  personId: current.personId,
                  title: `Wakaf [${toStage.toUpperCase()}]: ${body.nextAction.trim()}`,
                  description: `Dibuat dari transisi tahap wakaf ${fromStage} -> ${toStage}. Alasan: ${body.reason}`,
                  status: 'pending',
                  priority: body.taskPriority,
                  dueAt: taskDue,
                  ownerUserId: user.id,
                  assignedBy: user.id,
                  relatedType: 'waqf_case',
                  relatedId: caseId,
                })
                .returning();

              createdTask = newTask;
            }

            return {
              case: updatedCase,
              stageHistory: stageHistoryEntry,
              createdTask,
            };
          });

          if (!transitionResult.case) {
            return errorResponse('INTERNAL_ERROR', 'Gagal memperbarui status kasus wakaf', 500, ctx.requestId);
          }

          cachedWaqfStats = null;

          return successResponse(
            {
              ...transitionResult.case,
              estimatedValueRupiah: transitionResult.case.estimatedValueRupiah
                ? Number(transitionResult.case.estimatedValueRupiah)
                : null,
              createdTask: transitionResult.createdTask,
            },
            { requestId: ctx.requestId }
          );
        })
      )
    )
  );

  // PATCH /api/waqf/:id/checklist/:itemId (Toggle single checklist item)
  router.patch(
    '/api/waqf/:id/checklist/:itemId',
    requireAuth(
      requirePermission(
        PERMISSIONS.WAQF_EDIT,
        validateBody(toggleChecklistSchema, async (ctx, body) => {
          const db = getDb();
          const { id: caseId, itemId } = ctx.params;
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
          if (!caseId || !itemId) return errorResponse('VALIDATION_ERROR', 'ID tidak lengkap', 400, ctx.requestId);

          const now = new Date();
          const [updated] = await db
            .update(waqfChecklistItems)
            .set({
              isCompleted: body.isCompleted,
              completedBy: body.isCompleted ? user.id : null,
              completedAt: body.isCompleted ? now : null,
            })
            .where(and(eq(waqfChecklistItems.id, itemId), eq(waqfChecklistItems.waqfCaseId, caseId)))
            .returning();

          if (!updated) {
            return errorResponse('NOT_FOUND', 'Item checklist tidak ditemukan', 404, ctx.requestId);
          }

          return successResponse(updated, { requestId: ctx.requestId });
        })
      )
    )
  );

  // GET /api/waqf/:id/documents (List Legal Documents with Temporary Signed URLs)
  router.get(
    '/api/waqf/:id/documents',
    requireAuth(
      requirePermission(PERMISSIONS.WAQF_VIEW_DETAIL, async (ctx) => {
        const db = getDb();
        const caseId = ctx.params.id;
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
        if (!caseId) return errorResponse('VALIDATION_ERROR', 'ID tidak lengkap', 400, ctx.requestId);

        const docs = await db.query.waqfDocuments.findMany({
          where: eq(waqfDocuments.waqfCaseId, caseId),
          orderBy: [desc(waqfDocuments.createdAt)],
          with: {
            uploader: {
              columns: {
                id: true,
                fullName: true,
              },
            },
          },
        });

        const formatted = await Promise.all(
          docs.map(async (doc) => {
            let signedUrl: string | null = null;
            try {
              const urlResult = await defaultAttachmentService.getTemporaryUrl(doc.attachmentId, {
                requestingUserId: user.id,
                expiresInSeconds: 900,
                requestId: ctx.requestId,
              });
              signedUrl = urlResult.url;
            } catch {
              // fallback
            }

            return {
              id: doc.id,
              documentType: doc.documentType,
              versionNo: doc.versionNo,
              isSensitive: doc.isSensitive,
              attachmentId: doc.attachmentId,
              createdAt: doc.createdAt,
              uploader: doc.uploader || null,
              signedUrl,
            };
          })
        );

        return successResponse(formatted, { requestId: ctx.requestId });
      })
    )
  );

  // POST /api/waqf/:id/documents (Attach Document from Attachment ID)
  router.post(
    '/api/waqf/:id/documents',
    requireAuth(
      requirePermission(
        PERMISSIONS.WAQF_DOCUMENTS_MANAGE,
        validateBody(
          z.object({
            attachmentId: z.string().uuid('ID Lampiran wajib valid'),
            documentType: z.string().min(2, 'Tipe dokumen wajib diisi'),
            isSensitive: z.boolean().default(true),
          }),
          async (ctx, body) => {
            const db = getDb();
            const caseId = ctx.params.id;
            const user = ctx.user;
            if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);
            if (!caseId) return errorResponse('VALIDATION_ERROR', 'ID tidak lengkap', 400, ctx.requestId);

            const [created] = await db
              .insert(waqfDocuments)
              .values({
                waqfCaseId: caseId,
                attachmentId: body.attachmentId,
                documentType: body.documentType,
                isSensitive: body.isSensitive,
                uploadedBy: user.id,
              })
              .returning();

            return successResponse(created, { requestId: ctx.requestId }, 201);
          }
        )
      )
    )
  );
}
