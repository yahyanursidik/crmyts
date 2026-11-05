import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  interactions,
  tasks,
  persons,
  events,
  eventAttendance,
  appUsers,
  auditLogs,
  jamaahRoomEntries,
  jamaahRoomActivity,
} from "../../db/schema";
import {
  type RequestContext,
  type Handler,
  requirePermission,
} from "../../http/middleware";
import { successResponse, errorResponse } from "../../http/response";
import { hasPermission, PERMISSIONS as P } from "../../permissions/constants";
import {
  interactionVisibility,
  linkedInteractionTaskVisibility,
} from "./visibility";
import {
  INTERACTION_CHANNELS,
  INTERACTION_OUTCOMES,
  validInteractionInstant,
  interactionTaskType,
} from "../../../src/lib/interactionModel";
import { taskStatsCache } from "../tasks/cache";
export const OUTCOME_OPTIONS = INTERACTION_OUTCOMES;
const instant = z
  .string()
  .datetime({ offset: true })
  .refine(validInteractionInstant, "Tanggal dan waktu tidak valid.");
const fields = {
  channel: z.enum(INTERACTION_CHANNELS),
  summary: z.string().trim().min(3, "Ringkasan minimal 3 karakter.").max(4000),
  outcome: z.string().trim().max(300).nullable().optional(),
  sensitivityLevel: z.enum(["standard", "confidential", "restricted"]),
  occurredAt: instant.nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
};
export const createInteractionSchema = z.object({
  ...fields,
  personId: z.string().uuid(),
  sensitivityLevel: fields.sensitivityLevel.default("standard"),
  ownerUserId: z.string().uuid().nullable().optional(),
  createFollowUpTask: z.boolean().optional(),
  nextAction: z.string().trim().max(300).nullable().optional(),
  taskDueAt: instant.nullable().optional(),
  taskPriority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});
export const correctInteractionSchema = z
  .object(fields)
  .partial()
  .extend({
    occurredAt: instant.optional(),
    reason: z.string().trim().min(3, "Isi alasan koreksi.").max(500),
  });
export const interactionReasonSchema = z.object({
  reason: z.string().trim().min(3, "Isi alasan minimal 3 karakter.").max(500),
});
export class InteractionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Actor = NonNullable<RequestContext["user"]>;
export const mayManageInteraction = (user: Actor, row: { createdBy: string }) =>
  hasPermission(user.roles, P.INTERACTIONS_CREATE) &&
  (row.createdBy === user.id || hasPermission(user.roles, P.SYSTEM_CONFIGURE));
export const mayUseEventContext = (user: Actor) =>
  hasPermission(user.roles, P.EVENTS_VIEW) ||
  hasPermission(user.roles, P.ATTENDANCE_VIEW_SUMMARY);
