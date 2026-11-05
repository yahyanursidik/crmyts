import { z } from "zod";
import {
  and,
  eq,
  desc,
  asc,
  sql,
  or,
  ilike,
  isNull,
  isNotNull,
  inArray,
} from "drizzle-orm";
import { Router } from "../../http/router";
import { type RequestContext } from "../../http/middleware";
import { getDb } from "../../db/client";
import {
  interactions,
  tasks,
  events,
  appUsers,
} from "../../db/schema";
import { successResponse } from "../../http/response";
import { PERMISSIONS as P, hasPermission } from "../../permissions/constants";
import { logExportEvent } from "../../audit/service";
import { recordsToCsv } from "../../lib/csv";
import {
  INTERACTION_CHANNELS,
  INTERACTION_OUTCOMES,
  validInteractionInstant,
} from "../../../src/lib/interactionModel";
import { interactionVisibility } from "./visibility";
import {
  InteractionError,
  interactionOperation,
  createInteractionHandler,
  correctInteraction,
  archiveInteraction,
  addInteractionFollowup,
  mayManageInteraction,
  mayUseEventContext,
} from "./service";
export { OUTCOME_OPTIONS } from "./service";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => validInteractionInstant(value + "T00:00:00+07:00"),
    "Tanggal tidak valid.",
  );
