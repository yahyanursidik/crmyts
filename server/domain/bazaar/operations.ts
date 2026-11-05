import { and, eq, or, sql, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  events,
  bazaarEvents,
  bazaarApplications,
  bazaarBooths,
  bazaarTenants,
  bazaarSurveys,
  bazaarIncidents,
  bazaarEvaluations,
  persons,
  personRoles,
  auditLogs,
} from "../../db/schema";
import { normalizePhoneE164, isValidE164 } from "../../lib/phone";
import {
  bazaarBankConfigured,
  bazaarPaymentConfirmed,
  bazaarRegistrationOpen,
  bazaarElectricityFee,
  BAZAAR_PLACED,
  BAZAAR_QUOTA_STATES,
} from "../../../src/lib/bazaarPolicy";
import { ensureS3StorageUrl } from "../../storage/providers/s3";
import { createBazaarAccess } from "./accessToken";
type Database = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Actor = { id: string; requestId: string };
export class BazaarError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function configureBazaar(
  eventId: string,
  body: any,
  actor: Actor,
  create = false,
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    await tx.execute(sql`SELECT id FROM events WHERE id=${eventId} FOR UPDATE`);
    const event = await tx.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) throw new BazaarError("Event tidak ditemukan.", 404);
    const before = await tx.query.bazaarEvents.findFirst({
      where: eq(bazaarEvents.eventId, eventId),
    });
    if (create && before) throw new BazaarError("Bazar sudah ada.", 409);
    if (!create && !before) throw new BazaarError("Bazar belum dibuat.", 404);
    const values = {
      ...body,
      ...Object.fromEntries(
        ["registrationDeadline", "paymentDeadline", "surveyDeadline"]
          .filter((key) => body[key] !== undefined)
          .map((key) => [key, body[key] ? new Date(body[key]) : null]),
      ),
    };
    const effective = { ...before, ...values };
    if (effective.paymentEnabled === true && !bazaarBankConfigured(effective))
      throw new BazaarError(
        "Lengkapi rekening resmi sebelum mengaktifkan pembayaran.",
      );
    if (
      effective.registrationDeadline &&
      effective.paymentDeadline &&
      +effective.paymentDeadline < +effective.registrationDeadline
    )
      throw new BazaarError(
        "Batas pembayaran harus setelah batas pendaftaran.",
      );
    if (effective.surveyDeadline && +effective.surveyDeadline < +event.startAt)
      throw new BazaarError("Batas survei harus setelah jadwal event.");
    const [updated] = create
      ? await tx
          .insert(bazaarEvents)
          .values({
            ...values,
            eventId,
            layoutZones: body.layoutZones || [
              { id: "utama", name: "Zona Utama" },
            ],
          })
          .returning()
      : await tx
          .update(bazaarEvents)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(bazaarEvents.id, before!.id))
          .returning();
    await audit(
      tx,
      actor,
      create ? "bazaar_create" : "bazaar_configure",
      "bazaar",
      updated!.id,
      before,
      updated,
    );
    return updated;
  });
}
const normalizedPhone = (value: string) => {
  const phone = normalizePhoneE164(value);
  if (!/^[+\d\s().-]+$/.test(value) || !isValidE164(phone))
    throw new BazaarError("Nomor WhatsApp tidak valid.");
  return phone!;
};
async function audit(
  tx: Tx,
  actor: Actor | undefined,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  await tx
    .insert(auditLogs)
    .values({
      actorUserId: actor?.id || null,
      requestId: actor?.requestId || null,
      action,
      entityType,
      entityId,
      beforeJson: before,
      afterJson: after,
      reason: reason || null,
    });
}
async function lockBazaar<T>(
  eventOrBazaarId: string,
  action: (
    tx: Tx,
    bazaar: typeof bazaarEvents.$inferSelect,
    event: typeof events.$inferSelect,
  ) => Promise<T>,
  allowAlias = false,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    const initial = await tx.query.bazaarEvents.findFirst({
      where: allowAlias
        ? or(
            eq(bazaarEvents.eventId, eventOrBazaarId),
            eq(bazaarEvents.id, eventOrBazaarId),
          )
        : eq(bazaarEvents.eventId, eventOrBazaarId),
    });
    if (!initial) throw new BazaarError("Bazar tidak ditemukan.", 404);
    await tx.execute(
      sql`SELECT id FROM events WHERE id=${initial.eventId} FOR UPDATE`,
    );
    await tx.execute(
      sql`SELECT id FROM bazaar_events WHERE id=${initial.id} FOR UPDATE`,
    );
    const bazaar = await tx.query.bazaarEvents.findFirst({
      where: eq(bazaarEvents.id, initial.id),
    });
    const event = await tx.query.events.findFirst({
      where: eq(events.id, initial.eventId),
    });
    if (!bazaar || !event)
      throw new BazaarError("Bazar atau event tidak ditemukan.", 404);
    return action(tx, bazaar, event);
  });
}
async function application(tx: Tx, bazaarId: string, id: string) {
  const app = await tx.query.bazaarApplications.findFirst({
    where: and(
      eq(bazaarApplications.id, id),
      eq(bazaarApplications.bazaarId, bazaarId),
    ),
    with: { tenant: true },
  });
  if (!app)
    throw new BazaarError("Pendaftaran tidak ditemukan pada bazar ini.", 404);
  return app;
}
async function categoryCapacity(
  tx: Tx,
  bazaar: typeof bazaarEvents.$inferSelect,
  category: string,
  excludeId?: string,
) {
  const quota = bazaar.categoryQuotas?.find(
    (row) => row.category === category,
  )?.maxQuota;
  if (!quota) return true;
  const apps = await tx.query.bazaarApplications.findMany({
    where: and(
      eq(bazaarApplications.bazaarId, bazaar.id),
      inArray(bazaarApplications.status, BAZAAR_QUOTA_STATES),
    ),
    with: { tenant: true },
  });
  return (
    apps.filter(
      (row) => row.id !== excludeId && row.tenant.businessCategory === category,
    ).length < quota
  );
}
async function releaseBooth(
  tx: Tx,
  app: typeof bazaarApplications.$inferSelect,
) {
  if (!app.assignedBoothId) return;
  const other = await tx.query.bazaarApplications.findFirst({
    where: and(
      eq(bazaarApplications.assignedBoothId, app.assignedBoothId),
      inArray(bazaarApplications.status, BAZAAR_PLACED),
      sql`${bazaarApplications.id}<>${app.id}`,
    ),
  });
  if (!other)
    await tx
      .update(bazaarBooths)
      .set({ status: "available", updatedAt: new Date() })
      .where(eq(bazaarBooths.id, app.assignedBoothId));
}
export async function changeApplication(
  eventId: string,
  id: string,
  body: any,
  actor: Actor,
  feeOnly = false,
) {
  return lockBazaar(eventId, async (tx, bazaar, event) => {
    const before = await application(tx, bazaar.id, id);
    const status = body.status || before.status;
    if (
      event.status === "cancelled" &&
      !["cancelled", "rejected"].includes(status)
    )
      throw new BazaarError(
        "Event dibatalkan. Perubahan operasional ditutup.",
        409,
      );
    if (
      ["booth_assigned", "checked_in", "completed"].includes(status) &&
      status !== before.status
    )
      throw new BazaarError(
        "Gunakan penetapan stan, check-in, atau survei untuk tahap ini.",
        409,
      );
    const allowed: Record<string, string[]> = {
      draft: ["submitted", "cancelled"],
      submitted: [
        "under_review",
        "accepted",
        "waitlist",
        "rejected",
        "cancelled",
        "payment_pending",
        "payment_verification",
      ],
      under_review: [
        "accepted",
        "waitlist",
        "rejected",
        "cancelled",
        "payment_pending",
        "payment_verification",
      ],
      waitlist: ["under_review", "accepted", "rejected", "cancelled"],
      accepted: [
        "payment_pending",
        "payment_verification",
        "payment_verified",
        "waitlist",
        "rejected",
        "cancelled",
      ],
      payment_pending: [
        "payment_verification",
        "payment_verified",
        "waitlist",
        "cancelled",
      ],
      payment_verification: [
        "payment_pending",
        "payment_verified",
        "cancelled",
      ],
      payment_verified: ["payment_pending", "cancelled"],
      booth_assigned: ["cancelled"],
      checked_in: ["cancelled"],
      completed: [],
      cancelled: ["under_review"],
      rejected: ["under_review"],
    };
    if (status !== before.status && !allowed[before.status]?.includes(status))
      throw new BazaarError(
        "Perubahan tahap tidak sesuai alur. Tinjau pendaftaran dan pembayaran terlebih dahulu.",
        409,
      );
    if (
      ["cancelled", "rejected"].includes(status) &&
      status !== before.status &&
      !(body.rejectionReason || body.adminNotes || body.paymentNotes)?.trim()
    )
      throw new BazaarError("Isi alasan penolakan atau pembatalan.");
    if (
      BAZAAR_QUOTA_STATES.includes(status) &&
      !BAZAAR_QUOTA_STATES.includes(before.status) &&
      !(await categoryCapacity(tx, bazaar, before.tenant.businessCategory, id))
    )
      throw new BazaarError(
        "Kuota kategori penuh. Pertahankan di daftar tunggu.",
        409,
      );
    const amount = body.infaqAmountRupiah ?? before.infaqAmountRupiah;
    const feeChanged = amount !== before.infaqAmountRupiah;
    if (feeChanged && ["checked_in", "completed"].includes(before.status))
      throw new BazaarError(
        "Biaya tenant yang sudah hadir tidak diubah melalui alur ini.",
        409,
      );
    const verify =
      !feeOnly &&
      body.status === "payment_verified" &&
      (before.status !== "payment_verified" ||
        feeChanged ||
        !before.paymentVerifiedAt);
    if (
      verify &&
      amount > 0 &&
      !before.paymentProofUrl &&
      !(body.paymentNotes || before.paymentNotes)?.trim()
    )
      throw new BazaarError(
        "Isi catatan verifikasi pembayaran langsung atau periksa bukti transfer.",
      );
    const reset = feeChanged && !!before.paymentVerifiedAt && !verify;
    let nextStatus = reset ? "payment_pending" : status;
    if (feeChanged && before.status === "booth_assigned")
      nextStatus = "payment_pending";
    if (
      ["cancelled", "rejected", "waitlist"].includes(nextStatus) ||
      (nextStatus === "payment_pending" && before.status === "booth_assigned")
    )
      await releaseBooth(tx, before);
    const [updated] = await tx
      .update(bazaarApplications)
      .set({
        status: nextStatus,
        infaqAmountRupiah: amount,
        ...(body.rejectionReason !== undefined
          ? { rejectionReason: body.rejectionReason }
          : {}),
        ...(body.adminNotes !== undefined
          ? { adminNotes: body.adminNotes }
          : {}),
        ...(body.paymentNotes !== undefined
          ? { paymentNotes: body.paymentNotes }
          : {}),
        paymentVerifiedAt: verify
          ? new Date()
          : reset ||
              ["payment_pending", "payment_verification"].includes(nextStatus)
            ? null
            : before.paymentVerifiedAt,
        paymentVerifiedBy: verify
          ? actor.id
          : reset ||
              ["payment_pending", "payment_verification"].includes(nextStatus)
            ? null
            : before.paymentVerifiedBy,
        ...(!BAZAAR_PLACED.includes(nextStatus) ? { isPublished: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bazaarApplications.id, id))
      .returning();
    await audit(
      tx,
      actor,
      feeOnly ? "bazaar_fee_update" : "bazaar_status_update",
      "bazaar_application",
      id,
      before,
      updated,
      body.rejectionReason || body.adminNotes || body.paymentNotes,
    );
    return updated;
  });
}
export async function assignBazaarBooth(
  eventId: string,
  id: string,
  body: any,
  actor: Actor,
) {
  return lockBazaar(eventId, async (tx, bazaar, event) => {
    const before = await application(tx, bazaar.id, id);
    if (
      event.status === "cancelled" ||
      ["rejected", "cancelled", "completed"].includes(before.status)
    )
      throw new BazaarError("Pendaftaran atau event sudah ditutup.", 409);
    if (["checked_in"].includes(before.status))
      throw new BazaarError(
        "Penempatan tenant yang sudah check-in tidak diubah melalui alur ini.",
        409,
      );
    if (!body.boothId) {
      await releaseBooth(tx, before);
      const [updated] = await tx
        .update(bazaarApplications)
        .set({
          assignedBoothId: null,
          isPublished: false,
          status:
            before.status === "booth_assigned"
              ? "payment_verified"
              : before.status,
          updatedAt: new Date(),
        })
        .where(eq(bazaarApplications.id, id))
        .returning();
      await audit(
        tx,
        actor,
        "bazaar_unassign",
        "bazaar_application",
        id,
        before,
        updated,
      );
      return updated;
    }
    if (!bazaarPaymentConfirmed(before))
      throw new BazaarError(
        "Verifikasi pembayaran atau pembebasan biaya sebelum menetapkan stan.",
        409,
      );
    const booth = await tx.query.bazaarBooths.findFirst({
      where: and(
        eq(bazaarBooths.id, body.boothId),
        eq(bazaarBooths.bazaarId, bazaar.id),
      ),
    });
    if (!booth)
      throw new BazaarError("Stan tidak ditemukan pada bazar ini.", 404);
    const occupant = await tx.query.bazaarApplications.findFirst({
      where: and(
        eq(bazaarApplications.assignedBoothId, booth.id),
        inArray(bazaarApplications.status, BAZAAR_PLACED),
        sql`${bazaarApplications.id}<>${id}`,
      ),
    });
    if (
      occupant ||
      booth.status === "blocked" ||
      (booth.status === "assigned" && before.assignedBoothId !== booth.id)
    )
      throw new BazaarError("Stan sudah terisi atau dinonaktifkan.", 409);
    if (
      booth.status === "reserved" &&
      body.placementReason !== "partner_reserved"
    )
      throw new BazaarError(
        "Stan mitra memerlukan alasan penempatan mitra.",
        409,
      );
    if (
      booth.allowedCategory &&
      booth.allowedCategory !== "all" &&
      booth.allowedCategory !== before.tenant.businessCategory
    )
      throw new BazaarError(
        "Kategori tenant tidak sesuai dengan stan. Ubah alokasi kategori secara eksplisit bila diperlukan.",
        409,
      );
    const amount =
      body.infaqAmountRupiah ??
      (body.syncBoothPrice
        ? booth.priceRupiah +
          (bazaarElectricityFee(
            before.electricityNeeded,
            before.electricityWatts || 0,
          ) || 0)
        : before.infaqAmountRupiah);
    if (amount !== before.infaqAmountRupiah)
      throw new BazaarError(
        "Tarif stan berbeda dari biaya terverifikasi. Perbarui dan verifikasi biaya terlebih dahulu, atau gunakan biaya kontrak yang sudah disetujui.",
        409,
      );
    if (before.assignedBoothId !== booth.id) await releaseBooth(tx, before);
    await tx
      .update(bazaarBooths)
      .set({ status: "assigned", updatedAt: new Date() })
      .where(eq(bazaarBooths.id, booth.id));
    const [updated] = await tx
      .update(bazaarApplications)
      .set({
        assignedBoothId: booth.id,
        placementReason: body.placementReason || "custom",
        placementNotes: body.placementNotes || null,
        assignedBy: actor.id,
        assignedAt:
          before.assignedBoothId === booth.id ? before.assignedAt : new Date(),
        status: "booth_assigned",
        isPublished: body.isPublished ?? before.isPublished,
        updatedAt: new Date(),
      })
      .where(eq(bazaarApplications.id, id))
      .returning();
    await audit(
      tx,
      actor,
      "bazaar_assign",
      "bazaar_application",
      id,
      before,
      updated,
    );
    return { ...updated, smartWarning: null };
  });
}
export async function checkInBazaar(eventId: string, id: string, actor: Actor) {
  return lockBazaar(eventId, async (tx, bazaar, event) => {
    const before = await application(tx, bazaar.id, id);
    if (["checked_in", "completed"].includes(before.status)) return before;
    if (
      event.status === "cancelled" ||
      before.status !== "booth_assigned" ||
      !before.assignedBoothId ||
      !bazaarPaymentConfirmed(before)
    )
      throw new BazaarError(
        "Tenant harus memiliki stan dan pembayaran terverifikasi sebelum check-in.",
        409,
      );
    const [updated] = await tx
      .update(bazaarApplications)
      .set({
        status: "checked_in",
        checkedInAt: before.checkedInAt || new Date(),
        checkedInBy: before.checkedInBy || actor.id,
        updatedAt: new Date(),
      })
      .where(eq(bazaarApplications.id, id))
      .returning();
    await audit(
      tx,
      actor,
      "bazaar_check_in",
      "bazaar_application",
      id,
      { status: before.status },
      { status: updated!.status },
    );
    return updated;
  });
}

export async function mutateBooth(
  eventId: string,
  id: string | undefined,
  body: any,
  actor: Actor,
  operation: "update" | "delete" | "bulk" | "pricing",
) {
  return lockBazaar(eventId, async (tx, bazaar) => {
    if (operation === "bulk") {
      const codes = body.booths.map((row: any) =>
        row.code.trim().toUpperCase(),
      );
      if (new Set(codes).size !== codes.length)
        throw new BazaarError("Kode stan pada daftar tidak boleh berulang.");
      const existing = await tx.query.bazaarBooths.findMany({
        where: and(
          eq(bazaarBooths.bazaarId, bazaar.id),
          inArray(bazaarBooths.code, codes),
        ),
      });
      if (existing.length)
        throw new BazaarError(
          "Sebagian kode stan sudah ada. Tidak ada stan yang ditambahkan.",
          409,
        );
      const rows = await tx
        .insert(bazaarBooths)
        .values(
          body.booths.map((row: any) => ({
            ...row,
            code: row.code.trim().toUpperCase(),
            bazaarId: bazaar.id,
            status: "available",
          })),
        )
        .returning();
      await audit(
        tx,
        actor,
        "bazaar_booths_create",
        "bazaar",
        bazaar.id,
        null,
        { ids: rows.map((row) => row.id) },
      );
      return rows;
    }
    if (operation === "pricing") {
      const filters = [eq(bazaarBooths.bazaarId, bazaar.id)];
      if (body.zone && body.zone !== "ALL")
        filters.push(eq(bazaarBooths.zone, body.zone));
      if (body.size && body.size !== "ALL")
        filters.push(eq(bazaarBooths.size, body.size));
      const before = await tx.query.bazaarBooths.findMany({
        where: and(...filters),
      });
      const rows = await tx
        .update(bazaarBooths)
        .set({ priceRupiah: body.priceRupiah, updatedAt: new Date() })
        .where(and(...filters))
        .returning();
      await audit(
        tx,
        actor,
        "bazaar_booths_pricing",
        "bazaar",
        bazaar.id,
        before,
        rows,
      );
      return rows;
    }
    const before = await tx.query.bazaarBooths.findFirst({
      where: and(
        eq(bazaarBooths.id, id!),
        eq(bazaarBooths.bazaarId, bazaar.id),
      ),
    });
    if (!before)
      throw new BazaarError("Stan tidak ditemukan pada bazar ini.", 404);
    const history = await tx.query.bazaarApplications.findMany({
      where: eq(bazaarApplications.assignedBoothId, before.id),
    });
    if (operation === "delete") {
      if (history.length)
        throw new BazaarError(
          "Stan memiliki riwayat. Gunakan Nonaktifkan untuk menjaga riwayat.",
          409,
        );
      await tx.delete(bazaarBooths).where(eq(bazaarBooths.id, before.id));
      await audit(
        tx,
        actor,
        "bazaar_booth_delete",
        "bazaar_booth",
        before.id,
        before,
        null,
      );
      return { success: true };
    }
    const occupied = history.some((row) => BAZAAR_PLACED.includes(row.status));
    if (
      occupied &&
      ((body.status && body.status !== "assigned") ||
        (body.allowedCategory &&
          body.allowedCategory !== before.allowedCategory))
    )
      throw new BazaarError(
        "Stan sedang ditempati. Lepaskan penempatan tenant terlebih dahulu.",
        409,
      );
    if (body.status === "assigned" && !occupied)
      throw new BazaarError(
        "Gunakan penetapan tenant untuk mengisi stan.",
        409,
      );
    if (
      body.status === "reserved" &&
      (!body.reservedReason?.trim() || !body.reservedForPartnerName?.trim())
    )
      throw new BazaarError("Isi nama mitra dan alasan reservasi.");
    const [updated] = await tx
      .update(bazaarBooths)
      .set({
        ...body,
        ...(body.code ? { code: body.code.trim().toUpperCase() } : {}),
        reservedBy: body.status === "reserved" ? actor.id : before.reservedBy,
        updatedAt: new Date(),
      })
      .where(eq(bazaarBooths.id, before.id))
      .returning();
    await audit(
      tx,
      actor,
      "bazaar_booth_update",
      "bazaar_booth",
      before.id,
      before,
      updated,
    );
    return updated;
  });
}

async function personForTenant(tx: Tx, input: any, actor?: Actor) {
  const phone = normalizedPhone(input.picPhone);
  const email = input.picEmail?.trim().toLowerCase() || null;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`,
  );
  const candidates = await tx
    .select()
    .from(persons)
    .where(
      or(
        eq(persons.phoneE164, phone),
        email ? sql`lower(btrim(${persons.email}))=${email}` : undefined,
        input.personId ? eq(persons.id, input.personId) : undefined,
      ),
    )
    .limit(3);
  if (candidates.length > 1)
    throw new BazaarError(
      "Kontak cocok dengan beberapa Jamaah. Tinjau duplikat terlebih dahulu.",
      409,
    );
  let person = candidates[0];
  if (input.personId && person?.id !== input.personId)
    throw new BazaarError("Profil Jamaah dan kontak tidak cocok.", 409);
  if (person && !person.isActive)
    throw new BazaarError("Profil Jamaah diarsipkan. Hubungi pengelola.", 409);
  if (!person)
    [person] = await tx
      .insert(persons)
      .values({
        fullName: input.picName,
        phoneE164: phone,
        email,
        sourceCode: "BAZAAR_PORTAL",
        ownerUserId: actor?.id || null,
      })
      .returning();
  await tx
    .insert(personRoles)
    .values({ personId: person!.id, roleCode: "jamaah" })
    .onConflictDoNothing();
  return person!.id;
}
export async function publicApplyBazaar(eventId: string, body: any) {
  const phone = normalizedPhone(body.picPhone);
  const proof = await ensureS3StorageUrl(
    body.paymentProofUrl,
    "bazaar-proofs",
    "bazar",
  );
  return lockBazaar(
    eventId,
    async (tx, bazaar, event) => {
      if (!bazaarRegistrationOpen(bazaar, event))
        throw new BazaarError(
          "Pendaftaran bazar sedang ditutup atau event sudah berakhir.",
          403,
        );
      if (proof && !bazaarBankConfigured(bazaar))
        throw new BazaarError(
          "Rekening belum dikonfigurasi. Daftar tanpa bukti pembayaran terlebih dahulu.",
          409,
        );
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`,
      );
      const matches = await tx.query.bazaarTenants.findMany({
        where: and(
          eq(bazaarTenants.picPhone, phone),
          sql`lower(btrim(${bazaarTenants.brandName}))=${body.brandName.trim().toLowerCase()}`,
        ),
      });
      if (matches.length > 1)
        throw new BazaarError(
          "Profil tenant berulang. Hubungi pengelola untuk pemeriksaan.",
          409,
        );
      let tenant = matches[0];
      if (tenant) {
        const existing = await tx.query.bazaarApplications.findFirst({
          where: and(
            eq(bazaarApplications.bazaarId, bazaar.id),
            eq(bazaarApplications.tenantId, tenant.id),
          ),
        });
        if (existing)
          throw new BazaarError(
            "Usaha sudah terdaftar. Gunakan kode akses yang diterima saat pendaftaran atau hubungi panitia.",
            409,
          );
      }
      const booths = await tx.query.bazaarBooths.findMany({
        where: eq(bazaarBooths.bazaarId, bazaar.id),
      });
      const preference = body.boothPreferences
        ? booths.find(
            (row) =>
              row.code.toLowerCase() ===
              body.boothPreferences.trim().toLowerCase(),
          )
        : undefined;
      if (booths.length && !preference)
        throw new BazaarError("Pilih preferensi stan yang tersedia.");
      if (preference && preference.status !== "available")
        throw new BazaarError(
          "Stan pilihan sudah tidak tersedia. Pilih preferensi lain.",
          409,
        );
      if (
        preference &&
        preference.allowedCategory !== "all" &&
        preference.allowedCategory !== body.businessCategory
      )
        throw new BazaarError(
          "Kategori usaha tidak sesuai dengan stan pilihan.",
        );
      const electricity = bazaarElectricityFee(
        body.electricityNeeded,
        body.electricityWatts || 0,
      );
      if (electricity === null)
        throw new BazaarError("Pilihan daya listrik tidak valid.");
      const amount =
        (preference?.priceRupiah ?? bazaar.defaultFeeRupiah) + electricity;
      if (!tenant) {
        const personId = await personForTenant(tx, body);
        [tenant] = await tx
          .insert(bazaarTenants)
          .values({
            personId,
            brandName: body.brandName.trim(),
            businessCategory: body.businessCategory,
            picName: body.picName,
            picPhone: phone,
            picEmail: body.picEmail || null,
            picKtpNumber: body.picKtpNumber || null,
            instagram: body.instagram || null,
            threads: body.threads || null,
            websiteUrl: body.websiteUrl || null,
            logoUrl: body.logoUrl || null,
            googleDriveCatalogUrl: body.googleDriveCatalogUrl || null,
            address: body.address || null,
            productDescription: body.productDescription,
            catalogUrls: body.catalogUrl ? [body.catalogUrl] : [],
            internalTags: ["Pendaftar Baru"],
          })
          .returning();
      }
      const capacity = await categoryCapacity(
        tx,
        bazaar,
        tenant!.businessCategory,
      );
      const [created] = await tx
        .insert(bazaarApplications)
        .values({
          bazaarId: bazaar.id,
          tenantId: tenant!.id,
          status: capacity ? "submitted" : "waitlist",
          electricityNeeded: body.electricityNeeded,
          electricityWatts: body.electricityNeeded
            ? body.electricityWatts || 0
            : 0,
          specialRequests: body.specialRequests || null,
          boothPreferences: preference?.code || body.boothPreferences || null,
          infaqAmountRupiah: amount,
          paymentProofUrl: proof,
        })
        .returning();
      await audit(
        tx,
        undefined,
        "bazaar_apply",
        "bazaar_application",
        created!.id,
        null,
        { bazaarId: bazaar.id, tenantId: tenant!.id, status: created!.status },
      );
      return {
        application: created,
        tenant: {
          id: tenant!.id,
          brandName: tenant!.brandName,
          picName: tenant!.picName,
          picPhone: tenant!.picPhone,
        },
        bazaarTitle: bazaar.title,
        accessToken: createBazaarAccess(created!.id, bazaar.id),
        eventId: event.id,
      };
    },
    true,
  );
}

