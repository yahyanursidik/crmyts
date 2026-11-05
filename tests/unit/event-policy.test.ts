import { describe, it, expect } from "vitest";
import {
  eventScheduleError,
  mergeEventConfig,
} from "../../server/domain/events/eventPolicy";
import { paymentCheckInError } from "../../server/domain/events/paymentAccess";
import {
  toWibInput,
  fromWibInput,
  registrationIsOpen,
  diffEventConfig,
} from "../../src/features/events/utils/eventPresentation";
describe("Events policy across channels", () => {
  it("keeps a WIB input stable independently of the device time zone", () => {
    expect(fromWibInput("2026-11-12T08:00")).toBe("2026-11-12T01:00:00.000Z");
    expect(toWibInput("2026-11-12T01:00:00Z")).toBe("2026-11-12T08:00");
  });
  it("rejects invalid schedules and zero-cost paid events", () => {
    expect(eventScheduleError({ startAt: "bad" })).toBeTruthy();
    expect(
      eventScheduleError({ startAt: "2026-11-12", endAt: "2026-11-11" }),
    ).toBeTruthy();
    expect(
      eventScheduleError({
        startAt: "2026-11-12",
        isPaid: true,
        priceRupiah: 0,
      }),
    ).toBeTruthy();
  });
  it("preserves sibling settings and the private gate token when a nested section changes", () => {
    const before = {
      gateAccessToken: "original",
      email: { ticket: true, reminder: true },
      customFields: [{ id: "x" }],
    };
    const patch = diffEventConfig(before, {
      ...before,
      email: { ...before.email, ticket: false },
    });
    expect(patch).toEqual({ email: { ticket: false } });
    expect(
      mergeEventConfig(before, { ...patch, gateAccessToken: "overwrite" }),
    ).toEqual({ ...before, email: { ticket: false, reminder: true } });
  });
  it("uses the public two-hour fallback and hides cancelled/past registrations", () => {
    const event = { startAt: "2026-11-12T01:00:00Z", isRegistrationOpen: true };
    expect(registrationIsOpen(event, Date.parse("2026-11-12T02:00:00Z"))).toBe(
      true,
    );
    expect(registrationIsOpen(event, Date.parse("2026-11-12T04:00:00Z"))).toBe(
      false,
    );
    expect(registrationIsOpen({ ...event, status: "cancelled" }, 0)).toBe(
      false,
    );
  });
  it("blocks legacy free and pending payments on paid events, while retaining the dedicated staff exemption", () => {
    expect(paymentCheckInError({ paymentStatus: "free" }, true)).toBeTruthy();
    expect(
      paymentCheckInError({ paymentStatus: "pending_payment" }, true),
    ).toBeTruthy();
    expect(paymentCheckInError({ paymentStatus: "verified" }, true)).toBeNull();
    expect(
      paymentCheckInError(
        {
          paymentStatus: "free",
          registrationData: { registrationChannel: "staff_yayasan" },
        },
        true,
      ),
    ).toBeNull();
    expect(paymentCheckInError({ paymentStatus: "free" }, false)).toBeNull();
  });
});
