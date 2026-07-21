/**
 * Pure validation for adding a Gantt dependency edge: self-dependency is
 * always rejected, and (mirroring subtask.ts's same-list constraint) both
 * tasks must live in the same list — the Gantt view is per-list, so a
 * cross-list edge would have nowhere to draw its arrow. Cycle detection is
 * deferred to M3.4 (full dependency management).
 */
export function validateTaskDependency(
  task: { id: string; listId: string },
  dependsOnTask: { id: string; listId: string },
): string | null {
  if (task.id === dependsOnTask.id) {
    return "A task cannot depend on itself";
  }
  if (task.listId !== dependsOnTask.listId) {
    return "Dependencies must be between tasks in the same list";
  }
  return null;
}
