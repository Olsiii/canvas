/**
 * Walks a TipTap document (comment body_json) and returns the de-duped list
 * of mentioned user ids (`{ type: "mention", attrs: { id } }` nodes).
 * Extracting from the document itself — rather than trusting a
 * client-supplied list — keeps notifications in sync with what the comment
 * actually says.
 */
export function extractMentionedUserIds(bodyJson: unknown): string[] {
  const ids = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: unknown; attrs?: unknown; content?: unknown };
    if (n.type === "mention") {
      const attrs = n.attrs as { id?: unknown } | undefined;
      if (typeof attrs?.id === "string") ids.add(attrs.id);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(bodyJson);
  return [...ids];
}
