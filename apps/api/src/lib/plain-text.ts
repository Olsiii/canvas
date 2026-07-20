/**
 * Walks a TipTap document (task description_json) and concatenates every
 * text node into a plain string, for feeding Postgres full-text search —
 * `to_tsvector` has no way to read a jsonb TipTap doc directly. Mirrors
 * `extractMentionedUserIds`'s walk-the-tree shape (see mentions.ts).
 */
export function extractPlainText(json: unknown): string {
  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(json);
  return parts.join(" ");
}
