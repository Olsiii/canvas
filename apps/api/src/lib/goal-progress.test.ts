import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./goal-progress";

describe("computeGoalProgress", () => {
  describe("task_completion", () => {
    it("is 0 with no linked tasks", () => {
      expect(computeGoalProgress({ type: "task_completion" }, [])).toBe(0);
    });

    it("is the percentage of linked tasks completed", () => {
      const tasks = [
        { completedAt: new Date("2026-07-01") },
        { completedAt: null },
        { completedAt: null },
        { completedAt: null },
      ];
      expect(computeGoalProgress({ type: "task_completion" }, tasks)).toBe(25);
    });

    it("is 100 when every linked task is completed", () => {
      const tasks = [{ completedAt: new Date() }, { completedAt: new Date() }];
      expect(computeGoalProgress({ type: "task_completion" }, tasks)).toBe(100);
    });
  });

  describe("numeric", () => {
    it("is the current/target percentage", () => {
      const metric = { type: "numeric" as const, target: 100, current: 40 };
      expect(computeGoalProgress(metric, [])).toBe(40);
    });

    it("clamps below 0 to 0", () => {
      const metric = { type: "numeric" as const, target: 100, current: -10 };
      expect(computeGoalProgress(metric, [])).toBe(0);
    });

    it("clamps above 100 to 100 when current overshoots target", () => {
      const metric = { type: "numeric" as const, target: 100, current: 150 };
      expect(computeGoalProgress(metric, [])).toBe(100);
    });

    it("is 0 for a non-positive target rather than dividing by zero", () => {
      const metric = { type: "numeric" as const, target: 0, current: 5 };
      expect(computeGoalProgress(metric, [])).toBe(0);
    });
  });
});