export function interactionOperation(
  permission: Parameters<typeof requirePermission>[0],
  operation: (ctx: RequestContext) => Promise<unknown>,
  status = 200,
): Handler {
  return requirePermission(permission, async (ctx) => {
    if (ctx.params.id && !z.string().uuid().safeParse(ctx.params.id).success)
      return errorResponse(
        "VALIDATION_ERROR",
        "ID tidak valid.",
        400,
        ctx.requestId,
      );
    try {
      const result: any = await operation(ctx);
      return result?.statusCode && typeof result.body === "string"
        ? result
        : successResponse(result, { requestId: ctx.requestId }, status);
    } catch (e) {
      if (e instanceof InteractionError)
        return errorResponse(
          e.status === 403
            ? "FORBIDDEN"
            : e.status === 404
              ? "NOT_FOUND"
              : e.status === 409
                ? "CONFLICT"
                : "VALIDATION_ERROR",
          e.message,
          e.status,
          ctx.requestId,
        );
      const code = (e as any)?.cause?.code || (e as any)?.code;
      if (["55P03", "40P01"].includes(code))
        return errorResponse(
          "CONFLICT",
          "Data sedang diperbarui. Muat ulang dan coba kembali.",
          409,
          ctx.requestId,
        );
      throw e;
    }
  });
}
function parsed<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new InteractionError(
      result.error.issues[0]?.message || "Data tidak valid.",
    );
  return result.data;
}
export async function validateInteractionOwner(db: any, id: string) {
  const owner = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.id, id), eq(appUsers.isActive, true)),
    with: { userRoles: { with: { role: true } } },
  });
  const roles = (owner?.userRoles || []).map((row: any) => row.role.code);
  if (
    !owner ||
    !hasPermission(roles, P.INTERACTIONS_VIEW) ||
    !hasPermission(roles, P.TASKS_VIEW_OWN)
  )
    throw new InteractionError(
      "Pilih staf aktif yang dapat mengelola interaksi dan tugas.",
    );
  return owner;
}
async function validateEventContext(
  db: any,
  eventId: string,
  user: Actor,
  personId: string,
) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  if (!event) throw new InteractionError("Event tidak ditemukan.", 404);
  if (
    !hasPermission(user.roles, P.EVENTS_VIEW) &&
    event.status !== "scheduled"
  ) {
    const attended = await db.query.eventAttendance.findFirst({
      where: and(
        eq(eventAttendance.eventId, eventId),
        eq(eventAttendance.personId, personId),
      ),
    });
    if (!attended)
      throw new InteractionError(
        "Konteks event tidak tersedia untuk peran Anda.",
        403,
      );
  }
}
async function audit(
  tx: any,
  ctx: RequestContext,
  action: string,
  id: string,
  before: unknown,
  after: unknown,
  reason: string,
) {
  await tx.insert(auditLogs).values({
    actorUserId: ctx.user!.id,
    action,
    entityType: "interaction",
    entityId: id,
    beforeJson: before,
    afterJson: after,
    reason,
    requestId: ctx.requestId,
  });
}
export async function createInteraction(
  ctx: RequestContext,
  personId?: string,
) {
  const body = parsed(createInteractionSchema, {
    ...(ctx.body as object),
    ...(personId
      ? {
          personId,
          createFollowUpTask: (ctx.body as any)?.createFollowUpTask ?? false,
        }
      : {}),
  });
  const user = ctx.user!,
    ownerId = body.ownerUserId || user.id;
  const makeTask = body.createFollowUpTask ?? !!body.nextAction?.trim();
  if (ownerId !== user.id && !hasPermission(user.roles, P.TASKS_REASSIGN))
    throw new InteractionError(
      "Penugasan ke staf lain memerlukan izin administrator.",
      403,
    );
  if (makeTask && !hasPermission(user.roles, P.TASKS_CREATE))
    throw new InteractionError("Izin membuat tugas diperlukan.", 403);
  if (makeTask && !body.nextAction?.trim())
    throw new InteractionError("Isi tindakan untuk tugas tindak lanjut.");
  if (body.eventId && !mayUseEventContext(user))
    throw new InteractionError(
      "Izin melihat konteks kegiatan diperlukan.",
      403,
    );
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (+occurredAt > Date.now() + 300000)
    throw new InteractionError("Waktu interaksi belum terjadi.");
  const dueAt = body.taskDueAt
    ? new Date(body.taskDueAt)
    : new Date(Date.now() + 172800000);
  if (makeTask && +dueAt < +occurredAt)
    throw new InteractionError("Tenggat tugas harus setelah waktu interaksi.");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    await tx.execute(
      sql`SELECT id FROM persons WHERE id=${body.personId} FOR UPDATE`,
    );
    const person = await tx.query.persons.findFirst({
      where: eq(persons.id, body.personId),
    });
    if (!person) throw new InteractionError("Jamaah tidak ditemukan.", 404);
    if (!person.isActive)
      throw new InteractionError(
        "Jamaah diarsipkan. Pulihkan profil sebelum mencatat interaksi.",
        409,
      );
    await validateInteractionOwner(tx, ownerId);
    if (body.eventId)
      await validateEventContext(tx, body.eventId, user, body.personId);
    const [interaction] = await tx
      .insert(interactions)
      .values({
        personId: body.personId,
        eventId: body.eventId || null,
        channel: body.channel,
        summary: body.summary,
        outcome: body.outcome || null,
        sensitivityLevel: body.sensitivityLevel,
        ownerUserId: ownerId,
        occurredAt,
        createdBy: user.id,
      })
      .returning();
    let createdTask = null;
    if (makeTask) {
      [createdTask] = await tx
        .insert(tasks)
        .values({
          personId: body.personId,
          relatedType: "interaction",
          relatedId: interaction!.id,
          title: "Follow-up: " + body.nextAction!.trim(),
          description: `[TYPE:${interactionTaskType(body.channel)}] Tindak lanjut dari interaksi. Buka catatan asal untuk konteks.`,
          status: "pending",
          priority: body.taskPriority,
          dueAt,
          ownerUserId: ownerId,
          assignedBy: user.id,
        })
        .returning();
    }
    await audit(
      tx,
      ctx,
      body.sensitivityLevel === "standard"
        ? "create_interaction"
        : "create_sensitive_interaction",
      interaction!.id,
      null,
      {
        personId: body.personId,
        eventId: body.eventId || null,
        channel: body.channel,
        sensitivityLevel: body.sensitivityLevel,
        taskId: createdTask?.id || null,
      },
      "Pencatatan interaksi dan tindak lanjut",
    );
    taskStatsCache.clear();
    return { interaction, createdTask };
  });
}
export const createInteractionHandler: Handler = interactionOperation(
  P.INTERACTIONS_CREATE,
  (ctx) => createInteraction(ctx),
  201,
);
export const createPersonInteractionHandler: Handler = interactionOperation(
  P.INTERACTIONS_CREATE,
  (ctx) => createInteraction(ctx, ctx.params.id),
  201,
);
export async function addInteractionFollowup(ctx: RequestContext) {
  const body = parsed(
    z.object({
      nextAction: z.string().trim().min(3).max(300),
      taskDueAt: instant,
      taskPriority: z
        .enum(["low", "medium", "high", "urgent"])
        .default("medium"),
    }),
    ctx.body,
  );
  if (!hasPermission(ctx.user!.roles, P.TASKS_CREATE))
    throw new InteractionError("Izin membuat tugas diperlukan.", 403);
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM interactions WHERE id=${ctx.params.id} FOR UPDATE`,
    );
    const row = await tx.query.interactions.findFirst({
      where: and(
        eq(interactions.id, ctx.params.id!),
        interactionVisibility(ctx.user!.roles, ctx.user!.id),
      ),
    });
    if (!row) throw new InteractionError("Interaksi tidak ditemukan.", 404);
    if (!mayManageInteraction(ctx.user!, row))
      throw new InteractionError(
        "Hanya pencatat atau administrator yang dapat menambah tindak lanjut.",
        403,
      );
    if (row.archivedAt)
      throw new InteractionError(
        "Pulihkan catatan sebelum menambah tugas.",
        409,
      );
    const person = await tx.query.persons.findFirst({
      where: eq(persons.id, row.personId),
    });
    if (!person?.isActive)
      throw new InteractionError(
        "Jamaah diarsipkan. Pulihkan profil sebelum menambah tugas.",
        409,
      );
    if (+new Date(body.taskDueAt) < +row.occurredAt)
      throw new InteractionError("Tenggat tugas harus setelah interaksi.");
    const ownerId = row.ownerUserId || ctx.user!.id;
    if (
      ownerId !== ctx.user!.id &&
      !hasPermission(ctx.user!.roles, P.TASKS_REASSIGN)
    )
      throw new InteractionError("Tindak lanjut berada pada PIC lain.", 403);
    await validateInteractionOwner(tx, ownerId);
    const existing = await tx.query.tasks.findFirst({
      where: and(
        eq(tasks.relatedType, "interaction"),
        eq(tasks.relatedId, row.id),
        sql`${tasks.status} IN ('pending','in_progress','waiting')`,
      ),
    });
    if (existing)
      throw new InteractionError(
        "Tugas tindak lanjut masih aktif. Selesaikan atau batalkan tugas tersebut dahulu.",
        409,
      );
    const [task] = await tx
      .insert(tasks)
      .values({
        personId: row.personId,
        relatedType: "interaction",
        relatedId: row.id,
        title: "Follow-up: " + body.nextAction,
        description: `[TYPE:${interactionTaskType(row.channel)}] Tindak lanjut dari interaksi. Buka catatan asal untuk konteks.`,
        status: "pending",
        priority: body.taskPriority,
        dueAt: new Date(body.taskDueAt),
        ownerUserId: ownerId,
        assignedBy: ctx.user!.id,
      })
      .returning();
    await audit(
      tx,
      ctx,
      "create_interaction_followup",
      row.id,
      null,
      { taskId: task!.id, ownerUserId: ownerId },
      "Tindak lanjut dari interaksi tersimpan",
    );
    taskStatsCache.clear();
    return task;
  });
}
export async function changeTaskStatus(
  ctx: RequestContext,
  status: "pending" | "in_progress" | "waiting" | "completed" | "cancelled",
) {
  const taskId = ctx.params.id!;
  if (!z.string().uuid().safeParse(taskId).success)
    throw new InteractionError("ID tugas tidak valid.");
  const db = getDb(),
    user = ctx.user!;
  const initial = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.id, taskId),
      hasPermission(user.roles, P.TASKS_VIEW_ALL)
        ? undefined
        : eq(tasks.ownerUserId, user.id),
      linkedInteractionTaskVisibility(user.roles, user.id),
    ),
  });
  if (!initial) throw new InteractionError("Tugas tidak ditemukan.", 404);
  return db.transaction(async (tx) => {
    if (initial.relatedType === "interaction" && initial.relatedId)
      await tx.execute(
        sql`SELECT id FROM interactions WHERE id=${initial.relatedId} FOR UPDATE`,
      );
    if (initial.relatedType === "jamaah_room_entry" && initial.relatedId)
      await tx.execute(
        sql`SELECT id FROM jamaah_room_entries WHERE id=${initial.relatedId} FOR UPDATE`,
      );
    await tx.execute(sql`SELECT id FROM tasks WHERE id=${taskId} FOR UPDATE`);
    const current = await tx.query.tasks.findFirst({
      where: and(
        eq(tasks.id, taskId),
        hasPermission(user.roles, P.TASKS_VIEW_ALL)
          ? undefined
          : eq(tasks.ownerUserId, user.id),
        linkedInteractionTaskVisibility(user.roles, user.id),
      ),
    });
    if (!current) throw new InteractionError("Tugas tidak ditemukan.", 404);
    if (current.status === status) return current;
    if (
      ["interaction", "jamaah_room_entry"].includes(
        current.relatedType || "",
      ) &&
      current.relatedId &&
      ["pending", "in_progress", "waiting"].includes(status)
    ) {
      const another = await tx.query.tasks.findFirst({
        where: and(
          eq(tasks.relatedType, current.relatedType!),
          eq(tasks.relatedId, current.relatedId),
          sql`${tasks.id}<>${taskId}`,
          sql`${tasks.status} IN ('pending','in_progress','waiting')`,
        ),
      });
      if (another)
        throw new InteractionError(
          "Pesan asal sudah memiliki tugas aktif lainnya.",
          409,
        );
    }
    if (current.relatedType === "jamaah_room_entry" && current.relatedId) {
      const source = await tx.query.jamaahRoomEntries.findFirst({
        where: eq(jamaahRoomEntries.id, current.relatedId),
      });
      if (!source)
        throw new InteractionError("Pesan asal tidak ditemukan.", 404);
      if (
        ["pending", "in_progress", "waiting"].includes(status) &&
        (source.archivedAt ||
          source.status === "closed" ||
          source.ownerUserId !== current.ownerUserId)
      )
        throw new InteractionError(
          "Buka kembali pesan dan samakan PIC sebelum memulihkan tugas.",
          409,
        );
      await tx
        .insert(jamaahRoomActivity)
        .values({
          entryId: source.id,
          actorUserId: user.id,
          action: "task_status_changed",
          details: { previousStatus: current.status, status },
          taskId,
        });
      await tx
        .update(jamaahRoomEntries)
        .set({ updatedAt: new Date(), updatedBy: user.id })
        .where(eq(jamaahRoomEntries.id, source.id));
    }
    const [updated] = await tx
      .update(tasks)
      .set({
        status,
        completedAt: status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: "update_task_status",
      entityType: "task",
      entityId: taskId,
      beforeJson: {
        status: current.status,
        completedAt: current.completedAt,
      },
      afterJson: {
        status,
        completedAt: updated!.completedAt,
        interactionId:
          current.relatedType === "interaction" ? current.relatedId : null,
      },
      reason: "Perubahan status tindak lanjut",
      requestId: ctx.requestId,
    });
    taskStatsCache.clear();
    return updated;
  });
}
export async function moveInteractionTask(
  ctx: RequestContext,
  taskId: string,
  newOwnerId: string,
  reason: string,
) {
  return getDb().transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    if (!task || task.relatedType !== "interaction" || !task.relatedId)
      throw new InteractionError("Tugas interaksi tidak ditemukan.", 404);
    await tx.execute(
      sql`SELECT id FROM interactions WHERE id=${task.relatedId} FOR UPDATE`,
    );
    await tx.execute(sql`SELECT id FROM tasks WHERE id=${taskId} FOR UPDATE`);
    const current = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    if (
      !current ||
      !["pending", "in_progress", "waiting"].includes(current.status)
    )
      throw new InteractionError(
        "Hanya tugas aktif yang dapat dipindahkan.",
        409,
      );
    await validateInteractionOwner(tx, newOwnerId);
    const [updated] = await tx
      .update(tasks)
      .set({
        ownerUserId: newOwnerId,
        assignedBy: ctx.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    await tx
      .update(interactions)
      .set({ ownerUserId: newOwnerId, updatedAt: new Date() })
      .where(eq(interactions.id, task.relatedId));
    await audit(
      tx,
      ctx,
      "reassign_interaction_followup",
      task.relatedId,
      { taskId, ownerUserId: current.ownerUserId },
      { taskId, ownerUserId: newOwnerId },
      reason,
    );
    taskStatsCache.clear();
    return updated;
  });
}
export async function correctInteraction(ctx: RequestContext) {
  const body = parsed(correctInteractionSchema, ctx.body),
    { reason, ...values } = body;
  if (!Object.keys(values).length)
    throw new InteractionError("Pilih data yang dikoreksi.");
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM interactions WHERE id=${ctx.params.id} FOR UPDATE`,
    );
    const current = await tx.query.interactions.findFirst({
      where: and(
        eq(interactions.id, ctx.params.id!),
        interactionVisibility(ctx.user!.roles, ctx.user!.id),
      ),
    });
    if (!current) throw new InteractionError("Interaksi tidak ditemukan.", 404);
    if (!mayManageInteraction(ctx.user!, current))
      throw new InteractionError(
        "Hanya pencatat atau administrator yang dapat mengoreksi catatan.",
        403,
      );
    if (current.archivedAt)
      throw new InteractionError(
        "Pulihkan arsip sebelum melakukan koreksi.",
        409,
      );
    if (values.eventId && !mayUseEventContext(ctx.user!))
      throw new InteractionError("Izin konteks event diperlukan.", 403);
    if (values.eventId)
      await validateEventContext(
        tx,
        values.eventId,
        ctx.user!,
        current.personId,
      );
    if (values.occurredAt && +new Date(values.occurredAt) > Date.now() + 300000)
      throw new InteractionError("Waktu interaksi belum terjadi.");
    const { occurredAt: correctedTime, ...correctedFields } = values;
    const [updated] = await tx
      .update(interactions)
      .set({
        ...correctedFields,
        ...(correctedTime ? { occurredAt: new Date(correctedTime) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(interactions.id, current.id))
      .returning();
    const restricted =
      current.sensitivityLevel !== "standard" ||
      updated!.sensitivityLevel !== "standard";
    const snapshot = (row: any) =>
      restricted
        ? {
            id: row.id,
            eventId: row.eventId,
            channel: row.channel,
            sensitivityLevel: row.sensitivityLevel,
            occurredAt: row.occurredAt,
            changedFields: Object.keys(values),
          }
        : row;
    await audit(
      tx,
      ctx,
      "correct_interaction",
      current.id,
      snapshot(current),
      snapshot(updated),
      reason,
    );
    return updated;
  });
}
export async function archiveInteraction(ctx: RequestContext, restore = false) {
  const { reason } = parsed(interactionReasonSchema, ctx.body);
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM interactions WHERE id=${ctx.params.id} FOR UPDATE`,
    );
    const current = await tx.query.interactions.findFirst({
      where: and(
        eq(interactions.id, ctx.params.id!),
        interactionVisibility(ctx.user!.roles, ctx.user!.id),
      ),
    });
    if (!current) throw new InteractionError("Interaksi tidak ditemukan.", 404);
    if (!mayManageInteraction(ctx.user!, current))
      throw new InteractionError(
        "Hanya pencatat atau administrator yang dapat mengarsipkan catatan.",
        403,
      );
    if (restore ? !current.archivedAt : !!current.archivedAt) return current;
    const [updated] = await tx
      .update(interactions)
      .set({
        archivedAt: restore ? null : new Date(),
        archivedBy: restore ? null : ctx.user!.id,
        archiveReason: restore ? null : reason,
        updatedAt: new Date(),
      })
      .where(eq(interactions.id, current.id))
      .returning();
    await audit(
      tx,
      ctx,
      restore ? "restore_interaction" : "archive_interaction",
      current.id,
      { archivedAt: current.archivedAt },
      { archivedAt: updated!.archivedAt },
      reason,
    );
    return updated;
  });
}
