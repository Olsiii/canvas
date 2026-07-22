import { describe, expect, it } from "vitest";
import { evaluateConditions, interpolatePrompt, triggerMatches } from "./automation-engine";

describe("triggerMatches", () => {
  it("matches task_created against task_created", () => {
    expect(triggerMatches({ type: "task_created" }, { type: "task_created" })).toBe(true);
  });

  it("does not match different trigger types", () => {
    expect(
      triggerMatches(
        { type: "task_created" },
        { type: "task_status_changed", toStatusKind: "done" },
      ),
    ).toBe(false);
  });

  it("matches task_status_changed only when toStatusKind agrees", () => {
    expect(
      triggerMatches(
        { type: "task_status_changed", toStatusKind: "done" },
        { type: "task_status_changed", toStatusKind: "done" },
      ),
    ).toBe(true);
    expect(
      triggerMatches(
        { type: "task_status_changed", toStatusKind: "done" },
        { type: "task_status_changed", toStatusKind: "active" },
      ),
    ).toBe(false);
  });
});

describe("evaluateConditions", () => {
  it("always passes with no conditions", () => {
    expect(evaluateConditions([], { priority: null })).toBe(true);
  });

  it("passes when priority matches", () => {
    expect(evaluateConditions([{ field: "priority", equals: "high" }], { priority: "high" })).toBe(
      true,
    );
  });

  it("fails when priority doesn't match", () => {
    expect(evaluateConditions([{ field: "priority", equals: "high" }], { priority: "low" })).toBe(
      false,
    );
  });

  it("fails when the task has no priority set", () => {
    expect(evaluateConditions([{ field: "priority", equals: "high" }], { priority: null })).toBe(
      false,
    );
  });

  it("ANDs multiple conditions", () => {
    const conditions = [
      { field: "priority" as const, equals: "high" as const },
      { field: "priority" as const, equals: "urgent" as const },
    ];
    // Contradictory conditions (both must match a single priority value) —
    // proves AND semantics rather than OR.
    expect(evaluateConditions(conditions, { priority: "high" })).toBe(false);
  });
});

describe("interpolatePrompt", () => {
  it("substitutes {{title}} with the task's title", () => {
    expect(interpolatePrompt("A banner for {{title}}", { title: "Website Launch" })).toBe(
      "A banner for Website Launch",
    );
  });

  it("substitutes every occurrence", () => {
    expect(interpolatePrompt("{{title}} - {{title}}", { title: "X" })).toBe("X - X");
  });

  it("leaves the template untouched when there's no placeholder", () => {
    expect(interpolatePrompt("A static prompt", { title: "X" })).toBe("A static prompt");
  });
});