const filters = z
  .object({
    search: z.string().trim().max(200).optional(),
    personId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    ownerUserId: z.string().uuid().optional(),
    channel: z.enum(INTERACTION_CHANNELS).optional(),
    outcome: z.enum(INTERACTION_OUTCOMES).optional(),
    sensitivityLevel: z
      .enum(["standard", "confidential", "restricted"])
      .optional(),
    archive: z.enum(["active", "archived", "all"]).default("active"),
    followUp: z.enum(["needed", "open", "missing", "done"]).optional(),
    from: date.optional(),
    to: date.optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Tanggal akhir harus setelah tanggal awal.",
  );
const taskExists = (state?: string) =>
  sql`EXISTS(SELECT 1 FROM tasks WHERE tasks.related_type='interaction' AND tasks.related_id=${interactions.id}${state === "open" ? sql` AND tasks.status IN ('pending','in_progress','waiting')` : state === "done" ? sql` AND tasks.status='completed'` : sql``})`;
const needed = () =>
  sql`(${taskExists("open")} OR (${interactions.outcome} IN ('minta_dihubungi_kembali','perlu_eskalasi','tidak_merespons') AND NOT ${taskExists()}))`;
function parseFilters(value: unknown) {
  const parsed = filters.safeParse(value);
  if (!parsed.success)
    throw new InteractionError(
      parsed.error.issues[0]?.message || "Filter tidak valid.",
    );
  return parsed.data;
}
function whereFilters(ctx: RequestContext, f: ReturnType<typeof parseFilters>) {
  const conditions = [interactionVisibility(ctx.user!.roles, ctx.user!.id)];
  if (f.archive !== "all")
    conditions.push(
      f.archive === "archived"
        ? isNotNull(interactions.archivedAt)
        : isNull(interactions.archivedAt),
    );
  if (f.personId) conditions.push(eq(interactions.personId, f.personId));
  if (f.eventId) conditions.push(eq(interactions.eventId, f.eventId));
  if (f.ownerUserId)
    conditions.push(eq(interactions.ownerUserId, f.ownerUserId));
  if (f.channel) conditions.push(eq(interactions.channel, f.channel));
  if (f.outcome) conditions.push(eq(interactions.outcome, f.outcome));
  if (f.sensitivityLevel)
    conditions.push(eq(interactions.sensitivityLevel, f.sensitivityLevel));
  if (f.from)
    conditions.push(
      sql`${interactions.occurredAt}>=${f.from + "T00:00:00+07:00"}::timestamptz`,
    );
  if (f.to)
    conditions.push(
      sql`${interactions.occurredAt}<${f.to + "T00:00:00+07:00"}::timestamptz+interval '1 day'`,
    );
  if (f.followUp)
    conditions.push(
      f.followUp === "needed"
        ? needed()
        : f.followUp === "missing"
          ? sql`${interactions.outcome} IN ('minta_dihubungi_kembali','perlu_eskalasi','tidak_merespons') AND NOT ${taskExists()}`
          : taskExists(f.followUp),
    );
  if (f.search) {
    const value = "%" + f.search.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(
      or(
        ilike(interactions.summary, value),
        ilike(interactions.outcome, value),
        sql`EXISTS(SELECT 1 FROM persons WHERE persons.id=${interactions.personId} AND (persons.full_name ILIKE ${value} OR persons.phone_e164 ILIKE ${value}))`,
      ),
    );
  }
  return and(...conditions);
}
const relations = {
  person: {
    columns: {
      id: true,
      fullName: true,
      phoneE164: true,
      cityRegency: true,
      isActive: true,
    },
  },
  owner: { columns: { id: true, fullName: true } },
  creator: { columns: { id: true, fullName: true } },
  event: { columns: { id: true, title: true, startAt: true } },
} as const;
async function linkedTasks(ctx: RequestContext, ids: string[]) {
  if (
    !ids.length ||
    (!hasPermission(ctx.user!.roles, P.TASKS_VIEW_OWN) &&
      !hasPermission(ctx.user!.roles, P.TASKS_VIEW_ALL))
  )
    return [];
  return getDb().query.tasks.findMany({
    where: and(
      eq(tasks.relatedType, "interaction"),
      inArray(tasks.relatedId, ids),
      hasPermission(ctx.user!.roles, P.TASKS_VIEW_ALL)
        ? undefined
        : eq(tasks.ownerUserId, ctx.user!.id),
    ),
    columns: {
      id: true,
      relatedId: true,
      title: true,
      status: true,
      priority: true,
      dueAt: true,
      ownerUserId: true,
    },
    orderBy: [asc(tasks.dueAt)],
  });
}
export function registerInteractionsRoutes(router: Router) {
  router.get(
    "/api/interactions",
    interactionOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      const db = getDb(),
        f = parseFilters(ctx.query),
        where = whereFilters(ctx, f);
      const [stats] = await db
        .select({
          totalAll: sql<number>`count(*)::int`,
          todayCount: sql<number>`count(*) FILTER(WHERE ${interactions.occurredAt}>=date_trunc('day',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')::int`,
          needFollowUpCount: sql<number>`count(*) FILTER(WHERE ${needed()})::int`,
          privateCount: sql<number>`count(*) FILTER(WHERE ${interactions.sensitivityLevel}!='standard')::int`,
        })
        .from(interactions)
        .where(where);
      const totalCount = Number(stats?.totalAll || 0),
        totalPages = Math.max(1, Math.ceil(totalCount / f.pageSize)),
        page = Math.min(f.page, totalPages);
      const list = await db.query.interactions.findMany({
        where,
        with: relations,
        orderBy: [desc(interactions.occurredAt), desc(interactions.id)],
        limit: f.pageSize,
        offset: (page - 1) * f.pageSize,
      });
      const followUps = await linkedTasks(
        ctx,
        list.map((row) => row.id),
      );
      return successResponse(
        list.map((row) => ({
          ...row,
          canManage: mayManageInteraction(ctx.user!, row),
          followUps: followUps.filter((task) => task.relatedId === row.id),
        })),
        {
          requestId: ctx.requestId,
          pagination: { page, pageSize: f.pageSize, totalCount, totalPages },
          stats,
        },
      );
    }),
  );
  router.get(
    "/api/interactions/options",
    interactionOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      const db = getDb(),
        user = ctx.user!;
      const staff = await db.query.appUsers.findMany({
        where: and(
          eq(appUsers.isActive, true),
          hasPermission(user.roles, P.TASKS_REASSIGN)
            ? undefined
            : eq(appUsers.id, user.id),
        ),
        with: { userRoles: { with: { role: true } } },
      });
      const canEvents = mayUseEventContext(user);
      const eventList = canEvents
        ? await db.query.events.findMany({
            where: hasPermission(user.roles, P.EVENTS_VIEW)
              ? undefined
              : or(
                  eq(events.status, "scheduled"),
                  ctx.query.personId &&
                    z.string().uuid().safeParse(ctx.query.personId).success
                    ? sql`EXISTS(SELECT 1 FROM event_attendance a WHERE a.event_id=${events.id} AND a.person_id=${ctx.query.personId}::uuid)`
                    : undefined,
                ),
            columns: { id: true, title: true, startAt: true },
            orderBy: [desc(events.startAt)],
            limit: 200,
          })
        : [];
      return {
        staff: staff
          .filter((row) => {
            const roles = row.userRoles.map((r) => r.role.code);
            return (
              hasPermission(roles as any, P.INTERACTIONS_VIEW) &&
              hasPermission(roles as any, P.TASKS_VIEW_OWN)
            );
          })
          .map((row) => ({ id: row.id, fullName: row.fullName })),
        events: eventList,
        canEvents,
      };
    }),
  );
  router.post("/api/interactions", createInteractionHandler);
  router.post(
    "/api/interactions/export",
    interactionOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      if (!hasPermission(ctx.user!.roles, P.DATA_EXPORT))
        throw new InteractionError("Izin ekspor diperlukan.", 403);
      const body = z
        .object({
          filters: z.record(z.unknown()).default({}),
          reason: z.string().trim().min(3).max(500),
        })
        .safeParse(ctx.body);
      if (!body.success)
        throw new InteractionError("Isi alasan ekspor dan filter yang valid.");
      const f = parseFilters(body.data.filters),
        list = await getDb().query.interactions.findMany({
          where: whereFilters(ctx, f),
          with: relations,
          orderBy: [desc(interactions.occurredAt), desc(interactions.id)],
          limit: 5001,
        });
      if (list.length > 5000)
        throw new InteractionError(
          "Batasi filter menjadi maksimal 5.000 interaksi per ekspor.",
          409,
        );
      const rows = list.map((row) => ({
        WaktuWIB: new Date(row.occurredAt).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
        }),
        Jamaah: row.person?.fullName,
        WhatsApp: row.person?.phoneE164,
        Kanal: row.channel,
        Ringkasan: row.summary,
        Hasil: row.outcome,
        Akses: row.sensitivityLevel,
        PIC: row.owner?.fullName,
        Pencatat: row.creator?.fullName,
        Event: row.event?.title,
        Arsip: row.archivedAt ? "Ya" : "Tidak",
      }));
      await logExportEvent({
        actorUserId: ctx.user!.id,
        exportType: "interactions",
        rowCount: rows.length,
        filterJson: f,
        reason: body.data.reason,
        requestId: ctx.requestId,
      });
      return { csv: recordsToCsv(rows), count: rows.length };
    }),
  );
  router.get(
    "/api/interactions/:id",
    interactionOperation(P.INTERACTIONS_VIEW, async (ctx) => {
      const row = await getDb().query.interactions.findFirst({
        where: and(
          eq(interactions.id, ctx.params.id!),
          interactionVisibility(ctx.user!.roles, ctx.user!.id),
        ),
        with: relations,
      });
      if (!row) throw new InteractionError("Interaksi tidak ditemukan.", 404);
      return {
        ...row,
        canManage: mayManageInteraction(ctx.user!, row),
        followUps: await linkedTasks(ctx, [row.id]),
      };
    }),
  );
  router.patch(
    "/api/interactions/:id",
    interactionOperation(P.INTERACTIONS_CREATE, correctInteraction),
  );
  router.post(
    "/api/interactions/:id/follow-up",
    interactionOperation(P.INTERACTIONS_CREATE, addInteractionFollowup, 201),
  );
  router.delete(
    "/api/interactions/:id",
    interactionOperation(P.INTERACTIONS_CREATE, (ctx) =>
      archiveInteraction(ctx),
    ),
  );
  router.post(
    "/api/interactions/:id/restore",
    interactionOperation(P.INTERACTIONS_CREATE, (ctx) =>
      archiveInteraction(ctx, true),
    ),
  );
}
