import { describe, it, expect, vi, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "../../server/db/schema";
import { ROLES, PERMISSIONS as P } from "../../server/permissions/constants";
import { linkedInteractionTaskVisibility } from "../../server/domain/interactions/visibility";
import {
  createInteractionSchema,
  mayManageInteraction,
} from "../../server/domain/interactions/service";
import {
  validInteractionInstant,
  interactionTaskType,
} from "../../src/lib/interactionModel";
import { Router } from "../../server/http/router";
import { registerInteractionsRoutes } from "../../server/domain/interactions/routes";
import * as client from "../../server/db/client";
const id = "018fa000-0000-7000-8000-000000000001";
const cs = {
  id,
  authSubject: "fixture",
  email: "cs@example.test",
  fullName: "CS UAT",
  roles: [ROLES.CS_OFFICER],
  permissions: [],
  isActive: true,
};
afterEach(() => vi.restoreAllMocks());
describe("Interaction validation and private follow-up scope", () => {
  it.each(["2026-02-30T10:00:00+07:00", "2025-02-29T10:00:00Z", "bad-date"])(
    "rejects impossible instant %s",
    (value) => expect(validInteractionInstant(value)).toBe(false),
  );
  it.each(["2024-02-29T10:00:00+07:00", "2000-01-01T17:00:00Z"])(
    "accepts valid historical instant %s",
    (value) => expect(validInteractionInstant(value)).toBe(true),
  );
  it.each([
    ["phone_call", "telepon"],
    ["in_person", "kunjungan"],
    ["whatsapp", "whatsapp"],
    ["email", "administrasi"],
  ])("maps %s follow-up to its actual channel", (channel, expected) =>
    expect(interactionTaskType(channel)).toBe(expected),
  );
  it("rejects whitespace-only summaries and local timestamps without an offset", () => {
    expect(
      createInteractionSchema.safeParse({
        personId: id,
        channel: "whatsapp",
        summary: "   ",
      }).success,
    ).toBe(false);
    expect(
      createInteractionSchema.safeParse({
        personId: id,
        channel: "whatsapp",
        summary: "Valid note",
        occurredAt: "2026-01-01T09:00",
      }).success,
    ).toBe(false);
  });
  it("keeps explicit task opt-out while retaining legacy free-text outcomes", () => {
    expect(
      createInteractionSchema.parse({
        personId: id,
        channel: "email",
        summary: "Catatan lama",
        outcome: "Hasil bebas dari sistem lama",
        nextAction: "Teks tersisa",
        createFollowUpTask: false,
      }),
    ).toMatchObject({
      createFollowUpTask: false,
      outcome: "Hasil bebas dari sistem lama",
    });
  });
  it("does not grant editing to a different staff member who can read standard notes", () => {
    expect(mayManageInteraction(cs, { createdBy: "another-user" })).toBe(false);
    expect(mayManageInteraction(cs, { createdBy: id })).toBe(true);
    expect(
      mayManageInteraction(
        { ...cs, roles: [ROLES.CRM_ADMIN] },
        { createdBy: "another-user" },
      ),
    ).toBe(true);
  });
  it("preserves the source table alias in Drizzle relational task queries", () => {
    const db = drizzle(async () => ({ rows: [] }), { schema });
    const query = db.query.tasks
      .findMany({
        where: linkedInteractionTaskVisibility(cs.roles, id),
        with: { person: true, owner: true },
      })
      .toSQL();
    expect(query.sql).toContain("source_interaction.sensitivity_level");
    expect(query.sql).not.toContain('"tasks"."sensitivity_level"');
    expect(query.params).toContain(id);
  });
  it("blocks legacy deletion for a logged-in role without interaction rights", async () => {
    const db = vi.spyOn(client, "getDb");
    const router = new Router();
    registerInteractionsRoutes(router);
    const response = await router.handle({
      requestId: "test",
      method: "DELETE",
      path: "/api/interactions/" + id,
      params: {},
      headers: {},
      query: {},
      body: { reason: "Uji proteksi" },
      user: {
        ...cs,
        roles: [ROLES.FINANCE_VERIFIER],
        permissions: [P.INTERACTIONS_CREATE],
      },
    });
    expect(response.statusCode).toBe(403);
    expect(db).not.toHaveBeenCalled();
  });
});
