import { describe, expect, it } from "vitest";
import { buildWeekDays, startOfWeekSunday } from "./week";

describe("startOfWeekSunday", () => {
  it("returns the same date when it's already a Sunday", () => {
    // 2026-07-19 is a Sunday.
    expect(startOfWeekSunday("2026-07-19")).toBe("2026-07-19");
  });

  it("walks back to the preceding Sunday for a mid-week date", () => {
    // 2026-07-21 is a Tuesday.
    expect(startOfWeekSunday("2026-07-21")).toBe("2026-07-19");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-08-01 is a Saturday; the week's Sunday is in July.
    expect(startOfWeekSunday("2026-08-01")).toBe("2026-07-26");
  });
});

describe("buildWeekDays", () => {
  it("returns exactly 7 consecutive days starting at weekStart", () => {
    expect(buildWeekDays("2026-07-19")).toEqual([
      "2026-07-19",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
  });
});
