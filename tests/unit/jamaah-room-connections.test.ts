import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "../../server/http/router";
import { registerJamaahRoomRoutes } from "../../server/domain/jamaah-room/routes";
import {
  roomReplySchema,
  roomTaskSchema,
} from "../../server/domain/jamaah-room/policy";
import { canManageRoom } from "../../server/domain/jamaah-room/service";
import { publicRoomTextSafe } from "../../src/lib/jamaahRoomModel";
import { ROLES } from "../../server/permissions/constants";
import * as client from "../../server/db/client";
import {
  auditLogs,
  jamaahRoomActivity,
  jamaahRoomEntries,
} from "../../server/db/schema";
const id = "018f0000-0000-7000-8000-000000000001",
  other = "018f0000-0000-7000-8000-000000000002";
const user = {
  id,
  authSubject: "uat",
  email: "uat@example.test",
  fullName: "Petugas",
  roles: [ROLES.CS_OFFICER],
  permissions: [],
  isActive: true,
};
const router = new Router();
registerJamaahRoomRoutes(router);
const context = {
  requestId: "room-test",
  method: "PATCH",
  path: "/api/jamaah-room/" + id,
  headers: {},
  query: {},
  params: {},
  user,
};
function mockDb(overrides: Record<string, unknown> = {}) {
  const row = {
    id,
    category: "saran",
    subject: "Masukan kajian",
    status: "reviewing",
    personId: null,
    ownerUserId: id,
    publicationConsent: false,
    publishedAt: null,
    archivedAt: null,
    response: null,
    internalNote: "Catatan sebelumnya",
    submissionKey: id,
    submissionDigest: "private-digest",
    updatedAt: new Date("2026-11-05T12:00:00Z"),
    ...overrides,
  };
  const writes: Array<{ table: unknown; data: any }> = [];
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    query: {
      jamaahRoomEntries: { findFirst: vi.fn().mockResolvedValue(row) },
      appUsers: {
        findFirst: vi.fn().mockResolvedValue({
          userRoles: [{ role: { code: ROLES.CS_OFFICER } }],
        }),
      },
      tasks: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    update: vi.fn((table: any) => ({
      set: (data: any) => ({
        where: () => ({
          returning: async () => {
            writes.push({ table, data });
            return [{ ...row, ...data }];
          },
        }),
      }),
    })),
    insert: vi.fn((table: any) => ({
      values: async (data: any) => {
        writes.push({ table, data });
      },
    })),
  };
  const db = { transaction: vi.fn(async (cb) => cb(tx)) };
  vi.spyOn(client, "getDb").mockReturnValue(db as any);
  return { db, tx, writes };
}
describe("Ruang Jamaah connections and privacy", () => {
  afterEach(() => vi.restoreAllMocks());
  it("allows claiming an unassigned message and protects another owner", () => {
    expect(canManageRoom(user, {})).toBe(true);
    expect(canManageRoom(user, { ownerUserId: id })).toBe(true);
    expect(canManageRoom(user, { ownerUserId: other })).toBe(false);
    expect(
      canManageRoom(
        { ...user, roles: [ROLES.CRM_ADMIN] },
        { ownerUserId: other },
      ),
    ).toBe(true);
  });
  it("rejects a stale version before writing", async () => {
    const { tx } = mockDb();
    const response = await router.handle({
      ...context,
      body: {
        internalNote: "Catatan baru",
        expectedUpdatedAt: "2026-11-05T11:00:00Z",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(tx.update).not.toHaveBeenCalled();
  });
  it("rejects a foreign owner before writing", async () => {
    const { tx } = mockDb({ ownerUserId: other });
    expect(
      (
        await router.handle({
          ...context,
          body: { internalNote: "Tidak boleh" },
        })
      ).statusCode,
    ).toBe(403);
    expect(tx.update).not.toHaveBeenCalled();
  });
  it("requires restoring an archived message", async () => {
    const { tx } = mockDb({ archivedAt: new Date() });
    expect(
      (await router.handle({ ...context, body: { status: "reviewing" } }))
        .statusCode,
    ).toBe(409);
    expect(tx.update).not.toHaveBeenCalled();
  });
  it("keeps private note revisions out of the general audit", async () => {
    const { db, writes } = mockDb();
    const response = await router.handle({
      ...context,
      body: { internalNote: "Catatan privat terbaru" },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data).not.toHaveProperty("submissionKey");
    expect(JSON.parse(response.body).data).not.toHaveProperty(
      "submissionDigest",
    );
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(
      writes.find((w) => w.table === jamaahRoomEntries)?.data.internalNote,
    ).toBe("Catatan privat terbaru");
    const log = writes.find((w) => w.table === jamaahRoomActivity)?.data;
    expect(log.content).toBe("Catatan privat terbaru");
    expect(log.details.previousNote).toBe("Catatan sebelumnya");
    expect(
      JSON.stringify(writes.find((w) => w.table === auditLogs)?.data),
    ).not.toContain("Catatan privat");
  });
  it("does not report success when the transaction audit fails", async () => {
    const { db, tx } = mockDb();
    tx.insert.mockImplementation(
      () =>
        ({
          values: async () => {
            throw new Error("audit unavailable");
          },
        }) as any,
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (
        await router.handle({
          ...context,
          body: { internalNote: "Perubahan atomik" },
        })
      ).statusCode,
    ).toBe(500);
    expect(db.transaction).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
  it("does not expose staff export to ordinary CS", async () => {
    const spy = vi.spyOn(client, "getDb");
    const response = await router.handle({
      ...context,
      method: "POST",
      path: "/api/jamaah-room/export",
      body: { reason: "Ekspor uji" },
    });
    expect(response.statusCode).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
  it("validates filter enums and identifiers before touching the database", async () => {
    const spy = vi.spyOn(client, "getDb");
    for (const query of [
      { status: "invalid" },
      { category: "invalid" },
      { personId: "bad" },
      { ownerUserId: "bad" },
      { eventId: "bad" },
      { page: "no-number" },
    ]) {
      expect(
        (
          await router.handle({
            ...context,
            method: "GET",
            path: "/api/jamaah-room",
            query,
            body: null,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });
  it("requires an explicit valid response channel and actual instant", () => {
    expect(
      roomReplySchema.safeParse({
        response: "Sudah dijelaskan",
        replyChannel: "email",
        responseOccurredAt: "2026-11-05T18:00:00+07:00",
      }).success,
    ).toBe(true);
    expect(
      roomReplySchema.safeParse({
        response: "Sudah dijelaskan",
        replyChannel: "automatic",
      }).success,
    ).toBe(false);
    expect(
      roomReplySchema.safeParse({
        response: "Sudah dijelaskan",
        replyChannel: "email",
        responseOccurredAt: "2026-02-30T18:00:00+07:00",
      }).success,
    ).toBe(false);
  });
  it("validates task scheduling and refuses contact-bearing public text", () => {
    expect(
      roomTaskSchema.safeParse({
        title: "Tindak lanjut",
        dueAt: "2026-11-06T10:00:00+07:00",
      }).success,
    ).toBe(true);
    expect(
      roomTaskSchema.safeParse({ title: "Tindak lanjut", dueAt: "2026-11-06" })
        .success,
    ).toBe(false);
    expect(
      publicRoomTextSafe(
        "Cerita kajian",
        "Hubungi saya pada +62 812 3456 7890.",
      ),
    ).toBe(false);
    expect(
      publicRoomTextSafe(
        "Cerita kajian",
        "Kontak saya adalah jamaah@example.test.",
      ),
    ).toBe(false);
    expect(
      publicRoomTextSafe(
        "Cerita kajian",
        "Pengalaman saya mengikuti kajian pada 2026-11-05 sangat berkesan.",
      ),
    ).toBe(true);
  });
});
