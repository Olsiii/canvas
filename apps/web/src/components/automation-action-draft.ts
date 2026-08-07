import type { AutomationActionType, TaskPriority } from "@canvas/shared";

// A superset of every action's fields, used only while editing — one shape
// keeps the row's state simple to update, and the fields not relevant to
// the currently-selected `type` are just ignored when building the
// AutomationAction[] to submit (see toAutomationActions below).
export interface ActionDraft {
  type: AutomationActionType;
  priority: TaskPriority;
  tagId: string;
  text: string;
  prompt: string;
  webhookUrl: string;
  message: string;
}

export function newActionDraft(): ActionDraft {
  return {
    type: "post_comment",
    priority: "normal",
    tagId: "",
    text: "",
    prompt: "",
    webhookUrl: "",
    message: "",
  };
}

/** Drops the fields irrelevant to each draft's selected `type`, producing the shape the server expects. */
export function toAutomationActions(drafts: ActionDraft[]) {
  return drafts.map((d) => {
    switch (d.type) {
      case "set_priority":
        return { type: "set_priority" as const, priority: d.priority };
      case "add_tag":
        return { type: "add_tag" as const, tagId: d.tagId };
      case "post_comment":
        return { type: "post_comment" as const, text: d.text };
      case "generate_image":
        return { type: "generate_image" as const, prompt: d.prompt };
      case "slack_notify":
        return { type: "slack_notify" as const, webhookUrl: d.webhookUrl, message: d.message };
    }
  });
}
