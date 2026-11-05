import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { events, jamaahRoomEntries as entries } from "../../db/schema";
import { getServerEnv } from "../../config/env";
import { normalizePhoneE164 } from "../../lib/phone";
import { Router } from "../../http/router";
import { validateBody } from "../../http/middleware";
import { errorResponse, successResponse } from "../../http/response";
import { roomSubmissionSchema } from "./policy";
import { RoomError } from "./service";
import { ensureRoomTables } from "./setup";
import {
  containsContactDetail,
  publicRoomTextSafe,
  roomReference,
} from "../../../src/lib/jamaahRoomModel";
const rowsOf = (result: any): any[] =>
  Array.isArray(result) ? result : result?.rows || [];
export function registerRoomPublicRoutes(router: Router) {
  router.get("/api/public/jamaah-room/event/:id", async (ctx) => {
    if (!z.string().uuid().safeParse(ctx.params.id).success)
      return errorResponse(
        "VALIDATION_ERROR",
        "ID kajian tidak valid.",
        400,
        ctx.requestId,
      );
    const event = await getDb().query.events.findFirst({
      where: eq(events.id, ctx.params.id!),
      columns: { id: true, title: true },
    });
    return event
      ? successResponse(event, { requestId: ctx.requestId })
      : errorResponse(
          "NOT_FOUND",
          "Kajian tidak ditemukan.",
          404,
          ctx.requestId,
        );
  });
  router.post(
    "/api/public/jamaah-room",
    validateBody(roomSubmissionSchema, async (ctx, body) => {
      if (body.website)
        return successResponse(
          { received: true },
          { requestId: ctx.requestId },
          201,
        );
      await ensureRoomTables();
      const db = getDb();
      const values = {
        category: body.category,
        eventId: body.eventId || null,
        name: body.name || null,
        email: body.email?.toLowerCase() || null,
        phone: body.phone ? normalizePhoneE164(body.phone) : null,
        subject: body.subject,
        message: body.message,
        wantsReply: body.wantsReply,
        publicationConsent: body.publicationConsent,
        anonymousPublication: body.anonymousPublication,
      };
      const digest = createHash("sha256")
        .update(JSON.stringify(values))
        .digest("hex");
      const received = (row: { id: string }) =>
        successResponse(
          { received: true, reference: roomReference(row.id) },
          { requestId: ctx.requestId },
          201,
          { "Cache-Control": "no-store" },
        );
      if (body.submissionId) {
        const existing = await db.query.jamaahRoomEntries.findFirst({
          where: eq(entries.submissionKey, body.submissionId),
          columns: { id: true, submissionDigest: true },
        });
        if (existing)
          return existing.submissionDigest === digest
            ? received(existing)
            : errorResponse(
                "CONFLICT",
                "Kiriman sebelumnya sudah diterima. Mulai pesan baru untuk isi yang berbeda.",
                409,
                ctx.requestId,
              );
      }
      const ip =
        ctx.headers["x-nf-client-connection-ip"] ||
        ctx.headers["X-Nf-Client-Connection-Ip"] ||
        "unknown";
      const hour = Math.floor(Date.now() / 3600000),
        key = createHash("sha256")
          .update(getServerEnv().AUTH_SECRET + ":" + ip + ":" + hour)
          .digest("hex");
      const rate = await db.execute(
        sql`INSERT INTO jamaah_room_rate_limits(key,hits,expires_at) VALUES(${key},1,now()+interval '2 hours') ON CONFLICT(key) DO UPDATE SET hits=jamaah_room_rate_limits.hits+1 WHERE jamaah_room_rate_limits.hits<5 RETURNING hits`,
      );
      if (!rowsOf(rate).length)
        return errorResponse(
          "RATE_LIMITED",
          "Terlalu banyak kiriman. Coba kembali dalam satu jam.",
          429,
          ctx.requestId,
          undefined,
          { "Retry-After": "3600" },
        );
      try {
        return await db.transaction(async (tx) => {
          if (body.eventId) {
            const event = await tx.execute(
              sql`SELECT id FROM events WHERE id=${body.eventId} FOR KEY SHARE`,
            );
            if (!rowsOf(event).length)
              throw new RoomError("Kajian yang dipilih tidak ditemukan.", 404);
          }
          const [row] = await tx
            .insert(entries)
            .values({
              ...values,
              submissionKey: body.submissionId || null,
              submissionDigest: body.submissionId ? digest : null,
            })
            .onConflictDoNothing({ target: entries.submissionKey })
            .returning({ id: entries.id });
          if (row) return received(row);
          const existing = body.submissionId
            ? await tx.query.jamaahRoomEntries.findFirst({
                where: eq(entries.submissionKey, body.submissionId),
                columns: { id: true, submissionDigest: true },
              })
            : null;
          if (existing?.submissionDigest === digest) return received(existing);
          throw new RoomError(
            "Kiriman belum dapat disimpan. Periksa nomor referensi sebelum mencoba kembali.",
            409,
          );
        });
      } catch (error) {
        if (error instanceof RoomError)
          return errorResponse(
            error.status === 404 ? "NOT_FOUND" : "CONFLICT",
            error.message,
            error.status,
            ctx.requestId,
          );
        throw error;
      }
    }),
  );
  router.get("/api/public/jamaah-room/stories", async (ctx) => {
    await ensureRoomTables();
    const stories = await getDb()
      .select({
        id: entries.id,
        subject: entries.publicTitle,
        message: entries.publicText,
        name: entries.name,
        anonymousPublication: entries.anonymousPublication,
        publishedAt: entries.publishedAt,
        eventTitle: events.title,
        eventStatus: events.status,
      })
      .from(entries)
      .leftJoin(events, eq(entries.eventId, events.id))
      .where(
        and(
          isNotNull(entries.publishedAt),
          eq(entries.publicationConsent, true),
          inArray(entries.category, ["cerita", "pengalaman"]),
          isNull(entries.archivedAt),
          isNotNull(entries.publicTitle),
          isNotNull(entries.publicText),
        ),
      )
      .orderBy(desc(entries.publishedAt))
      .limit(24);
    const safe = stories
      .filter((row) => publicRoomTextSafe(row.subject, row.message))
      .slice(0, 12)
      .map(({ name, anonymousPublication, eventStatus: _, ...story }) => ({
        ...story,
        displayName:
          !anonymousPublication && name && !containsContactDetail(name)
            ? name
            : "Jamaah YTS",
      }));
    return successResponse(safe, { requestId: ctx.requestId }, 200, {
      "Cache-Control": "no-store",
    });
  });
}
