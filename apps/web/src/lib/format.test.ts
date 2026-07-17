import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-17T12:00:00Z");

  it("shows 'just now' for under a minute", () => {
    expect(formatRelativeTime(new Date("2026-07-17T11:59:31Z"), now)).toBe("just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime(new Date("2026-07-17T11:55:00Z"), now)).toBe("5m ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime(new Date("2026-07-17T09:00:00Z"), now)).toBe("3h ago");
  });

  it("shows days for under a week", () => {
    expect(formatRelativeTime(new Date("2026-07-15T12:00:00Z"), now)).toBe("2d ago");
  });

  it("falls back to a locale date at a week or more", () => {
    const eightDaysAgo = new Date("2026-07-09T12:00:00Z");
    expect(formatRelativeTime(eightDaysAgo, now)).toBe(eightDaysAgo.toLocaleDateString());
  });
});
