import { describe, expect, it } from "vitest";
import {
  addDaysToDateOnly,
  buildGanttDays,
  buildGanttRange,
  daysBetweenDateOnly,
  ganttBarOffset,
  taskDateSpan,
} from "./gantt";

describe("addDaysToDateOnly", () => {
  it("adds days, crossing month/year boundaries", () => {
    expect(addDaysToDateOnly("2026-07-30", 3)).toBe("2026-08-02");
    expect(addDaysToDateOnly("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("daysBetweenDateOnly", () => {
  it("counts whole days between two date-only strings", () => {
    expect(daysBetweenDateOnly("2026-07-01", "2026-07-05")).toBe(4);
    expect(daysBetweenDateOnly("2026-07-05", "2026-07-01")).toBe(-4);
    expect(daysBetweenDateOnly("2026-07-01", "2026-07-01")).toBe(0);
  });
});

describe("taskDateSpan", () => {
  it("uses both dates when present", () => {
    expect(taskDateSpan({ startDate: "2026-07-01", dueDate: "2026-07-05" })).toEqual({
      start: "2026-07-01",
      end: "2026-07-05",
    });
  });

  it("falls back to whichever single date is set", () => {
    expect(taskDateSpan({ startDate: null, dueDate: "2026-07-05" })).toEqual({
      start: "2026-07-05",
      end: "2026-07-05",
    });
    expect(taskDateSpan({ startDate: "2026-07-01", dueDate: null })).toEqual({
      start: "2026-07-01",
      end: "2026-07-01",
    });
  });

  it("returns null when neither date is set", () => {
    expect(taskDateSpan({ startDate: null, dueDate: null })).toBeNull();
  });

  it("swaps a reversed start/due pair so the bar never has negative width", () => {
    expect(taskDateSpan({ startDate: "2026-07-05", dueDate: "2026-07-01" })).toEqual({
      start: "2026-07-01",
      end: "2026-07-05",
    });
  });
});

describe("buildGanttRange", () => {
  it("covers every span, padded on each side", () => {
    const range = buildGanttRange(
      [
        { start: "2026-07-05", end: "2026-07-10" },
        { start: "2026-07-01", end: "2026-07-03" },
      ],
      "2026-07-15",
      2,
    );
    expect(range).toEqual({ start: "2026-06-29", end: "2026-07-12" });
  });

  it("falls back to a window around today when there are no dated tasks", () => {
    const range = buildGanttRange([], "2026-07-15", 2);
    expect(range).toEqual({ start: "2026-07-13", end: "2026-07-28" });
  });
});

describe("buildGanttDays", () => {
  it("returns one cell per day in the range, inclusive", () => {
    const cells = buildGanttDays({ start: "2026-07-01", end: "2026-07-03" });
    expect(cells.map((c) => c.date)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("flags weekends and month starts", () => {
    const cells = buildGanttDays({ start: "2026-07-31", end: "2026-08-02" });
    expect(cells.find((c) => c.date === "2026-08-01")?.isMonthStart).toBe(true);
    // 2026-08-01 is a Saturday.
    expect(cells.find((c) => c.date === "2026-08-01")?.isWeekend).toBe(true);
  });
});

describe("ganttBarOffset", () => {
  it("computes left/width in day units relative to the range start", () => {
    const range = { start: "2026-07-01", end: "2026-07-10" };
    expect(ganttBarOffset({ start: "2026-07-03", end: "2026-07-05" }, range)).toEqual({
      left: 2,
      width: 3,
    });
  });
});
