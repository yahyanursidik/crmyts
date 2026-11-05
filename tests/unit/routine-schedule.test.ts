import { describe, expect, it } from "vitest";
import {
  planRoutineDates,
  routineDateTime,
  routineScheduleError,
} from "../../server/domain/kajian-rutin/schedule";
import { escapeRoutinePrintText } from "../../src/lib/kajianRutin";
describe("Routine calendar and printable user content", () => {
  it("rejects impossible dates and reversed same-day times", () => {
    expect(routineDateTime("2026-02-30", "07:00")).toBeNull();
    expect(routineDateTime("2028-02-29", "07:00")?.toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
    expect(routineScheduleError("10:00", "09:00")).toBeTruthy();
    expect(routineScheduleError("10:00", "10:00")).toBeTruthy();
    expect(routineScheduleError("10:00", "12:00")).toBeNull();
  });
  it("keeps the biweekly anchor after gaps and skips already-created sessions", () => {
    expect(
      planRoutineDates(
        { recurrence: "biweekly", dayOfWeek: 0, startDate: "2026-11-01" },
        ["2026-11-15"],
        "2026-11-02",
        3,
      ),
    ).toEqual(["2026-11-29", "2026-12-13", "2026-12-27"]);
  });
  it("uses calendar months rather than four-week intervals", () => {
    expect(
      planRoutineDates(
        { recurrence: "monthly", dayOfWeek: 0, startDate: "2026-11-01" },
        [],
        "2026-11-02",
        4,
      ),
    ).toEqual(["2026-12-06", "2027-01-03", "2027-02-07", "2027-03-07"]);
  });
  it("skips months without the fifth chosen weekday", () => {
    expect(
      planRoutineDates(
        { recurrence: "monthly", dayOfWeek: 0, startDate: "2026-11-29" },
        [],
        "2026-11-30",
        2,
      ),
    ).toEqual(["2027-01-31", "2027-05-30"]);
  });
  it("does not render user HTML in a QR print window", () => {
    expect(
      escapeRoutinePrintText('<img src=x onerror="alert(1)"> & Kajian'),
    ).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Kajian");
  });
});