export async function submitBazaarSurvey(
  eventId: string,
  body: any,
  access: { applicationId: string; bazaarId: string } | null,
) {
  if (!access)
    throw new BazaarError(
      "Gunakan kode akses pribadi dari bukti pendaftaran atau hubungi panitia.",
      401,
    );
  return lockBazaar(
    eventId,
    async (tx, bazaar, event) => {
      if (
        access.bazaarId !== bazaar.id ||
        (body.applicationId && body.applicationId !== access.applicationId)
      )
        throw new BazaarError(
          "Kode akses tidak sesuai dengan pendaftaran.",
          403,
        );
      const app = await application(tx, bazaar.id, access.applicationId);
      if (
        !bazaar.surveyEnabled ||
        (bazaar.surveyDeadline && +bazaar.surveyDeadline < Date.now())
      )
        throw new BazaarError("Survei sedang ditutup.", 409);
      if (
        +new Date(event.endAt || new Date(+event.startAt + 10_800_000)) >
          Date.now() &&
        event.status !== "completed"
      )
        throw new BazaarError("Survei tersedia setelah event selesai.", 409);
      if (!["checked_in", "completed"].includes(app.status))
        throw new BazaarError(
          "Survei hanya tersedia bagi tenant yang tercatat hadir.",
          409,
        );
      const existing = await tx.query.bazaarSurveys.findFirst({
        where: eq(bazaarSurveys.applicationId, app.id),
      });
      if (existing) throw new BazaarError("Survei sudah pernah dikirim.", 409);
      const [survey] = await tx
        .insert(bazaarSurveys)
        .values({
          applicationId: app.id,
          tenantId: app.tenantId,
          eventId: event.id,
          satisfactionOverall: body.satisfactionOverall,
          satisfactionLocation: body.satisfactionLocation,
          satisfactionFacilities: body.satisfactionFacilities,
          satisfactionCommunication: body.satisfactionCommunication,
          satisfactionTraffic: body.satisfactionTraffic,
          omzetRange: body.omzetRange,
          feedback: body.feedback || null,
          willingToJoinNext: body.willingToJoinNext,
        })
        .returning();
      await tx
        .update(bazaarApplications)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(bazaarApplications.id, app.id));
      await audit(
        tx,
        undefined,
        "bazaar_survey",
        "bazaar_application",
        app.id,
        { status: app.status },
        { status: "completed", surveyId: survey!.id },
      );
      return survey;
    },
    true,
  );
}
export async function uploadBazaarProof(
  eventId: string,
  body: any,
  access: { applicationId: string; bazaarId: string } | null,
) {
  if (!access || access.applicationId !== body.applicationId)
    throw new BazaarError("Kode akses pribadi diperlukan.", 401);
  const proof = await ensureS3StorageUrl(
    body.paymentProofUrl,
    "bazaar-proofs",
    "bazar",
  );
  return lockBazaar(
    eventId,
    async (tx, bazaar, event) => {
      if (access.bazaarId !== bazaar.id)
        throw new BazaarError("Kode akses tidak sesuai.", 403);
      const before = await application(tx, bazaar.id, body.applicationId);
      if (!bazaarBankConfigured(bazaar))
        throw new BazaarError("Rekening belum dikonfigurasi panitia.", 409);
      if (
        event.status === "cancelled" ||
        !["accepted", "payment_pending", "payment_verification"].includes(
          before.status,
        )
      )
        throw new BazaarError(
          "Tunggu penerimaan panitia sebelum mengirim bukti pembayaran.",
          409,
        );
      if (bazaar.paymentDeadline && +bazaar.paymentDeadline < Date.now())
        throw new BazaarError(
          "Batas waktu pembayaran berakhir. Hubungi panitia.",
          409,
        );
      const [updated] = await tx
        .update(bazaarApplications)
        .set({
          paymentProofUrl: proof,
          paymentNotes: body.paymentNotes || before.paymentNotes,
          status: "payment_verification",
          updatedAt: new Date(),
        })
        .where(eq(bazaarApplications.id, before.id))
        .returning();
      await audit(
        tx,
        undefined,
        "bazaar_proof_upload",
        "bazaar_application",
        before.id,
        { status: before.status },
        { status: updated!.status },
      );
      return {
        application: {
          id: updated!.id,
          status: updated!.status,
          paymentProofUrl: updated!.paymentProofUrl,
        },
      };
    },
    true,
  );
}

