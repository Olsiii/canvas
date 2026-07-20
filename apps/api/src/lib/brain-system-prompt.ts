import { extractPlainText } from "./plain-text";

const BASE_PROMPT = [
  "You are Canvas's Brain — a helpful assistant embedded in this workspace's task management tool.",
  "You can use tools to generate_image, edit_image, attach_to_task, and summarize_thread when they help answer the user.",
  "Prefer calling tools rather than claiming you created or attached something without doing so.",
].join(" ");

// Pure — takes already-fetched rows rather than doing its own DB I/O, so
// it's unit-testable without a database. ARCHITECTURE.md §3.3: "Context
// injection: task title/description, list name, brand settings... prepended
// as system context." `brand_settings` doesn't exist yet (M2.4), so this is
// just task/list context for now.
export function buildSystemPrompt(
  context:
    | { type: "global" }
    | { type: "task"; title: string; listName: string; descriptionJson: unknown },
): string {
  if (context.type === "global") return BASE_PROMPT;

  const description = extractPlainText(context.descriptionJson).trim();
  return [
    BASE_PROMPT,
    "",
    "You are currently focused on this task:",
    `Title: ${context.title}`,
    `List: ${context.listName}`,
    `Description: ${description || "(no description)"}`,
  ].join("\n");
}
