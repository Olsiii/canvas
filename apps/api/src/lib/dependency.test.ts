import { describe, expect, it } from "vitest";
import { validateTaskDependency } from "./dependency";

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
