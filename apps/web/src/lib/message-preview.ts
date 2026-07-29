// TipTap doc JSON -> a short plain-text preview, for surfaces (the DM
// toast, so far) that can't render rich text directly. Never converts to or
// stores HTML — bodyJson stays TipTap JSON per CLAUDE.md, this just walks
// its text/mention nodes for display.
type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: { label?: string };
  content?: TiptapNode[];
};

export function extractMessagePreview(bodyJson: unknown, maxLength = 80): string {
  const parts: string[] = [];

  function walk(node: TiptapNode | undefined) {
    if (!node) return;
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "mention" && node.attrs?.label) parts.push(`@${node.attrs.label}`);
    node.content?.forEach(walk);
  }
  walk(bodyJson as TiptapNode | undefined);

  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
