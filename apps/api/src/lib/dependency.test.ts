import { describe, expect, it } from "vitest";
import { validateTaskDependency, wouldCreateCycle } from "./dependency";

describe("validateTaskDependency", () => {
  it("allows two distinct tasks in the same list", () => {
    expect(
      validateTaskDependency({ id: "a", listId: "list-1" }, { id: "b", listId: "list-1" }),
    ).toBeNull();
  });

  it("rejects a task depending on itself", () => {
    expect(
      validateTaskDependency({ id: "a", listId: "list-1" }, { id: "a", listId: "list-1" }),
    ).toMatch(/cannot depend on itself/);
  });

  it("rejects tasks in different lists", () => {
    expect(
      validateTaskDependency({ id: "a", listId: "list-1" }, { id: "b", listId: "list-2" }),
    ).toMatch(/same list/);
  });
});

describe("wouldCreateCycle", () => {
  it("allows an edge into a graph with no existing edges", () => {
    expect(wouldCreateCycle([], { taskId: "a", dependsOnTaskId: "b" })).toBe(false);
  });

  it("allows a new edge that doesn't touch the existing chain", () => {
    const edges = [{ taskId: "a", dependsOnTaskId: "b" }];
    expect(wouldCreateCycle(edges, { taskId: "c", dependsOnTaskId: "d" })).toBe(false);
  });

  it("detects a direct two-node cycle (a->b, then b->a)", () => {
    const edges = [{ taskId: "a", dependsOnTaskId: "b" }];
    expect(wouldCreateCycle(edges, { taskId: "b", dependsOnTaskId: "a" })).toBe(true);
  });

  it("detects a longer transitive cycle (a->b->c, then c->a)", () => {
    const edges = [
      { taskId: "a", dependsOnTaskId: "b" },
      { taskId: "b", dependsOnTaskId: "c" },
    ];
    expect(wouldCreateCycle(edges, { taskId: "c", dependsOnTaskId: "a" })).toBe(true);
  });

  it("allows a diamond shape (a->b, a->c, b->d, c->d) with no cycle", () => {
    const edges = [
      { taskId: "a", dependsOnTaskId: "b" },
      { taskId: "a", dependsOnTaskId: "c" },
      { taskId: "b", dependsOnTaskId: "d" },
    ];
    expect(wouldCreateCycle(edges, { taskId: "c", dependsOnTaskId: "d" })).toBe(false);
  });
});
