import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { Router } from "../../http/router";
import { type RequestContext } from "../../http/middleware";
import { getDb } from "../../db/client";
import {
  jamaahRoomEntries as entries,
  jamaahRoomActivity as activity,
  events,
  appUsers,
  persons,
  tasks,
  interactions,
} from "../../db/schema";
import { successResponse } from "../../http/response";
import { PERMISSIONS as P, hasPermission } from "../../permissions/constants";
import { logExportEvent } from "../../audit/service";
import { recordsToCsv } from "../../lib/csv";
import { normalizePhoneE164 } from "../../lib/phone";
import { interactionVisibility } from "../interactions/visibility";
import {
  ROOM_CATEGORIES,
  ROOM_STATUSES,
  roomReplySchema,
  parseRoomDate,
} from "./policy";
import { ensureRoomTables } from "./setup";
import {
  RoomError,
  roomOperation,
  canManageRoom,
  updateRoom,
  archiveRoom,
  createRoomTask,
  reviewRoomBulk,
} from "./service";
import { roomReference } from "../../../src/lib/jamaahRoomModel";
const date = z
  .string()
  .refine((value) => !!parseRoomDate(value), "Tanggal tidak valid.");
const filterSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(150).optional(),
    queue: z.enum(["all", "reply", "curation", "followup"]).default("all"),
    status: z.enum(ROOM_STATUSES).optional(),
    category: z.enum(ROOM_CATEGORIES).optional(),
    eventId: z.string().uuid().optional(),
    personId: z.string().uuid().optional(),
    ownerUserId: z.string().uuid().optional(),
    archive: z.enum(["active", "archived", "all"]).default("active"),
    from: date.optional(),
    to: date.optional(),
    order: z.enum(["newest", "oldest"]).default("newest"),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Rentang tanggal tidak valid.",
  );
function filters(value: unknown) {
  const result = filterSchema.safeParse(value);
  if (!result.success)
    throw new RoomError(
      result.error.issues[0]?.message || "Filter tidak valid.",
    );
  return result.data;
}
type Filters = ReturnType<typeof filters>;
const hasTask = () =>
  sql`EXISTS(SELECT 1 FROM tasks room_task WHERE room_task.related_type='jamaah_room_entry' AND room_task.related_id=${entries.id} AND room_task.status IN ('pending','in_progress','waiting'))`;
