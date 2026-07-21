import { describe, expect, it } from "vitest";
import {
  formatDurationSec,
  groupTimeEntriesByDay,
  sumDurations,
  type TimesheetEntry,
} from "./time-entries";

function entry(overrides: Partial<TimesheetEntry> & { startedAt: string }): TimesheetEntry {
  return {
    id: overrides.id ?? Math.random().toString(36),
    taskId: overrides.taskId ?? "task-1",
    taskTitle: overrides.taskTitle ?? "Task",
    startedAt: overrides.startedAt,
    endedAt: overrides.endedAt ?? null,
    durationSec: overrides.durationSec ?? null,
  };
}

describe("sumDurations", () => {
  it("sums durationSec across entries, treating null (still running) as 0", () => {
    expect(sumDurations([{ durationSec: 60 }, { durationSec: null }, { durationSec: 120 }])).toBe(
      180,
    );
  });

  it("returns 0 for an empty list", () => {
    expect(sumDurations([])).toBe(0);
  });
});

describe("groupTimeEntriesByDay", () => {
  it("groups entries onto the local calendar day their startedAt falls on", () => {
    const days = groupTimeEntriesByDay([
      entry({ id: "a", startedAt: "2026-07-20T12:00:00.000Z", durationSec: 1800 }),
      entry({ id: "b", startedAt: "2026-07-20T14:00:00.000Z", durationSec: 900 }),
      entry({ id: "c", startedAt: "2026-07-21T12:00:00.000Z", durationSec: 3600 }),
    ]);

    expect(days.map((d) => d.date)).toEqual(["2026-07-21", "2026-07-20"]);
    expect(days[0]!.totalSec).toBe(3600);
    expect(days[1]!.totalSec).toBe(2700);
    expect(days[1]!.entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("counts a still-running entry (durationSec null) toward totalSec as 0", () => {
    const days = groupTimeEntriesByDay([
      entry({ startedAt: "2026-07-20T12:00:00.000Z", durationSec: 600 }),
      entry({ startedAt: "2026-07-20T13:00:00.000Z", durationSec: null }),
    ]);
    expect(days[0]!.totalSec).toBe(600);
  });

  it("returns an empty array for no entries", () => {
    expect(groupTimeEntriesByDay([])).toEqual([]);
  });
});

describe("formatDurationSec", () => {
  it("formats hours and minutes, dropping smaller units", () => {
    expect(formatDurationSec(3600 + 23 * 60)).toBe("1h 23m");
  });

  it("formats minutes only when under an hour", () => {
    expect(formatDurationSec(45 * 60)).toBe("45m");
  });

  it("formats seconds only when under a minute", () => {
    expect(formatDurationSec(30)).toBe("30s");
  });

  it("never reports a spurious '0h' prefix", () => {
    expect(formatDurationSec(5 * 60)).not.toMatch(/^0h/);
  });

  it("clamps negative input to zero", () => {
    expect(formatDurationSec(-10)).toBe("0s");
  });
});
