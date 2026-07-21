import { describe, expect, it } from "vitest";
import { computeNextRunAt } from "./recurrence";

describe("computeNextRunAt", () => {
  it("advances by one day for FREQ=DAILY, preserving time-of-day", () => {
    const after = new Date("2026-07-21T14:30:00.000Z");
    expect(computeNextRunAt("FREQ=DAILY", after)).toEqual(new Date("2026-07-22T14:30:00.000Z"));
  });

  it("advances by one week for FREQ=WEEKLY", () => {
    const after = new Date("2026-07-21T09:00:00.000Z"); // a Tuesday
    expect(computeNextRunAt("FREQ=WEEKLY", after)).toEqual(new Date("2026-07-28T09:00:00.000Z"));
  });

  it("skips weekends for FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", () => {
    const friday = new Date("2026-07-24T09:00:00.000Z");
    expect(computeNextRunAt("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", friday)).toEqual(
      new Date("2026-07-27T09:00:00.000Z"), // Monday, not Saturday
    );
  });

  it("advances by one calendar month for FREQ=MONTHLY, same day-of-month", () => {
    const after = new Date("2026-07-21T09:00:00.000Z");
    expect(computeNextRunAt("FREQ=MONTHLY", after)).toEqual(new Date("2026-08-21T09:00:00.000Z"));
  });

  it("stays stable when repeatedly re-anchored on its own output (no drift)", () => {
    let cursor = new Date("2026-01-31T09:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      const next = computeNextRunAt("FREQ=MONTHLY", cursor);
      expect(next).not.toBeNull();
      cursor = next!;
    }
    // Jan 31 -> Mar 31 -> May 31 -> Jul 31: with no explicit BYMONTHDAY,
    // RRule implicitly anchors on dtstart's day-of-month (31) and skips
    // months that don't have one (Feb, Apr, Jun), rather than clamping.
    expect(cursor).toEqual(new Date("2026-07-31T09:00:00.000Z"));
  });

  it("returns null once an exhausted rule (COUNT) has no more occurrences", () => {
    const after = new Date("2026-07-21T09:00:00.000Z");
    expect(computeNextRunAt("FREQ=DAILY;COUNT=1", after)).toBeNull();
  });
});
