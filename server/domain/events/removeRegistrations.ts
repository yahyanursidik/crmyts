import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { auditLogs, eventAttendance, events } from "../../db/schema";
import { attendanceHasHistory } from "./eventPolicy";
import { RegistrationError } from "./staffRegistration";
import { withEventRegistrationLock } from "./registrationLock";

export async function removeRegistrations(
  db: ReturnType<typeof getDb>,
  eventId: string,
  ids: string[],
  includeGroups: boolean,
  actorId: string,
  requestId: string,
) {
  return withEventRegistrationLock(db, eventId, async (tx) => {
    const event = await tx.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) throw new RegistrationError("Kajian tidak ditemukan.", 404);
    // Payment verification and check-in must finish before history is inspected.
    await tx.execute(
      sql`SELECT id FROM event_attendance WHERE event_id = ${eventId} FOR UPDATE`,
    );
    const selected = await tx.query.eventAttendance.findMany({
      where: and(
        eq(eventAttendance.eventId, eventId),
        inArray(eventAttendance.id, ids),
      ),
      with: { person: true },
    });
    if (!selected.length)
      throw new RegistrationError("Pendaftaran tidak ditemukan.", 404);
    const groups = selected
      .map((row) => row.registrationGroupId)
      .filter((id): id is string => Boolean(id));
    const members =
      includeGroups && groups.length
        ? await tx.query.eventAttendance.findMany({
            where: and(
              eq(eventAttendance.eventId, eventId),
              inArray(eventAttendance.registrationGroupId, groups),
            ),
          })
        : [];
    const targets = [
      ...new Map(
        [...selected, ...members].map((row) => [row.id, row]),
      ).values(),
    ];
    if (targets.some((row) => attendanceHasHistory(row, event.isPaid)))
      throw new RegistrationError(
        "Pendaftaran memiliki riwayat hadir atau pembayaran. Data dipertahankan; tinjau melalui detail peserta.",
        409,
      );
    const deleted = await tx
      .delete(eventAttendance)
      .where(
        and(
          eq(eventAttendance.eventId, eventId),
          inArray(
            eventAttendance.id,
            targets.map((row) => row.id),
          ),
        ),
      )
      .returning();
    await tx
      .insert(auditLogs)
      .values({
        actorUserId: actorId,
        action: "delete_event_registrations",
        entityType: "event",
        entityId: eventId,
        beforeJson: {
          attendanceIds: targets.map((row) => row.id),
          includeGroups,
        },
        reason: "Menghapus pendaftaran tanpa riwayat dan mengembalikan kuota",
        requestId,
      });
    return {
      deletedCount: deleted.length,
      freedQuota: deleted.length,
      personName: selected[0]!.person?.fullName || "Peserta",
      ticketCode: selected[0]!.ticketCode,
      message: `${deleted.length} pendaftaran dihapus. Kuota dikembalikan.`,
    };
  });
}
