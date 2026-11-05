import crypto from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  auditLogs,
  persons,
  personRoles,
  kajianRutinAttendance as attendance,
  kajianRutinSeries as series,
  kajianRutinSessions as sessions,
} from "../../db/schema";
import { isValidE164, normalizePhoneE164 } from "../../lib/phone";

export class RoutineError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const routinePhoneSql = (value: ReturnType<typeof sql>) =>
  sql`CASE WHEN coalesce(${value},'') ~ '[a-zA-Z]' THEN NULL WHEN regexp_replace(coalesce(${value},''),'[^0-9]','','g') LIKE '08%' THEN '62'||substring(regexp_replace(${value},'[^0-9]','','g') from 2) WHEN regexp_replace(coalesce(${value},''),'[^0-9]','','g') LIKE '8%' THEN '62'||regexp_replace(${value},'[^0-9]','','g') ELSE nullif(regexp_replace(coalesce(${value},''),'[^0-9]','','g'),'') END`;
/** Resolve only unambiguous historical contacts; an explicit FK always wins. */
export const routinePersonIdSql = sql<
  string | null
>`coalesce(${attendance.personId},(SELECT CASE WHEN count(*)=1 THEN min(p.id::text)::uuid END FROM persons p WHERE (nullif(lower(btrim(${attendance.email})), '')=lower(btrim(p.email))) OR (${routinePhoneSql(sql`${attendance.phone}`)}=${routinePhoneSql(sql`p.phone_e164`)})))`;
export const routineIdentitySql = sql<string>`coalesce('person:'||(${routinePersonIdSql})::text,'email:'||nullif(lower(btrim(${attendance.email})),''),'phone:'||${routinePhoneSql(sql`${attendance.phone}`)},'google:'||${attendance.googleSub})`;

