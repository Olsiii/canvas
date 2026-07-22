import type { GoalMetric } from "@canvas/shared";

/**
 * 0-100. `task_completion` derives progress purely from how many linked
 * tasks are completed (M5.2's `tasks.completed_at`) — no manual updates
 * needed. `numeric` is a manually-tracked current/target, clamped to
 * [0, 100] since `current` can legitimately overshoot `target`.
 */
export function computeGoalProgress(
  metric: GoalMetric,
  linkedTasks: { completedAt: Date | null }[],
): number {
  if (metric.type === "task_completion") {
    if (linkedTasks.length === 0) return 0;
    const done = linkedTasks.filter((t) => t.completedAt !== null).length;
    return Math.round((done / linkedTasks.length) * 100);
  }

  if (metric.target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((metric.current / metric.target) * 100)));
}