function whereFilters(f: Filters, omitStatus = false) {
  const conditions = [
    f.archive === "all"
      ? undefined
      : f.archive === "archived"
        ? isNotNull(entries.archivedAt)
        : isNull(entries.archivedAt),
    !omitStatus && f.status ? eq(entries.status, f.status) : undefined,
    f.category ? eq(entries.category, f.category) : undefined,
    f.eventId ? eq(entries.eventId, f.eventId) : undefined,
    f.personId ? eq(entries.personId, f.personId) : undefined,
    f.ownerUserId ? eq(entries.ownerUserId, f.ownerUserId) : undefined,
    f.from
      ? sql`${entries.createdAt}>=${f.from + "T00:00:00+07:00"}::timestamptz`
      : undefined,
    f.to
      ? sql`${entries.createdAt}<${f.to + "T00:00:00+07:00"}::timestamptz+interval '1 day'`
      : undefined,
  ];
  if (f.queue === "reply")
    conditions.push(
      and(
        eq(entries.wantsReply, true),
        inArray(entries.status, ["new", "reviewing"]),
      ),
    );
  if (f.queue === "followup") conditions.push(hasTask());
  if (f.queue === "curation")
    conditions.push(
      and(
        inArray(entries.category, ["cerita", "pengalaman"]),
        eq(entries.publicationConsent, true),
        isNull(entries.publishedAt),
        sql`${entries.status}<>'closed'`,
      ),
    );
  if (f.search) {
    const value = "%" + f.search.replace(/[\\%_]/g, "\\$&") + "%",
      reference = f.search.replace(/^#/, ""),
      refPattern = reference.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(
      or(
        ilike(entries.subject, value),
        ilike(entries.message, value),
        ilike(entries.name, value),
        sql`${entries.id}::text ILIKE ${refPattern}`,
        sql`EXISTS(SELECT 1 FROM events room_event WHERE room_event.id=${entries.eventId} AND room_event.title ILIKE ${value})`,
      ),
    );
  }
  return and(...conditions);
}
const relations = {
  owner: { columns: { id: true, fullName: true } },
  person: { columns: { id: true, fullName: true, isActive: true } },
  event: { columns: { id: true, title: true } },
} as const;
const viewColumns = {
  id: true,
  category: true,
  eventId: true,
  personId: true,
  ownerUserId: true,
  name: true,
  subject: true,
  message: true,
  wantsReply: true,
  status: true,
  publicationConsent: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} as const;
async function taskList(ctx: RequestContext, id: string) {
  if (
    !hasPermission(ctx.user!.roles, P.TASKS_VIEW_ALL) &&
    !hasPermission(ctx.user!.roles, P.TASKS_VIEW_OWN)
  )
    return [];
  return getDb().query.tasks.findMany({
    where: and(
      eq(tasks.relatedType, "jamaah_room_entry"),
      eq(tasks.relatedId, id),
      hasPermission(ctx.user!.roles, P.TASKS_VIEW_ALL)
        ? undefined
        : eq(tasks.ownerUserId, ctx.user!.id),
    ),
    columns: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      ownerUserId: true,
    },
    orderBy: [asc(tasks.dueAt)],
  });
}
export function registerRoomManagementRoutes(router: Router) {
  router.get(
    "/api/jamaah-room",
    roomOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      const f = filters(ctx.query);
      await ensureRoomTables();
      const db = getDb();
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(entries)
        .where(whereFilters(f));
      const total = Number(count?.total || 0),
        pages = Math.max(1, Math.ceil(total / f.pageSize)),
        page = Math.min(f.page, pages);
      const rows = await db.query.jamaahRoomEntries.findMany({
        where: whereFilters(f),
        columns: viewColumns,
        with: relations,
        extras: { hasOpenTasks: hasTask().as("has_open_tasks") },
        orderBy: [
          f.order === "oldest"
            ? asc(entries.createdAt)
            : desc(entries.createdAt),
          desc(entries.id),
        ],
        limit: f.pageSize,
        offset: (page - 1) * f.pageSize,
      });
      const summary = await db
        .select({ status: entries.status, count: sql<number>`count(*)::int` })
        .from(entries)
        .where(whereFilters(f, true))
        .groupBy(entries.status);
      const eventOptions = await db
        .selectDistinct({ id: events.id, title: events.title })
        .from(entries)
        .innerJoin(events, eq(entries.eventId, events.id))
        .orderBy(asc(events.title));
      const staff = await db.query.appUsers.findMany({
        where: eq(appUsers.isActive, true),
        columns: { id: true, fullName: true },
        with: { userRoles: { with: { role: true } } },
      });
      const staffOptions = staff
        .filter((row) => {
          const roles = row.userRoles.map((link) => link.role.code);
          return (
            hasPermission(roles as any, P.INTERACTIONS_VIEW) &&
            hasPermission(roles as any, P.TASKS_VIEW_OWN)
          );
        })
        .map((row) => ({ id: row.id, fullName: row.fullName }));
      const items = rows.map(({ message, event, ...row }) => ({
        ...row,
        reference: roomReference(row.id),
        preview: message.slice(0, 150),
        eventTitle: event?.title || null,
        canManage: canManageRoom(ctx.user!, row),
      }));
      return successResponse(
        { items, summary, eventOptions, staffOptions, me: ctx.user!.id },
        {
          requestId: ctx.requestId,
          page,
          pageSize: f.pageSize,
          total,
          totalPages: pages,
        },
        200,
        { "Cache-Control": "no-store" },
      );
    }),
  );
  router.post(
    "/api/jamaah-room/export",
    roomOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      if (!hasPermission(ctx.user!.roles, P.DATA_EXPORT))
        throw new RoomError("Izin ekspor diperlukan.", 403);
      const body = z
        .object({
          filters: z.record(z.unknown()).default({}),
          reason: z.string().trim().min(3).max(500),
        })
        .safeParse(ctx.body);
      if (!body.success)
        throw new RoomError("Isi alasan ekspor dan filter yang valid.");
      const f = filters(body.data.filters),
        rows = await getDb().query.jamaahRoomEntries.findMany({
          where: whereFilters(f),
          with: relations,
          orderBy: [desc(entries.createdAt)],
          limit: 5001,
        });
      if (rows.length > 5000)
        throw new RoomError(
          "Batasi hasil filter menjadi maksimal 5.000 pesan.",
          409,
        );
      const output = rows.map((row) => ({
        Referensi: roomReference(row.id),
        DiterimaWIB: row.createdAt.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
        }),
        Jenis: row.category,
        Judul: row.subject,
        Pesan: row.message,
        Nama: row.name,
        Email: row.email,
        WhatsApp: row.phone,
        BalasanDiminta: row.wantsReply ? "Ya" : "Tidak",
        Status: row.status,
        PIC: row.owner?.fullName,
        Jamaah: row.person?.fullName,
        Kajian: row.event?.title,
        Arsip: row.archivedAt ? "Ya" : "Tidak",
      }));
      await logExportEvent({
        actorUserId: ctx.user!.id,
        exportType: "jamaah_room",
        rowCount: output.length,
        filterJson: f,
        reason: body.data.reason,
        requestId: ctx.requestId,
      });
      return { csv: recordsToCsv(output), count: output.length };
    }),
  );
  router.get(
    "/api/jamaah-room/:id",
    roomOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      await ensureRoomTables();
      const db = getDb(),
        row = await db.query.jamaahRoomEntries.findFirst({
          where: eq(entries.id, ctx.params.id!),
          with: relations,
          columns: { submissionKey: false, submissionDigest: false },
        });
      if (!row) throw new RoomError("Pesan tidak ditemukan.", 404);
      const logs = await db.query.jamaahRoomActivity.findMany({
        where: eq(activity.entryId, row.id),
        with: { actor: { columns: { id: true, fullName: true } } },
        orderBy: [desc(activity.createdAt)],
        limit: 100,
      });
      const ids = logs.flatMap((log) =>
          log.interactionId ? [log.interactionId] : [],
        ),
        visible = ids.length
          ? await db.query.interactions.findMany({
              where: and(
                inArray(interactions.id, ids),
                interactionVisibility(ctx.user!.roles, ctx.user!.id),
              ),
              columns: { id: true },
            })
          : [];
      const visibleIds = new Set(visible.map((item) => item.id));
      return {
        ...row,
        reference: roomReference(row.id),
        eventTitle: row.event?.title || null,
        canManage: canManageRoom(ctx.user!, row),
        tasks: await taskList(ctx, row.id),
        activity: logs.map((log) => ({
          ...log,
          interactionId:
            log.interactionId && visibleIds.has(log.interactionId)
              ? log.interactionId
              : null,
        })),
      };
    }),
  );
  router.get(
    "/api/jamaah-room/:id/person-candidates",
    roomOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      const db = getDb(),
        row = await db.query.jamaahRoomEntries.findFirst({
          where: eq(entries.id, ctx.params.id!),
          columns: { phone: true, email: true },
        });
      if (!row) throw new RoomError("Pesan tidak ditemukan.", 404);
      const phone = row.phone ? normalizePhoneE164(row.phone) : "",
        email = row.email?.trim().toLowerCase();
      if (!phone && !email) return [];
      return db.query.persons.findMany({
        where: and(
          eq(persons.isActive, true),
          or(
            phone ? eq(persons.phoneE164, phone) : undefined,
            email ? sql`lower(${persons.email})=${email}` : undefined,
          ),
        ),
        columns: { id: true, fullName: true, phoneE164: true, email: true },
        limit: 6,
      });
    }),
  );
  router.patch(
    "/api/jamaah-room/bulk-review",
    roomOperation(P.INTERACTIONS_CREATE, reviewRoomBulk),
  );
  router.patch(
    "/api/jamaah-room/:id",
    roomOperation(P.INTERACTIONS_CREATE, updateRoom),
  );
  router.post(
    "/api/jamaah-room/:id/tasks",
    roomOperation(P.INTERACTIONS_CREATE, createRoomTask, 201),
  );
  router.post(
    "/api/jamaah-room/:id/response",
    roomOperation(P.INTERACTIONS_CREATE, async (ctx) => {
      const body = roomReplySchema.safeParse(ctx.body);
      if (!body.success)
        throw new RoomError(
          body.error.issues[0]?.message || "Tanggapan tidak valid.",
        );
      return updateRoom({
        ...ctx,
        body: { ...body.data, status: "responded" },
      });
    }),
  );
  router.delete(
    "/api/jamaah-room/:id",
    roomOperation(P.INTERACTIONS_CREATE, (ctx) => archiveRoom(ctx)),
  );
  router.post(
    "/api/jamaah-room/:id/restore",
    roomOperation(P.INTERACTIONS_CREATE, (ctx) => archiveRoom(ctx, true)),
  );
}
