import { describe, expect, it } from "vitest";
import { tasksForUserOnDate, weeklyTaskCountForUser, type WorkloadAssignment } from "./workload";

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
