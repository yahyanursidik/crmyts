import { describe, it, expect, vi, afterEach } from "vitest";
import { Router } from "../../server/http/router";
import { registerEventsRoutes } from "../../server/domain/events/routes";
import * as client from "../../server/db/client";
import { ROLES, PERMISSIONS } from "../../server/permissions/constants";
import { eventDb } from "../helpers/eventDb";
const eventId = "10000000-0000-4000-8000-000000000001";
const attendanceId = "10000000-0000-4000-8000-000000000002";
const secondId = "10000000-0000-4000-8000-000000000003";
const user = {
  id: "10000000-0000-4000-8000-000000000004",
  authSubject: "test",
  email: "test@example.test",
  fullName: "Pengelola",
  roles: [ROLES.CRM_ADMIN],
  permissions: [
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.ATTENDANCE_MANAGE,
  ],
  isActive: true,
};
const router = new Router();
registerEventsRoutes(router);
afterEach(() => vi.restoreAllMocks());
function fixture(rows: any[], members: any[] = [], isPaid = false) {
  const db = eventDb({
    query: {
      events: { findFirst: vi.fn().mockResolvedValue({ id: eventId, isPaid }) },
      eventAttendance: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(rows)
          .mockResolvedValue(members),
      },
    },
    delete: vi
      .fn()
      .mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({
            returning: vi.fn().mockResolvedValue([...rows, ...members]),
          }),
      }),
  });
  vi.spyOn(client, "getDb").mockReturnValue(db as any);
  return db;
}
const row = (patch: Record<string, unknown> = {}) => ({
  id: attendanceId,
  eventId,
  status: "registered",
  paymentStatus: "free",
  checkInAt: null,
  person: { fullName: "Peserta Uji" },
  ticketCode: "YTS-123456",
  ...patch,
});
function request(
  method: string,
  suffix: string,
  body: unknown = {},
  query = {},
) {
  return router.handle({
    method,
    path: `/api/events/${eventId}/${suffix}`,
    params: {},
    query,
    headers: {},
    body,
    user,
    requestId: "history-protection",
  });
}

describe("Event registration history protection", () => {
  it("removes an unpaid registration and records the released quota in the same transaction", async () => {
    const db: any = fixture([row()]);
    const response = await request("DELETE", `attendances/${attendanceId}`);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.freedQuota).toBe(1);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.execute).toHaveBeenCalledWith(expect.anything());
    expect(db.insert).toHaveBeenCalledOnce();
  });
  it.each([
    { status: "attended" },
    { checkInAt: new Date() },
    { paymentStatus: "verified" },
    { paymentStatus: "waiting_verification" },
    { paymentProofUrl: "https://example.test/proof" },
  ])("retains an attendance with history: %o", async (patch) => {
    const db = fixture([row(patch)]);
    const response = await request("DELETE", `attendances/${attendanceId}`);
    expect(response.statusCode).toBe(409);
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("retains ambiguous legacy free registrations on paid events", async () => {
    const db = fixture([row()], [], true);
    expect(
      (await request("DELETE", `attendances/${attendanceId}`)).statusCode,
    ).toBe(409);
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("checks every family member before removing any group member", async () => {
    const db = fixture(
      [row({ registrationGroupId: "family" })],
      [
        row({
          id: secondId,
          registrationGroupId: "family",
          paymentStatus: "verified",
        }),
      ],
    );
    expect(
      (
        await request(
          "DELETE",
          `attendances/${attendanceId}`,
          {},
          { deleteGroup: "true" },
        )
      ).statusCode,
    ).toBe(409);
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("removes multiple unhistoried registrations", async () => {
    fixture([row(), row({ id: secondId })]);
    const response = await request("POST", "attendances/bulk-delete", {
      attendanceIds: [attendanceId, secondId],
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.deletedCount).toBe(2);
  });
  it("reports a missing registration and validates empty bulk requests", async () => {
    const db = fixture([]);
    expect(
      (await request("DELETE", `attendances/${attendanceId}`)).statusCode,
    ).toBe(404);
    expect(
      (await request("POST", "attendances/bulk-delete", { attendanceIds: [] }))
        .statusCode,
    ).toBe(400);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
