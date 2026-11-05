import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  jamaahRoomEntries as entries,
  jamaahRoomActivity as activity,
  persons,
  interactions,
  tasks,
  auditLogs,
} from "../../db/schema";
import {
  type Handler,
  type RequestContext,
  requirePermission,
} from "../../http/middleware";
import { errorResponse, successResponse } from "../../http/response";
import { PERMISSIONS as P, hasPermission } from "../../permissions/constants";
import {
  InteractionError,
  validateInteractionOwner,
} from "../interactions/service";
import { taskStatsCache } from "../tasks/cache";
import {
  publicRoomTextSafe,
  roomReference,
  ROOM_OPEN_TASKS,
} from "../../../src/lib/jamaahRoomModel";
import {
  roomUpdateSchema,
  roomReasonSchema,
  roomTaskSchema,
  roomBulkSchema,
} from "./policy";
import { z } from "zod";
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type User = NonNullable<RequestContext["user"]>;
export const canManageRoom = (
  user: User,
  row: { ownerUserId?: string | null },
) =>
  hasPermission(user.roles, P.INTERACTIONS_CREATE) &&
  (!row.ownerUserId ||
    row.ownerUserId === user.id ||
    hasPermission(user.roles, P.SYSTEM_CONFIGURE));
function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new RoomError(result.error.issues[0]?.message || "Data tidak valid.");
  return result.data;
}
export function roomOperation(
  permission: Parameters<typeof requirePermission>[0],
  operation: (ctx: RequestContext) => Promise<any>,
  status = 200,
): Handler {
  return requirePermission(permission, async (ctx) => {
    if (
      ctx.params.id &&
      !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(ctx.params.id)
    )
      return errorResponse(
        "VALIDATION_ERROR",
        "ID pesan tidak valid.",
        400,
        ctx.requestId,
      );
    try {
      let result = await operation(ctx);
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        "submissionKey" in result
      ) {
        const { submissionKey: _, submissionDigest: __, ...dto } = result;
        result = dto;
      }
      return result?.statusCode
        ? result
        : successResponse(result, { requestId: ctx.requestId }, status, {
            "Cache-Control": "no-store",
          });
    } catch (error) {
      if (error instanceof RoomError || error instanceof InteractionError)
        return errorResponse(
          error.status === 403
            ? "FORBIDDEN"
            : error.status === 404
              ? "NOT_FOUND"
              : error.status === 409
                ? "CONFLICT"
                : "VALIDATION_ERROR",
          error.message,
          error.status,
          ctx.requestId,
        );
      const code = (error as any)?.cause?.code || (error as any)?.code;
      if (["55P03", "40P01", "23505"].includes(code))
        return errorResponse(
          "CONFLICT",
          "Data sedang diproses. Muat ulang dan periksa hasilnya.",
          409,
          ctx.requestId,
        );
      throw error;
    }
  });
}
async function record(
  tx: any,
  ctx: RequestContext,
  entryId: string,
  action: string,
  content: string | null,
  details: any = {},
  interactionId: string | null = null,
  taskId: string | null = null,
  occurredAt?: Date,
) {
  await tx.insert(activity).values({
    entryId,
    actorUserId: ctx.user!.id,
    action,
    content,
    details,
    interactionId,
    taskId,
    ...(occurredAt ? { occurredAt } : {}),
  });
  await tx.insert(auditLogs).values({
    actorUserId: ctx.user!.id,
    action: "jamaah_room_" + action,
    entityType: "jamaah_room_entry",
    entityId: entryId,
    afterJson: { ...details, interactionId, taskId },
    reason: "Penanganan Ruang Jamaah",
    requestId: ctx.requestId,
  });
}
async function locked(
  tx: any,
  id: string,
  ctx: RequestContext,
  expected?: string,
  allowArchive = false,
) {
  await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
  await tx.execute(
    sql`SELECT id FROM jamaah_room_entries WHERE id=${id} FOR UPDATE`,
  );
  const row = await tx.query.jamaahRoomEntries.findFirst({
    where: eq(entries.id, id),
  });
  if (!row) throw new RoomError("Pesan tidak ditemukan.", 404);
  if (!canManageRoom(ctx.user!, row))
    throw new RoomError(
      "Pesan ditangani PIC lain. Minta administrator memindahkan penugasan.",
      403,
    );
  if (row.archivedAt && !allowArchive)
    throw new RoomError("Pulihkan arsip sebelum mengubah pesan.", 409);
  if (expected && +new Date(expected) !== +row.updatedAt)
    throw new RoomError(
      "Pesan sudah diperbarui petugas lain. Muat ulang sebelum menyimpan.",
      409,
    );
  return row;
}
const openTask = (tx: any, id: string) =>
  tx.query.tasks.findFirst({
    where: and(
      eq(tasks.relatedType, "jamaah_room_entry"),
      eq(tasks.relatedId, id),
      inArray(tasks.status, ROOM_OPEN_TASKS as any),
    ),
  });
