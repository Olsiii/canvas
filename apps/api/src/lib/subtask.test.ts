import { describe, expect, it } from "vitest";
import { validateSubtaskParent } from "./subtask";

describe("validateSubtaskParent", () => {
  it("allows a top-level parent in the same list", () => {
    expect(validateSubtaskParent({ listId: "list-1", parentTaskId: null }, "list-1")).toBeNull();
  });

  it("rejects a parent in a different list", () => {
    expect(validateSubtaskParent({ listId: "list-1", parentTaskId: null }, "list-2")).toMatch(
      /same list/,
    );
  });

  it("rejects nesting under a subtask (depth cap of 2)", () => {
    expect(
      validateSubtaskParent({ listId: "list-1", parentTaskId: "grandparent" }, "list-1"),
    ).toMatch(/cannot have their own subtasks/);
  });
});
