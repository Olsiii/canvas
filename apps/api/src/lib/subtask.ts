/**
 * Pure validation for creating a subtask: the parent must live in the same
 * list as the new task, and nesting is capped at depth 2 (a subtask cannot
 * itself have subtasks). Returns an error message, or null if valid.
 */
export function validateSubtaskParent(
  parent: { listId: string; parentTaskId: string | null },
  childListId: string,
): string | null {
  if (parent.listId !== childListId) {
    return "Subtask must be in the same list as its parent";
  }
  if (parent.parentTaskId) {
    return "Subtasks cannot have their own subtasks";
  }
  return null;
}
