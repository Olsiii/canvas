import { describe, expect, it } from "vitest";
import {
  suggestDiversify,
  tasksForUserOnDate,
  weeklyTaskCountForUser,
  type WorkloadAssignment,
} from "./workload";

function assignment(overrides: Partial<WorkloadAssignment> & { id: string }): WorkloadAssignment {
  return {
    id: overrides.id,
    title: overrides.title ?? "Task",
    dueDate: overrides.dueDate ?? null,
    startDate: overrides.startDate ?? null,
    userId: overrides.userId ?? "alice",
  };
}

describe("tasksForUserOnDate", () => {
  const assignments = [
    assignment({ id: "1", userId: "alice", dueDate: "2026-07-21" }),
    assignment({ id: "2", userId: "alice", dueDate: "2026-07-22" }),
    assignment({ id: "3", userId: "bob", dueDate: "2026-07-21" }),
    // No due date, falls back to start date.
    assignment({ id: "4", userId: "alice", startDate: "2026-07-21" }),
  ];

  it("returns only the given user's tasks landing on the given date", () => {
    const result = tasksForUserOnDate(assignments, "alice", "2026-07-21");
    expect(result.map((t) => t.id)).toEqual(["1", "4"]);
  });

  it("excludes another user's tasks on the same date", () => {
    const result = tasksForUserOnDate(assignments, "alice", "2026-07-21");
    expect(result.some((t) => t.id === "3")).toBe(false);
  });

  it("returns an empty array when nothing matches", () => {
    expect(tasksForUserOnDate(assignments, "carol", "2026-07-21")).toEqual([]);
  });
});

describe("weeklyTaskCountForUser", () => {
  it("counts every assignment for a user regardless of date", () => {
    const assignments = [
      assignment({ id: "1", userId: "alice", dueDate: "2026-07-21" }),
      assignment({ id: "2", userId: "alice", dueDate: "2026-07-25" }),
      assignment({ id: "3", userId: "bob", dueDate: "2026-07-21" }),
    ];
    expect(weeklyTaskCountForUser(assignments, "alice")).toBe(2);
    expect(weeklyTaskCountForUser(assignments, "bob")).toBe(1);
    expect(weeklyTaskCountForUser(assignments, "carol")).toBe(0);
  });
});

describe("suggestDiversify", () => {
  it("returns null when there's only one person (nothing to compare)", () => {
    expect(suggestDiversify([{ userId: "alice", count: 10 }])).toBeNull();
  });

  it("returns null for an ordinary small gap", () => {
    expect(
      suggestDiversify([
        { userId: "alice", count: 3 },
        { userId: "bob", count: 1 },
      ]),
    ).toBeNull();
  });

  it("flags a large, roughly-double gap", () => {
    const result = suggestDiversify([
      { userId: "alice", count: 8 },
      { userId: "bob", count: 2 },
    ]);
    expect(result).toEqual({
      overloadedUserIds: ["alice"],
      underloadedUserIds: ["bob"],
      maxCount: 8,
      minCount: 2,
    });
  });

  it("flags any gap of 3+ when the underloaded side has zero", () => {
    const result = suggestDiversify([
      { userId: "alice", count: 3 },
      { userId: "bob", count: 0 },
    ]);
    expect(result?.overloadedUserIds).toEqual(["alice"]);
    expect(result?.underloadedUserIds).toEqual(["bob"]);
  });

  it("does not flag a big gap that isn't roughly double (e.g. 10 vs 8)", () => {
    expect(
      suggestDiversify([
        { userId: "alice", count: 10 },
        { userId: "bob", count: 8 },
      ]),
    ).toBeNull();
  });

  it("names every tied person on each side, not just one", () => {
    const result = suggestDiversify([
      { userId: "alice", count: 8 },
      { userId: "bob", count: 8 },
      { userId: "carol", count: 1 },
      { userId: "dan", count: 1 },
    ]);
    expect(result?.overloadedUserIds.sort()).toEqual(["alice", "bob"]);
    expect(result?.underloadedUserIds.sort()).toEqual(["carol", "dan"]);
  });
});
