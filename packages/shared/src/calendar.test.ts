import { describe, expect, it } from "vitest";
import { buildMonthGrid, toDateOnly } from "./calendar";

describe("buildMonthGrid", () => {
  it("always returns 42 cells (6 weeks)", () => {
    expect(buildMonthGrid(2026, 6).length).toBe(42); // July 2026
  });

  it("marks in-month days correctly for July 2026 (Wed start)", () => {
    const cells = buildMonthGrid(2026, 6);
    const july1 = cells.find((c) => c.date === "2026-07-01");
    expect(july1?.inMonth).toBe(true);
    expect(july1?.day).toBe(1);
    // First cell should be Sunday June 28
    expect(cells[0]).toEqual({ date: "2026-06-28", day: 28, inMonth: false });
  });

  it("toDateOnly zero-pads", () => {
    expect(toDateOnly(2026, 0, 5)).toBe("2026-01-05");
  });
});
