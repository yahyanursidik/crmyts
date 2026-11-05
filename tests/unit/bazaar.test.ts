import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { Router } from "../../server/http/router";
import { registerBazaarRoutes } from "../../server/domain/bazaar/routes";
import * as client from "../../server/db/client";
import { ROLES, PERMISSIONS } from "../../server/permissions/constants";
import {
  createBazaarAccess,
  readBazaarAccess,
} from "../../server/domain/bazaar/accessToken";
import {
  bazaarBankConfigured,
  bazaarPaymentConfirmed,
  bazaarRegistrationOpen,
} from "../../src/lib/bazaarPolicy";
import { parseBazaarCsv } from "../../src/features/bazaar/importModel";
const E = "018f1111-2222-7000-8000-000000000001",
  B = "018f2222-3333-7000-8000-000000000002",
  S = "018f3333-4444-7000-8000-000000000003",
  T = "018f4444-5555-7000-8000-000000000004",
  A = "018f5555-6666-7000-8000-000000000005",
  P = "018f6666-7777-7000-8000-000000000006";
const actor = {
  id: P,
  authSubject: "fixture",
  email: "staff@example.test",
  fullName: "Staff UAT",
  roles: [ROLES.EVENT_ADMIN],
  permissions: [PERMISSIONS.EVENTS_MANAGE],
  isActive: true,
};
let event: any, bazaar: any, tenant: any, app: any, booth: any;
let db: any;
const router = new Router();
registerBazaarRoutes(router);
beforeEach(() => {
  vi.restoreAllMocks();
  event = {
    id: E,
    title: "Event UAT",
    status: "scheduled",
    startAt: new Date(Date.now() + 86400000),
    endAt: new Date(Date.now() + 90000000),
  };
  bazaar = {
    id: B,
    eventId: E,
    title: "Bazar UAT",
    isOpen: true,
    paymentEnabled: false,
    defaultFeeRupiah: 100000,
    categoryQuotas: null,
    surveyEnabled: true,
    event,
  };
  tenant = {
    id: T,
    personId: P,
    brandName: "Usaha UAT",
    picName: "PIC UAT",
    picPhone: "+6281234567890",
    businessCategory: "kuliner",
    internalFlag: "normal",
    internalTags: [],
  };
  booth = {
    id: S,
    bazaarId: B,
    code: "A-01",
    name: "Stan A",
    status: "available",
    allowedCategory: "kuliner",
    priceRupiah: 100000,
  };
  app = {
    id: A,
    bazaarId: B,
    tenantId: T,
    status: "submitted",
    infaqAmountRupiah: 100000,
    paymentVerifiedAt: null,
    paymentVerifiedBy: null,
    assignedBoothId: null,
    isPublished: false,
    tenant,
  };
  const defaults: any = {
    events: () => event,
    bazaarEvents: () => bazaar,
    bazaarTenants: () => tenant,
    bazaarApplications: () => app,
    bazaarBooths: () => booth,
    bazaarSurveys: () => undefined,
    bazaarEvaluations: () => undefined,
    persons: () => undefined,
  };
  const query: any = {};
  for (const [table, fn] of Object.entries(defaults))
    query[table] = {
      findFirst: vi.fn(fn as any),
      findMany: vi.fn().mockResolvedValue([]),
    };
  query.bazaarIncidents = { findMany: vi.fn().mockResolvedValue([]) };
  const records: any = {
    events: () => event,
    bazaar_events: () => bazaar,
    bazaar_tenants: () => tenant,
    bazaar_applications: () => app,
    bazaar_booths: () => booth,
    persons: () => ({ id: P }),
    bazaar_surveys: () => ({ id: S }),
  };
  db = {
    query,
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    })),
    insert: vi.fn((table: any) => ({
      values: (value: any) => ({
        returning: async () =>
          Array.isArray(value)
            ? value.map((row: any, index: number) => ({
                id: S + "-" + index,
                ...row,
              }))
            : [
                {
                  ...(records[getTableName(table)]?.() || { id: P }),
                  ...value,
                },
              ],
        onConflictDoNothing: async () => [],
      }),
    })),
    update: vi.fn((table: any) => ({
      set: (value: any) => ({
        where: () => ({
          returning: async () => [
            { ...(records[getTableName(table)]?.() || { id: P }), ...value },
          ],
        }),
      }),
    })),
    delete: vi.fn(() => ({ where: async () => [] })),
  };
  db.transaction = vi.fn(async (callback: any) => callback(db));
  vi.spyOn(client, "getDb").mockReturnValue(db);
});
async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  user: any = actor,
  query: Record<string, string> = {},
) {
  return router.handle({
    requestId: "bazaar-unit",
    method,
    path,
    body,
    headers: token ? { authorization: "Bearer " + token } : {},
    params: {},
    query,
    user,
  });
}
describe("Bazaar access, workflow and truthful summaries", () => {
  it("requires staff access for the operational directory", async () => {
    const response = await request(
      "GET",
      "/api/bazaar/overview",
      undefined,
      undefined,
      null,
    );
    expect(response.statusCode).toBe(401);
  });
  it("rejects malformed route IDs before touching business data", async () => {
    const response = await request("PUT", "/api/events/not-a-uuid/bazaar", {
      title: "Bad",
    });
    expect(response.statusCode).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not create a second bazaar for one event", async () => {
    const response = await request("POST", `/api/events/${E}/bazaar`, {
      title: "Duplicate",
    });
    expect(response.statusCode).toBe(409);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("clears a nullable deadline instead of silently retaining it", async () => {
    bazaar.surveyDeadline = new Date(Date.now() + 9999999);
    const response = await request("PUT", `/api/events/${E}/bazaar`, {
      surveyDeadline: null,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.surveyDeadline).toBeNull();
  });
  it("requires complete reviewed bank data before payment activation", async () => {
    const response = await request("PUT", `/api/events/${E}/bazaar`, {
      paymentEnabled: true,
      bankAccountNumber: "7144778899",
      bankName: "Contoh",
      bankAccountName: "Contoh",
    });
    expect(response.statusCode).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("rejects duplicate booth codes as a whole batch", async () => {
    const response = await request(
      "POST",
      `/api/events/${E}/bazaar/booths/bulk`,
      {
        booths: [
          { code: "a-01", name: "A" },
          { code: "A-01", name: "B" },
        ],
      },
    );
    expect(response.statusCode).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("does not merge a public submission before rejecting an existing application", async () => {
    db.query.bazaarTenants.findMany.mockResolvedValue([tenant]);
    const response = await request(
      "POST",
      `/api/public/events/${E}/bazaar/apply`,
      {
        brandName: tenant.brandName,
        picName: "Do not overwrite",
        picPhone: tenant.picPhone,
        businessCategory: "kuliner",
        productDescription: "Produk uji",
      agreedToRules: true,
      },
      undefined,
      null,
    );
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("does not allow payment verification by jumping directly from submitted", async () => {
    const response = await request(
      "PUT",
      `/api/events/${E}/bazaar/applications/${A}/status`,
      { status: "payment_verified" },
    );
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("refuses a booth assignment while payment is unverified", async () => {
    const response = await request(
      "PUT",
      `/api/events/${E}/bazaar/applications/${A}/assign-booth`,
      { boothId: S },
    );
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("refuses an occupied booth even when the submitting tenant is verified", async () => {
    app.status = "payment_verified";
    app.paymentVerifiedAt = new Date();
    db.query.bazaarApplications.findFirst
      .mockResolvedValueOnce(app)
      .mockResolvedValueOnce({ ...app, id: P });
    const response = await request(
      "PUT",
      `/api/events/${E}/bazaar/applications/${A}/assign-booth`,
      { boothId: S },
    );
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("enforces booth category instead of applying a warning after assignment", async () => {
    app.status = "payment_verified";
    app.paymentVerifiedAt = new Date();
    booth.allowedCategory = "buku_kitab";
    db.query.bazaarApplications.findFirst
      .mockResolvedValueOnce(app)
      .mockResolvedValueOnce(undefined);
    const response = await request(
      "PUT",
      `/api/events/${E}/bazaar/applications/${A}/assign-booth`,
      { boothId: S },
    );
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("invalidates payment verification when the fee editor changes the amount", async () => {
    app.status = "payment_verified";
    app.paymentVerifiedAt = new Date();
    const response = await request(
      "PUT",
      `/api/events/${E}/bazaar/applications/${A}/fee`,
      { infaqAmountRupiah: 200000, status: "payment_verified" },
    );
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body).data;
    expect(data.status).toBe("payment_pending");
    expect(data.paymentVerifiedAt).toBeNull();
  });
  it("rejects check-in before a booth and verified payment exist", async () => {
    const response = await request("POST", `/api/events/${E}/bazaar/check-in`, {
      applicationId: A,
    });
    expect(response.statusCode).toBe(409);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not rewrite the timestamp when a tenant checks in twice", async () => {
    app.status = "checked_in";
    app.checkedInAt = new Date("2026-01-01T00:00:00Z");
    const response = await request("POST", `/api/events/${E}/bazaar/check-in`, {
      applicationId: A,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.checkedInAt).toBe(
      app.checkedInAt.toISOString(),
    );
    expect(db.update).not.toHaveBeenCalled();
  });
  it("retains booths with placement history", async () => {
    db.query.bazaarApplications.findMany.mockResolvedValue([app]);
    const response = await request(
      "DELETE",
      `/api/events/${E}/bazaar/booths/${S}`,
    );
    expect(response.statusCode).toBe(409);
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("excludes unverified operational statuses from lifetime infaq", async () => {
    db.query.bazaarTenants.findMany.mockResolvedValue([
      {
        ...tenant,
        applications: [
          {
            status: "booth_assigned",
            infaqAmountRupiah: 150000,
            paymentVerifiedAt: null,
          },
          {
            status: "payment_verified",
            infaqAmountRupiah: 200000,
            paymentVerifiedAt: new Date(),
          },
          {
            status: "cancelled",
            infaqAmountRupiah: 900000,
            paymentVerifiedAt: new Date(),
          },
        ],
      },
    ]);
    const response = await request("GET", "/api/bazaar/tenants");
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data[0].lifetimeInfaqRupiah).toBe(200000);
  });
  it("does not expose a private application through a public UUID or phone", async () => {
    const response = await request(
      "GET",
      `/api/public/events/${E}/bazaar/check-status`,
      undefined,
      undefined,
      null,
      { appId: A, phone: tenant.picPhone },
    );
    expect(response.statusCode).toBe(401);
  });
  it("loads an owner receipt while omitting internal comments", async () => {
    app.adminNotes = "INTERNAL";
    app.paymentNotes = "INTERNAL";
    const response = await request(
      "GET",
      `/api/public/events/${E}/bazaar/check-status`,
      undefined,
      createBazaarAccess(A, B),
      null,
    );
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body).data;
    expect(data.application.id).toBe(A);
    expect(data.application.adminNotes).toBeUndefined();
    expect(data.application.paymentNotes).toBeUndefined();
    expect(data.bazaar.bankAccountNumber).toBeNull();
  });
  it("rejects surveys identified only by a public brand or application ID", async () => {
    const response = await request(
      "POST",
      `/api/public/events/${E}/bazaar/survey`,
      {
        applicationId: A,
        brandName: tenant.brandName,
        satisfactionOverall: 5,
        satisfactionLocation: 5,
        satisfactionFacilities: 5,
        satisfactionCommunication: 5,
        satisfactionTraffic: 5,
        omzetRange: "<1m",
      },
      undefined,
      null,
    );
    expect(response.statusCode).toBe(401);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("rejects unauthorized proof replacement", async () => {
    const response = await request(
      "POST",
      `/api/public/events/${E}/bazaar/upload-proof`,
      {
        applicationId: A,
        phone: tenant.picPhone,
        paymentProofUrl: "https://example.test/proof.png",
      },
      undefined,
      null,
    );
    expect(response.statusCode).toBe(401);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not list ended events as open registration", async () => {
    event.endAt = new Date(Date.now() - 1);
    db.query.bazaarEvents.findMany.mockResolvedValue([
      { ...bazaar, booths: [] },
    ]);
    const response = await request(
      "GET",
      "/api/public/bazaars",
      undefined,
      undefined,
      null,
    );
    expect(JSON.parse(response.body).data).toEqual([]);
  });
  it("does not publish draft, unpublished or personally identifying records", async () => {
    app.status = "booth_assigned";
    app.paymentVerifiedAt = new Date();
    app.isPublished = true;
    app.assignedBooth = booth;
    bazaar.booths = [booth];
    bazaar.applications = [app, { ...app, id: P, isPublished: false }];
    const response = await request(
      "GET",
      `/api/public/events/${E}/bazaar`,
      undefined,
      undefined,
      null,
    );
    const list = JSON.parse(response.body).data.bazaar.showcaseTenants;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(T);
    expect(list[0].picPhone).toBe("");
    expect(list[0].picEmail).toBeNull();
    expect(list[0].id).not.toBe(A);
  });
});
describe("Bazaar shared policy and import parsing", () => {
  it("binds a private access code to one application and detects tampering", () => {
    const code = createBazaarAccess(A, B);
    expect(readBazaarAccess({ authorization: "Bearer " + code })).toEqual({
      kind: "bazaar_access",
      applicationId: A,
      bazaarId: B,
    });
    expect(
      readBazaarAccess({ authorization: "Bearer " + code + "a" }),
    ).toBeNull();
    const [prefix, payload] = code.split(".");
    expect(
      readBazaarAccess({
        authorization: `Bearer ${prefix}.${payload}.${"é".repeat(43)}`,
      }),
    ).toBeNull();
  });
  it("does not enable payments merely because legacy bank text exists", () => {
    expect(
      bazaarBankConfigured({
        bankName: "Bank",
        bankAccountNumber: "865001234567",
        bankAccountName: "Fixture",
      }),
    ).toBe(false);
    expect(
      bazaarBankConfigured({
        paymentEnabled: true,
        bankName: "Bank",
        bankAccountNumber: "865001234567",
        bankAccountName: "Fixture",
      }),
    ).toBe(true);
  });
  it("requires evidence for positive infaq even after operational progression", () => {
    expect(
      bazaarPaymentConfirmed({
        status: "completed",
        infaqAmountRupiah: 100000,
      }),
    ).toBe(false);
    expect(
      bazaarPaymentConfirmed({
        status: "completed",
        infaqAmountRupiah: 100000,
        paymentVerifiedAt: new Date(),
      }),
    ).toBe(true);
  });
  it("respects cancellation and registration deadlines", () => {
    expect(
      bazaarRegistrationOpen(
        { ...bazaar, registrationDeadline: new Date(Date.now() - 1) },
        event,
      ),
    ).toBe(false);
    expect(
      bazaarRegistrationOpen(bazaar, { ...event, status: "cancelled" }),
    ).toBe(false);
  });
  it("reads quoted commas and quoted multiline text without shifting columns", () => {
    const rows = parseBazaarCsv(
      'brandName,picName,picPhone,productDescription\r\n"Usaha, A",PIC,08123456789,"Produk\nbaris kedua"',
    );
    expect(rows[0]).toMatchObject({
      brandName: "Usaha, A",
      picName: "PIC",
      picPhone: "08123456789",
      productDescription: "Produk\nbaris kedua",
      businessCategory: "kuliner",
    });
  });
  it("rejects an unclosed quoted cell or missing identity headers", () => {
    expect(() =>
      parseBazaarCsv('brandName,picName,picPhone\n"Usaha,PIC,08123456789'),
    ).toThrow("kutip");
    expect(() => parseBazaarCsv("brandName,picName\nUsaha,PIC")).toThrow(
      "picPhone",
    );
  });
});