type PresenceInput = {
  sessionId: string;
  personId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  gender?: "ikhwan" | "akhwat" | null;
  accountId?: string | null;
  googleSub?: string;
  token?: string | null;
  source: string;
  note?: string | null;
  actorUserId?: string;
  requestId: string;
  public?: boolean;
};
export async function recordRoutinePresence(input: PresenceInput) {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() ? normalizePhoneE164(input.phone) : null;
  if (
    input.phone?.trim() &&
    (!/^[+\d\s().-]+$/.test(input.phone) || !isValidE164(phone))
  )
    throw new RoutineError("Nomor WhatsApp tidak valid.");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    // Lock order is always series, session, identity. All attendance writers use this path.
    await tx.execute(
      sql`SELECT r.id FROM kajian_rutin_series r JOIN kajian_rutin_sessions s ON s.series_id=r.id WHERE s.id=${input.sessionId} FOR UPDATE OF r`,
    );
    await tx.execute(
      sql`SELECT id FROM kajian_rutin_sessions WHERE id=${input.sessionId} FOR UPDATE`,
    );
    const [context] = await tx
      .select({ session: sessions, series })
      .from(sessions)
      .innerJoin(series, eq(sessions.seriesId, series.id))
      .where(eq(sessions.id, input.sessionId));
    if (!context) throw new RoutineError("Sesi tidak ditemukan.", 404);
    if (!context.series.isActive || context.session.status === "cancelled")
      throw new RoutineError(
        "Seri diarsipkan atau sesi dibatalkan. Presensi ditutup.",
        409,
      );
    if (input.token && input.token !== context.session.qrToken)
      throw new RoutineError("QR sudah diganti. Gunakan QR terbaru.", 403);
    if (input.public) {
      const open =
        +context.session.startAt - context.series.checkInOpenMinutes * 60_000;
      const close =
        +(
          context.session.endAt ||
          new Date(+context.session.startAt + 7_200_000)
        ) +
        context.series.checkInCloseMinutes * 60_000;
      if (Date.now() < open || Date.now() > close)
        throw new RoutineError(
          "Presensi berada di luar waktu yang dibuka panitia.",
          403,
        );
    }
    // Serialize contact claims across different series too, without exposing contact data in lock names.
    for (const key of [email && `email:${email}`, phone && `phone:${phone}`]
      .filter(Boolean)
      .sort())
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`,
      );
    const matches = await tx
      .select()
      .from(persons)
      .where(
        or(
          input.personId ? eq(persons.id, input.personId) : undefined,
          email ? sql`lower(btrim(${persons.email}))=${email}` : undefined,
          phone
            ? sql`${routinePhoneSql(sql`${persons.phoneE164}`)}=${phone.slice(1)}`
            : undefined,
        ) || sql`false`,
      )
      .limit(3);
    if (matches.length > 1)
      throw new RoutineError(
        "Kontak cocok dengan beberapa Jamaah. Rapikan duplikat di menu Jamaah terlebih dahulu.",
        409,
      );
    let person = matches[0];
    if (input.personId && person?.id !== input.personId)
      throw new RoutineError("Jamaah atau kontak tidak cocok.", 409);
    if (person && !person.isActive)
      throw new RoutineError(
        "Jamaah diarsipkan. Pulihkan profil sebelum mencatat hadir.",
        409,
      );
    const gender = person?.gender || input.gender;
    if (context.series.targetAudience === "ikhwan_only" && gender !== "ikhwan")
      throw new RoutineError(
        "Kajian khusus Ikhwan. Pastikan gender profil sesuai.",
      );
    if (context.series.targetAudience === "akhwat_only" && gender !== "akhwat")
      throw new RoutineError(
        "Kajian khusus Akhwat. Pastikan gender profil sesuai.",
      );
    const existingRows = await tx
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionId, input.sessionId),
          or(
            person ? eq(attendance.personId, person.id) : undefined,
            input.googleSub
              ? eq(attendance.googleSub, input.googleSub)
              : undefined,
            email ? sql`lower(btrim(${attendance.email}))=${email}` : undefined,
            phone
              ? sql`${routinePhoneSql(sql`${attendance.phone}`)}=${phone.slice(1)}`
              : undefined,
          ) || sql`false`,
        ),
      );
    if (existingRows.length) {
      const existing = existingRows[0]!;
      if (input.public && existing.status === "present")
        return { attendance: existing, alreadyAbsen: true };
      throw new RoutineError(
        existing.status === "present"
          ? "Jamaah sudah tercatat hadir pada sesi ini."
          : "Presensi pernah dikoreksi. Minta panitia memulihkan catatan yang sama.",
        409,
      );
    }
    const [count] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionId, input.sessionId),
          eq(attendance.status, "present"),
        ),
      );
    if (context.series.quota && Number(count?.total) >= context.series.quota)
      throw new RoutineError("Kuota sesi sudah penuh.", 409);
    if (!person) {
      [person] = await tx
        .insert(persons)
        .values({
          fullName: input.fullName,
          email,
          phoneE164: phone,
          gender: input.gender || null,
          sourceCode: "kajian_rutin",
          ownerUserId: input.actorUserId || null,
        })
        .returning();
    } else {
      const missing = {
        ...(!person.email && email ? { email } : {}),
        ...(!person.phoneE164 && phone ? { phoneE164: phone } : {}),
        ...(!person.gender && input.gender ? { gender: input.gender } : {}),
      };
      if (Object.keys(missing).length)
        await tx
          .update(persons)
          .set({ ...missing, updatedAt: new Date() })
          .where(eq(persons.id, person.id));
    }
    if (!person)
      throw new RoutineError("Profil Jamaah belum dapat disimpan.", 500);
    await tx
      .insert(personRoles)
      .values({ personId: person.id, roleCode: "jamaah" })
      .onConflictDoNothing();
    const [created] = await tx
      .insert(attendance)
      .values({
        sessionId: input.sessionId,
        seriesId: context.series.id,
        personId: person.id,
        accountId: input.accountId || null,
        googleSub: input.googleSub || `manual:${crypto.randomUUID()}`,
        fullName: person.fullName,
        email: email || person.email,
        phone: phone || person.phoneE164,
        source: input.source,
        status: "present",
        note: input.note || null,
      })
      .returning();
    await tx
      .insert(auditLogs)
      .values({
        actorUserId: input.actorUserId || null,
        action: "kajian_rutin_attendance_create",
        entityType: "kajian_rutin_attendance",
        entityId: created!.id,
        afterJson: {
          personId: person.id,
          sessionId: input.sessionId,
          source: input.source,
        },
        requestId: input.requestId,
      });
    return { attendance: created!, alreadyAbsen: false };
  });
}

export async function correctRoutinePresence(
  id: string,
  status: "present" | "voided",
  actorUserId: string,
  reason: string,
  requestId: string,
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    const [before] = await tx
      .select()
      .from(attendance)
      .where(eq(attendance.id, id));
    if (!before) throw new RoutineError("Presensi tidak ditemukan.", 404);
    await tx.execute(
      sql`SELECT id FROM kajian_rutin_series WHERE id=${before.seriesId} FOR UPDATE`,
    );
    await tx.execute(
      sql`SELECT id FROM kajian_rutin_sessions WHERE id=${before.sessionId} FOR UPDATE`,
    );
    const [current] = await tx
      .select()
      .from(attendance)
      .where(eq(attendance.id, id));
    if (current!.status === status) return current!;
    if (status === "present") {
      if (current!.personId) {
        const [profile] = await tx
          .select({ active: persons.isActive })
          .from(persons)
          .where(eq(persons.id, current!.personId));
        if (!profile?.active)
          throw new RoutineError(
            "Profil diarsipkan atau digabung. Periksa profil utama sebelum memulihkan presensi.",
            409,
          );
      }
      const [config] = await tx
        .select()
        .from(series)
        .where(eq(series.id, before.seriesId));
      const [count] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(attendance)
        .where(
          and(
            eq(attendance.sessionId, before.sessionId),
            eq(attendance.status, "present"),
          ),
        );
      if (config?.quota && Number(count?.total) >= config.quota)
        throw new RoutineError(
          "Kuota penuh. Koreksi peserta lain terlebih dahulu.",
          409,
        );
    }
    const [updated] = await tx
      .update(attendance)
      .set({ status })
      .where(eq(attendance.id, id))
      .returning();
    await tx
      .insert(auditLogs)
      .values({
        actorUserId,
        action: "kajian_rutin_attendance_correct",
        entityType: "kajian_rutin_attendance",
        entityId: id,
        beforeJson: { status: current!.status },
        afterJson: { status },
        reason,
        requestId,
      });
    return updated!;
  });
}
