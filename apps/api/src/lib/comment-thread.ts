/**
 * Pure validation for replying to a comment: the parent must be on the same
 * task, and threading is capped at depth 2 (a reply cannot itself be
 * replied to). Returns an error message, or null if valid.
 */
export function validateCommentParent(
  parent: { taskId: string; parentCommentId: string | null },
  childTaskId: string,
): string | null {
  if (parent.taskId !== childTaskId) {
    return "Reply must be on the same task as the comment it replies to";
  }
  if (parent.parentCommentId) {
    return "Replies cannot themselves be replied to";
  }
  return null;
}
