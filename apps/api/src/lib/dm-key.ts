/**
 * Deterministic, order-independent key identifying a DM channel's pair of
 * participants — sorting before joining means it doesn't matter who
 * started the conversation or which order the two ids are passed in,
 * `dm.startOrGet` always looks up (and the partial unique index on
 * `channels.dmKey` always enforces) the same key for a given pair.
 */
export function buildDmKey(userIdA: string, userIdB: string): string {
  if (userIdA === userIdB) {
    throw new Error("Cannot build a DM key for a user and themself");
  }
  return [userIdA, userIdB].sort().join(":");
}
