/**
 * Pure validation for adding a Gantt dependency edge: self-dependency is
 * always rejected, and (mirroring subtask.ts's same-list constraint) both
 * tasks must live in the same list — the Gantt view is per-list, so a
 * cross-list edge would have nowhere to draw its arrow.
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

export type DependencyEdge = { taskId: string; dependsOnTaskId: string };

/**
 * M3.4: would adding `candidate` (taskId depends on dependsOnTaskId) close a
 * cycle given the edges that already exist? An edge u -> v means "u depends
 * on v" (v must happen first). Adding taskId -> dependsOnTaskId creates a
 * cycle exactly when dependsOnTaskId can already (transitively) reach
 * taskId — i.e. taskId already, indirectly, depends on itself once the new
 * edge is added. Plain BFS over the existing adjacency list.
 */
export function wouldCreateCycle(edges: DependencyEdge[], candidate: DependencyEdge): boolean {
  if (edges.length === 0) return false;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.taskId) ?? [];
    list.push(edge.dependsOnTaskId);
    adjacency.set(edge.taskId, list);
  }

  const visited = new Set<string>([candidate.dependsOnTaskId]);
  const queue = [candidate.dependsOnTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === candidate.taskId) return true;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