export async function saveBazaarTenant(id: string, body: any, actor: Actor) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    await tx.execute(
      sql`SELECT id FROM bazaar_tenants WHERE id=${id} FOR UPDATE`,
    );
    const before = await tx.query.bazaarTenants.findFirst({
      where: eq(bazaarTenants.id, id),
    });
    if (!before) throw new BazaarError("Tenant tidak ditemukan.", 404);
    const data = { ...before, ...body };
    data.picPhone = normalizedPhone(data.picPhone);
    const personId =
      body.personId || !before.personId
        ? await personForTenant(tx, data, actor)
        : before.personId;
    const [updated] = await tx
      .update(bazaarTenants)
      .set({
        ...body,
        picPhone: data.picPhone,
        personId,
        updatedAt: new Date(),
      })
      .where(eq(bazaarTenants.id, id))
      .returning();
    await audit(
      tx,
      actor,
      "bazaar_tenant_update",
      "bazaar_tenant",
      id,
      before,
      updated,
    );
    return updated;
  });
}

export async function importBazaarTenants(
  rows: any[],
  actor: Actor,
  dryRun = false,
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout='4s'`);
    let imported = 0,
      merged = 0;
    const results: any[] = [];
    for (const [index, row] of rows.entries()) {
      let phone: string;
      try {
        phone = normalizedPhone(row.picPhone);
      } catch {
        results.push({
          row: index + 2,
          status: "invalid",
          message: "WhatsApp tidak valid.",
        });
        continue;
      }
      if (!dryRun)
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`,
        );
      const matches = await tx.query.bazaarTenants.findMany({
        where: and(
          eq(bazaarTenants.picPhone, phone),
          sql`lower(btrim(${bazaarTenants.brandName}))=${row.brandName.trim().toLowerCase()}`,
        ),
      });
      if (matches.length > 1) {
        results.push({
          row: index + 2,
          status: "invalid",
          message: "Profil ambigu. Periksa duplikat.",
        });
        continue;
      }
      const existing = matches[0];
      results.push({
        row: index + 2,
        status: existing ? "merge" : "create",
        brandName: row.brandName,
      });
      if (dryRun) continue;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`,
      );
      if (existing) {
        await tx
          .update(bazaarTenants)
          .set({
            instagram: existing.instagram || row.instagram || null,
            address: existing.address || row.address || null,
            productDescription:
              existing.productDescription || row.productDescription || null,
            updatedAt: new Date(),
          })
          .where(eq(bazaarTenants.id, existing.id));
        merged++;
      } else {
        const personId = await personForTenant(tx, row, actor);
        await tx
          .insert(bazaarTenants)
          .values({
            ...row,
            picPhone: phone,
            personId,
            isLegacyData: true,
            internalTags: ["Legacy Tenant"],
          });
        imported++;
      }
    }
    if (!dryRun)
      await audit(
        tx,
        actor,
        "bazaar_tenants_import",
        "bazaar_tenant",
        actor.id,
        null,
        {
          imported,
          merged,
          invalid: results.filter((row) => row.status === "invalid").length,
        },
      );
    return {
      imported,
      merged,
      totalProcessed: rows.length,
      invalid: results.filter((row) => row.status === "invalid").length,
      results,
      dryRun,
    };
  });
}

export async function publishBazaar(
  eventId: string,
  isPublished: boolean,
  actor: Actor,
) {
  return lockBazaar(eventId, async (tx, bazaar) => {
    const apps = await tx.query.bazaarApplications.findMany({
      where: eq(bazaarApplications.bazaarId, bazaar.id),
    });
    for (const app of apps)
      await tx
        .update(bazaarApplications)
        .set({
          isPublished:
            isPublished &&
            BAZAAR_PLACED.includes(app.status) &&
            bazaarPaymentConfirmed(app),
          updatedAt: new Date(),
        })
        .where(eq(bazaarApplications.id, app.id));
    await audit(tx, actor, "bazaar_publish", "bazaar", bazaar.id, null, {
      isPublished,
    });
    return { isPublished };
  });
}
export async function recordBazaarIncident(
  eventId: string,
  body: any,
  actor: Actor,
) {
  return lockBazaar(eventId, async (tx, bazaar, event) => {
    const app = await application(tx, bazaar.id, body.applicationId);
    const [created] = await tx
      .insert(bazaarIncidents)
      .values({
        ...body,
        tenantId: app.tenantId,
        eventId: event.id,
        recordedBy: actor.id,
      })
      .returning();
    await audit(
      tx,
      actor,
      "bazaar_incident",
      "bazaar_application",
      app.id,
      null,
      { incidentId: created!.id, category: body.category },
    );
    return created;
  });
}
export async function evaluateBazaarTenant(
  eventId: string,
  body: any,
  actor: Actor,
) {
  return lockBazaar(eventId, async (tx, bazaar, event) => {
    const app = await application(tx, bazaar.id, body.applicationId);
    const existing = await tx.query.bazaarEvaluations.findFirst({
      where: eq(bazaarEvaluations.applicationId, app.id),
    });
    const data = {
      ...body,
      tenantId: app.tenantId,
      eventId: event.id,
      evaluatedBy: actor.id,
      evaluatedAt: new Date(),
    };
    const [updated] = existing
      ? await tx
          .update(bazaarEvaluations)
          .set(data)
          .where(eq(bazaarEvaluations.id, existing.id))
          .returning()
      : await tx.insert(bazaarEvaluations).values(data).returning();
    await tx
      .update(bazaarTenants)
      .set({ internalFlag: body.suggestedFlag, updatedAt: new Date() })
      .where(eq(bazaarTenants.id, app.tenantId));
    await audit(
      tx,
      actor,
      "bazaar_evaluate",
      "bazaar_application",
      app.id,
      existing,
      updated,
    );
    return updated;
  });
}
