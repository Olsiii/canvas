import { describe, expect, it } from "vitest";
import { shouldStartNewGroup } from "./chat-grouping";

describe("shouldStartNewGroup", () => {
  it("starts a new group when there's no previous message", () => {
    expect(
      shouldStartNewGroup(undefined, { authorId: "a", createdAt: "2026-01-01T00:00:00Z" }),
    ).toBe(true);
  });

  it("does not start a new group for the same author within the window", () => {
    const prev = { authorId: "a", createdAt: "2026-01-01T00:00:00Z" };
    const curr = { authorId: "a", createdAt: "2026-01-01T00:02:00Z" };
    expect(shouldStartNewGroup(prev, curr)).toBe(false);
  });

  it("starts a new group when the author changes", () => {
    const prev = { authorId: "a", createdAt: "2026-01-01T00:00:00Z" };
    const curr = { authorId: "b", createdAt: "2026-01-01T00:00:30Z" };
    expect(shouldStartNewGroup(prev, curr)).toBe(true);
  });

  it("starts a new group after the grouping window elapses", () => {
    const prev = { authorId: "a", createdAt: "2026-01-01T00:00:00Z" };
    const curr = { authorId: "a", createdAt: "2026-01-01T00:05:01Z" };
    expect(shouldStartNewGroup(prev, curr)).toBe(true);
  });
});