export async function updateRoom(ctx: RequestContext) {
  const body = parse(roomUpdateSchema, ctx.body);
  return getDb().transaction(async (tx) => {
    const before = await locked(
      tx,
      ctx.params.id!,
      ctx,
      body.expectedUpdatedAt,
    );
    const owner =
      body.ownerUserId !== undefined
        ? body.ownerUserId
        : before.ownerUserId || ctx.user!.id;
    if (
      owner &&
      owner !== ctx.user!.id &&
      owner !== before.ownerUserId &&
      !hasPermission(ctx.user!.roles, P.TASKS_REASSIGN)
    )
      throw new RoomError(
        "Penugasan PIC lain memerlukan izin administrator.",
        403,
      );
    if (owner) await validateInteractionOwner(tx, owner);
    if (!owner && (await openTask(tx, before.id)))
      throw new RoomError(
        "Pindahkan atau selesaikan tugas aktif sebelum melepas PIC.",
        409,
      );
    const personId =
      body.personId !== undefined ? body.personId : before.personId;
    const ownerChanged = owner !== before.ownerUserId,
      personChanged =
        body.personId !== undefined && body.personId !== before.personId;
    const linked =
      ownerChanged || personChanged
        ? await tx.query.jamaahRoomActivity.findMany({
            where: eq(activity.entryId, before.id),
            columns: { interactionId: true },
          })
        : [];
    const linkedIds = linked.flatMap((row) =>
      row.interactionId ? [row.interactionId] : [],
    );
    if (body.personId !== undefined && body.personId !== before.personId) {
      if (!body.reason)
        throw new RoomError("Isi alasan penautan atau koreksi Jamaah.");
      if (
        personId &&
        !(await tx.query.persons.findFirst({
          where: and(eq(persons.id, personId), eq(persons.isActive, true)),
        }))
      )
        throw new RoomError("Pilih profil Jamaah aktif.", 404);
      if (
        linkedIds.length &&
        !hasPermission(ctx.user!.roles, P.SYSTEM_CONFIGURE)
      )
        throw new RoomError(
          "Koreksi Jamaah dengan riwayat interaksi memerlukan administrator.",
          403,
        );
      if (linkedIds.length && !personId)
        throw new RoomError(
          "Riwayat interaksi memerlukan profil Jamaah. Pilih profil yang benar.",
          409,
        );
    }
    const status = body.status ?? before.status,
      response = body.response !== undefined ? body.response : before.response;
    const newResponse =
      status === "responded" &&
      typeof body.response === "string" &&
      !!response?.trim() &&
      (response !== before.response ||
        !before.responseRecordedAt ||
        body.responseOccurredAt !== undefined);
    if (status === "responded" && !response?.trim())
      throw new RoomError(
        "Catat ringkasan tanggapan sebelum menandai sudah ditanggapi.",
      );
    if (status === "closed" && before.status !== "closed") {
      if (await openTask(tx, before.id))
        throw new RoomError(
          "Selesaikan atau batalkan tugas aktif sebelum menutup pesan.",
          409,
        );
      if (
        before.wantsReply &&
        !response?.trim() &&
        !(body.internalNote ?? before.internalNote)?.trim()
      )
        throw new RoomError("Catat tanggapan atau alasan penutupan.");
    }
    const title =
        body.publicTitle !== undefined ? body.publicTitle : before.publicTitle,
      text =
        body.publicText !== undefined ? body.publicText : before.publicText;
    const publishing =
      body.published === true ||
      (!!before.publishedAt && body.published !== false);
    if (
      publishing &&
      (!before.publicationConsent ||
        !["cerita", "pengalaman"].includes(before.category))
    )
      throw new RoomError(
        "Cerita hanya dapat diterbitkan dengan izin Jamaah.",
        403,
      );
    if (publishing && !publicRoomTextSafe(title, text))
      throw new RoomError(
        "Isi judul/teks publik dan hapus email atau nomor telepon.",
      );
    let interactionId: string | null = null;
    const occurredAt = body.responseOccurredAt
      ? new Date(body.responseOccurredAt)
      : new Date();
    if (newResponse && +occurredAt > Date.now() + 300000)
      throw new RoomError("Waktu tanggapan belum terjadi.");
    if (newResponse && personId) {
      if (
        !(await tx.query.persons.findFirst({
          where: and(eq(persons.id, personId), eq(persons.isActive, true)),
        }))
      )
        throw new RoomError(
          "Pulihkan profil Jamaah sebelum mencatat interaksi baru.",
          409,
        );
      const [interaction] = await tx
        .insert(interactions)
        .values({
          personId,
          eventId: before.eventId,
          channel: body.replyChannel || "other",
          summary:
            "Tanggapan Ruang Jamaah #" +
            roomReference(before.id) +
            ": " +
            response,
          sensitivityLevel: "restricted",
          ownerUserId: owner || ctx.user!.id,
          createdBy: ctx.user!.id,
          occurredAt,
          outcome: "sudah_dihubungi",
        })
        .returning();
      interactionId = interaction!.id;
    }
    if (ownerChanged && owner)
      await tx
        .update(tasks)
        .set({
          ownerUserId: owner,
          assignedBy: ctx.user!.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.relatedType, "jamaah_room_entry"),
            eq(tasks.relatedId, before.id),
            inArray(tasks.status, ROOM_OPEN_TASKS as any),
          ),
        );
    if (personChanged)
      await tx
        .update(tasks)
        .set({ personId: personId || null, updatedAt: new Date() })
        .where(
          and(
            eq(tasks.relatedType, "jamaah_room_entry"),
            eq(tasks.relatedId, before.id),
          ),
        );
    if (linkedIds.length && (ownerChanged || personChanged))
      await tx
        .update(interactions)
        .set({
          ...(ownerChanged && owner ? { ownerUserId: owner } : {}),
          ...(personChanged && personId ? { personId } : {}),
          updatedAt: new Date(),
        })
        .where(inArray(interactions.id, linkedIds));
    const [updated] = await tx
      .update(entries)
      .set({
        ownerUserId: owner || null,
        personId: personId || null,
        ...(body.status !== undefined ? { status } : {}),
        ...(body.internalNote !== undefined
          ? { internalNote: body.internalNote || null }
          : {}),
        ...(body.response !== undefined ? { response: response || null } : {}),
        ...(body.publicTitle !== undefined
          ? { publicTitle: title || null }
          : {}),
        ...(body.publicText !== undefined ? { publicText: text || null } : {}),
        ...(body.published !== undefined
          ? {
              publishedAt: body.published
                ? before.publishedAt || new Date()
                : null,
            }
          : {}),
        ...(newResponse
          ? {
              responseRecordedAt: occurredAt,
              replyChannel: body.replyChannel || "other",
            }
          : {}),
        updatedBy: ctx.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(entries.id, before.id))
      .returning();
    const action = newResponse
      ? "response_recorded"
      : body.published === true
        ? "published"
        : body.published === false
          ? "unpublished"
          : "updated";
    const details: any = {
      status: updated!.status,
      personId: personId || null,
      ownerUserId: owner || null,
      published: !!updated!.publishedAt,
      changedFields: Object.keys(body).filter(
        (key) => key !== "expectedUpdatedAt",
      ),
    };
    if (body.personId !== undefined) {
      details.previousPersonId = before.personId;
      details.reason = body.reason;
    }
    // The private activity preserves note revisions; the general audit contains metadata only.
    await tx.insert(activity).values({
      entryId: before.id,
      actorUserId: ctx.user!.id,
      action,
      content: newResponse
        ? response
        : (body.internalNote ?? body.reason ?? null),
      details: {
        ...details,
        ...(body.internalNote !== undefined
          ? { previousNote: before.internalNote }
          : {}),
        ...(body.response !== undefined
          ? { previousResponse: before.response }
          : {}),
      },
      interactionId,
      occurredAt: newResponse ? occurredAt : new Date(),
    });
    await tx.insert(auditLogs).values({
      actorUserId: ctx.user!.id,
      action: "jamaah_room_" + action,
      entityType: "jamaah_room_entry",
      entityId: before.id,
      beforeJson: {
        status: before.status,
        ownerUserId: before.ownerUserId,
        personId: before.personId,
        published: !!before.publishedAt,
      },
      afterJson: {
        status: updated!.status,
        ownerUserId: owner || null,
        personId: personId || null,
        published: !!updated!.publishedAt,
        interactionId,
      },
      reason: "Penanganan Ruang Jamaah",
      requestId: ctx.requestId,
    });
    taskStatsCache.clear();
    return updated;
  });
}
export async function archiveRoom(ctx: RequestContext, restore = false) {
  const body = parse(roomReasonSchema, ctx.body);
  return getDb().transaction(async (tx) => {
    const before = await locked(
      tx,
      ctx.params.id!,
      ctx,
      body.expectedUpdatedAt,
      true,
    );
    if (restore ? !before.archivedAt : !!before.archivedAt) return before;
    if (!restore && (await openTask(tx, before.id)))
      throw new RoomError(
        "Selesaikan atau batalkan tugas aktif sebelum mengarsipkan.",
        409,
      );
    const [row] = await tx
      .update(entries)
      .set({
        archivedAt: restore ? null : new Date(),
        archivedBy: restore ? null : ctx.user!.id,
        archiveReason: restore ? null : body.reason,
        publishedAt: null,
        updatedAt: new Date(),
        updatedBy: ctx.user!.id,
      })
      .where(eq(entries.id, before.id))
      .returning();
    await record(
      tx,
      ctx,
      before.id,
      restore ? "restored" : "archived",
      body.reason,
      { previousStatus: before.status, status: row!.status, published: false },
    );
    return row;
  });
}
export async function createRoomTask(ctx: RequestContext) {
  const body = parse(roomTaskSchema, ctx.body);
  if (!hasPermission(ctx.user!.roles, P.TASKS_CREATE))
    throw new RoomError("Izin membuat tugas diperlukan.", 403);
  return getDb().transaction(async (tx) => {
    const before = await locked(
        tx,
        ctx.params.id!,
        ctx,
        body.expectedUpdatedAt,
      ),
      owner = body.ownerUserId || before.ownerUserId || ctx.user!.id;
    if (before.status === "closed")
      throw new RoomError("Buka kembali pesan sebelum membuat tugas.", 409);
    if (+new Date(body.dueAt) < +before.createdAt - 60000)
      throw new RoomError("Tenggat tugas harus setelah pesan diterima.");
    if (
      owner !== ctx.user!.id &&
      owner !== before.ownerUserId &&
      !hasPermission(ctx.user!.roles, P.TASKS_REASSIGN)
    )
      throw new RoomError("Izin penugasan PIC diperlukan.", 403);
    await validateInteractionOwner(tx, owner);
    if (
      before.personId &&
      !(await tx.query.persons.findFirst({
        where: and(eq(persons.id, before.personId), eq(persons.isActive, true)),
      }))
    )
      throw new RoomError("Pulihkan profil Jamaah sebelum membuat tugas.", 409);
    if (await openTask(tx, before.id))
      throw new RoomError("Pesan masih memiliki tugas aktif.", 409);
    const [task] = await tx
      .insert(tasks)
      .values({
        personId: before.personId,
        relatedType: "jamaah_room_entry",
        relatedId: before.id,
        title: "Ruang Jamaah #" + roomReference(before.id) + ": " + body.title,
        description:
          "[TYPE:" +
          body.taskType +
          "] Buka pesan asal untuk konteks penanganan.",
        status: "pending",
        priority: body.priority,
        dueAt: new Date(body.dueAt),
        ownerUserId: owner,
        assignedBy: ctx.user!.id,
      })
      .returning();
    await tx
      .update(entries)
      .set({
        ownerUserId: owner,
        status: before.status === "new" ? "reviewing" : before.status,
        updatedAt: new Date(),
        updatedBy: ctx.user!.id,
      })
      .where(eq(entries.id, before.id));
    await record(
      tx,
      ctx,
      before.id,
      "task_created",
      body.title,
      { ownerUserId: owner },
      null,
      task!.id,
    );
    taskStatsCache.clear();
    return task;
  });
}
export async function reviewRoomBulk(ctx: RequestContext) {
  const { ids } = parse(roomBulkSchema, ctx.body);
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM jamaah_room_entries WHERE ${inArray(entries.id, ids)} ORDER BY id FOR UPDATE`,
    );
    const rows = await tx.query.jamaahRoomEntries.findMany({
      where: and(
        inArray(entries.id, ids),
        eq(entries.status, "new"),
        isNull(entries.archivedAt),
      ),
    });
    let updated = 0;
    for (const row of rows) {
      if (!canManageRoom(ctx.user!, row)) continue;
      await tx
        .update(entries)
        .set({
          status: "reviewing",
          ownerUserId: row.ownerUserId || ctx.user!.id,
          updatedAt: new Date(),
          updatedBy: ctx.user!.id,
        })
        .where(eq(entries.id, row.id));
      await record(tx, ctx, row.id, "reviewing", null, { status: "reviewing" });
      updated++;
    }
    return { updated };
  });
}
export async function moveRoomTask(
  ctx: RequestContext,
  taskId: string,
  newOwnerId: string,
  reason: string,
) {
  return getDb().transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    if (!task || task.relatedType !== "jamaah_room_entry" || !task.relatedId)
      throw new RoomError("Tugas Ruang Jamaah tidak ditemukan.", 404);
    const before = await locked(tx, task.relatedId, ctx);
    await tx.execute(sql`SELECT id FROM tasks WHERE id=${taskId} FOR UPDATE`);
    const current = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });
    if (!current || !ROOM_OPEN_TASKS.includes(current.status))
      throw new RoomError("Hanya tugas aktif yang dapat dipindahkan.", 409);
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
      .update(entries)
      .set({
        ownerUserId: newOwnerId,
        updatedBy: ctx.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(entries.id, before.id));
    const linked = await tx.query.jamaahRoomActivity.findMany({
      where: eq(activity.entryId, before.id),
      columns: { interactionId: true },
    });
    const linkedIds = linked.flatMap((row) =>
      row.interactionId ? [row.interactionId] : [],
    );
    if (linkedIds.length)
      await tx
        .update(interactions)
        .set({ ownerUserId: newOwnerId, updatedAt: new Date() })
        .where(inArray(interactions.id, linkedIds));
    await record(
      tx,
      ctx,
      before.id,
      "reassigned",
      reason,
      { previousOwner: current.ownerUserId, ownerUserId: newOwnerId },
      null,
      taskId,
    );
    taskStatsCache.clear();
    return updated;
  });
}
