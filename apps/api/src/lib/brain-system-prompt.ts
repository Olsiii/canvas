import { extractPlainText } from "./plain-text";

const BASE_PROMPT = [
  "You are Canvas's Brain — a helpful assistant embedded in this workspace's task management tool.",
  "You can use tools to generate_image, edit_image, attach_to_task, summarize_thread, and critique_image when they help answer the user.",
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
    | { type: "task"; title: string; listName: string; descriptionJson: unknown }
    | { type: "doc"; title: string; linkedTasks: { id: string; title: string }[] }
    | { type: "channel"; name: string },
): string {
  if (context.type === "global") return BASE_PROMPT;

  if (context.type === "channel") {
    return [
      BASE_PROMPT,
      "",
      `You are currently focused on the #${context.name} chat channel.`,
      "You do not have access to that channel's message history — only what the user tells you in this conversation.",
      "attach_to_task requires an explicit task_id here, since a channel has no linked tasks.",
    ].join("\n");
  }

  if (context.type === "doc") {
    const linked =
      context.linkedTasks.length === 0
        ? "(none)"
        : context.linkedTasks.map((t) => `- ${t.title} (${t.id})`).join("\n");
    return [
      BASE_PROMPT,
      "",
      "You are currently focused on this doc:",
      `Title: ${context.title}`,
      "Linked tasks (use these ids with attach_to_task when relevant):",
      linked,
      "When you generate_image in this doc context, the client inserts the result into the doc automatically.",
    ].join("\n");
  }

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
