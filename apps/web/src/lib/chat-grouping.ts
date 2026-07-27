const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Whether `curr` should start a new visual group (repeat avatar/name) rather
 * than being clustered under the previous message — true when there's no
 * previous message, the author changed, or too much time passed between them. */
export function shouldStartNewGroup(
  prev: { authorId: string; createdAt: string | Date } | undefined,
  curr: { authorId: string; createdAt: string | Date },
): boolean {
  if (!prev) return true;
  if (prev.authorId !== curr.authorId) return true;
  const prevTime = new Date(prev.createdAt).getTime();
  const currTime = new Date(curr.createdAt).getTime();
  return currTime - prevTime > GROUP_WINDOW_MS;
}
