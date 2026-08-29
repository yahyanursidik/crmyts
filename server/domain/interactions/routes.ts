import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, requirePermission, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { interactions, tasks, auditLogs } from '../../db/schema';
import { eq, desc, and, sql, ilike, or } from 'drizzle-orm';
import { PERMISSIONS } from '../../permissions/constants';

export const OUTCOME_OPTIONS = [
  'sudah_dihubungi',
  'tidak_merespons',
  'minta_dihubungi_kembali',
  'berminat',
  'belum_berminat',
  'selesai',
  'perlu_eskalasi',
] as const;

export type OutcomeCode = (typeof OUTCOME_OPTIONS)[number];

const createInteractionSchema = z.object({
  personId: z.string().uuid('ID Jamaah wajib dipilih'),
  channel: z.enum(['whatsapp', 'phone_call', 'in_person', 'telegram', 'email', 'other']),
  summary: z.string().min(3, 'Ringkasan interaksi minimal 3 karakter'),
  outcome: z.enum(OUTCOME_OPTIONS).default('sudah_dihubungi'),
  sensitivityLevel: z.enum(['standard', 'confidential', 'restricted']).default('standard'),
  occurredAt: z.string().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  taskDueAt: z.string().optional().nullable(),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

let cachedInteractionsStats: { data: any; timestamp: number } | null = null;
const STATS_CACHE_TTL_MS = 60_000;

export function registerInteractionsRoutes(router: Router) {
  // GET /api/interactions
  router.get(
    '/api/interactions',
    requireAuth(async (ctx) => {
      const db = getDb();

      const page = Math.max(1, parseInt(ctx.query.page || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize || '20', 10)));
      const offset = (page - 1) * pageSize;

      const search = ctx.query.search?.trim();
      const personId = ctx.query.personId?.trim();
      const channel = ctx.query.channel?.trim();
      const outcome = ctx.query.outcome?.trim();
      const sensitivityLevel = ctx.query.sensitivityLevel?.trim();
      const ownerUserId = ctx.query.ownerUserId?.trim();

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(interactions.summary, `%${search}%`),
            sql`EXISTS (SELECT 1 FROM people WHERE people.id = ${interactions.personId} AND (people.full_name ILIKE ${'%' + search + '%'} OR people.phone_e164 ILIKE ${'%' + search + '%'}))`
          )
        );
      }
      if (personId) conditions.push(eq(interactions.personId, personId));
      if (channel) conditions.push(eq(interactions.channel, channel as any));
      if (outcome) conditions.push(eq(interactions.outcome, outcome));
      if (sensitivityLevel) conditions.push(eq(interactions.sensitivityLevel, sensitivityLevel));
      if (ownerUserId) conditions.push(eq(interactions.ownerUserId, ownerUserId));

      const combinedWhere = conditions.length > 0 ? and(...conditions) : undefined;

      // Count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(interactions)
        .where(combinedWhere);

      const totalCount = countResult?.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const list = await db.query.interactions.findMany({
        where: combinedWhere,
        orderBy: [desc(interactions.occurredAt)],
        limit: pageSize,
        offset,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
              cityRegency: true,
              engagementStatus: true,
            },
          },
          owner: {
            columns: {
              id: true,
              fullName: true,
            },
          },
          creator: {
            columns: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      // Quick Stats with caching
      let stats = {
        totalAll: totalCount,
        todayCount: 0,
        needFollowUpCount: 0,
        positiveOutcomeCount: 0,
      };

      const nowTime = Date.now();
      if (cachedInteractionsStats && nowTime - cachedInteractionsStats.timestamp < STATS_CACHE_TTL_MS) {
        stats = cachedInteractionsStats.data;
      } else {
        try {
          const [statsRes] = await db
            .select({
              totalAll: sql<number>`(SELECT count(*)::int FROM "interactions")`,
              todayCount: sql<number>`(SELECT count(*)::int FROM "interactions" WHERE "occurred_at" >= CURRENT_DATE)`,
              needFollowUpCount: sql<number>`(SELECT count(*)::int FROM "interactions" WHERE "outcome" IN ('minta_dihubungi_kembali', 'perlu_eskalasi', 'tidak_merespons'))`,
              positiveOutcomeCount: sql<number>`(SELECT count(*)::int FROM "interactions" WHERE "outcome" IN ('berminat', 'selesai'))`,
            })
            .from(sql`(SELECT 1) dummy`);

          if (statsRes) {
            stats = statsRes;
            cachedInteractionsStats = { data: statsRes, timestamp: nowTime };
          }
        } catch (err) {
          console.warn('[Interactions Stats Query Warn]:', err);
        }
      }

      return successResponse(list, {
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

  // POST /api/interactions (Atomic Transaction + Follow-Up Task + Audit Logger)
  router.post(
    '/api/interactions',
    requireAuth(
      requirePermission(
        PERMISSIONS.INTERACTIONS_CREATE,
        validateBody(createInteractionSchema, async (ctx, body) => {
          const db = getDb();
          const user = ctx.user;
          if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

          const occurredAtDate = body.occurredAt ? new Date(body.occurredAt) : new Date();
          const targetOwnerId = body.ownerUserId || user.id;

          // Atomic Database Transaction
          const result = await db.transaction(async (tx) => {
            // 1. Insert interaction log
            const [newInteraction] = await tx
              .insert(interactions)
              .values({
                personId: body.personId,
                channel: body.channel,
                summary: body.summary,
                outcome: body.outcome,
                sensitivityLevel: body.sensitivityLevel,
                ownerUserId: targetOwnerId,
                occurredAt: occurredAtDate,
                createdBy: user.id,
              })
              .returning();

            if (!newInteraction) {
              throw new Error('Gagal mencatat interaksi ke database');
            }

            // 2. If nextAction is filled, atomically create task
            let createdTask = null;
            if (body.nextAction && body.nextAction.trim()) {
              const defaultDue = new Date();
              defaultDue.setDate(defaultDue.getDate() + 2); // Default H+2
              const taskDueDate = body.taskDueAt ? new Date(body.taskDueAt) : defaultDue;

              const [newTask] = await tx
                .insert(tasks)
                .values({
                  personId: body.personId,
                  title: `Follow-up: ${body.nextAction.trim()}`,
                  description: `Dihasilkan otomatis dari interaksi [${body.channel.toUpperCase()}]: ${body.summary}`,
                  status: 'pending',
                  priority: body.taskPriority,
                  dueAt: taskDueDate,
                  ownerUserId: targetOwnerId,
                  assignedBy: user.id,
                })
                .returning();

              createdTask = newTask;
            }

            // 3. If sensitivity is confidential or restricted, record immutable audit log
            if (body.sensitivityLevel === 'confidential' || body.sensitivityLevel === 'restricted') {
              await tx.insert(auditLogs).values({
                actorUserId: user.id,
                action: 'create_sensitive_interaction',
                entityType: 'interaction',
                entityId: newInteraction.id,
                afterJson: {
                  personId: body.personId,
                  channel: body.channel,
                  summary: body.summary,
                  outcome: body.outcome,
                  sensitivityLevel: body.sensitivityLevel,
                },
                reason: `Pencatatan interaksi dengan tingkat sensitivitas tinggi (${body.sensitivityLevel})`,
                requestId: ctx.requestId,
              });
            }

            return {
              interaction: newInteraction,
              createdTask,
            };
          });

          return successResponse(result, { requestId: ctx.requestId }, 201);
        })
      )
    )
  );

  // DELETE /api/interactions/:id
  router.delete(
    '/api/interactions/:id',
    requireAuth(async (ctx) => {
      const db = getDb();
      const id = ctx.params?.id;
      if (!id) return errorResponse('VALIDATION_ERROR', 'ID Interaksi diperlukan', 400, ctx.requestId);

      await db.delete(interactions).where(eq(interactions.id, id));
      cachedInteractionsStats = null;
      return successResponse({ success: true }, { requestId: ctx.requestId });
    })
  );
}
