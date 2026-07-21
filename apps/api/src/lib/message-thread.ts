/**
 * Pure validation for replying to a message: the parent must be in the same
 * channel, and threading is capped at depth 2 (a reply cannot itself be
 * replied to). Returns an error message, or null if valid. Mirrors
 * comment-thread.ts's validateCommentParent.
 */
export function validateMessageParent(
  parent: { channelId: string; parentMessageId: string | null },
  childChannelId: string,
): string | null {
  if (parent.channelId !== childChannelId) {
    return "Reply must be in the same channel as the message it replies to";
  }
  if (parent.parentMessageId) {
    return "Replies cannot themselves be replied to";
  }
  return null;
}
