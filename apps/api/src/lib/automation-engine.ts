import type { AutomationCondition, AutomationTrigger, TaskPriority } from "@canvas/shared";

/** The event a task mutation reports; matched against each automation's stored trigger. */
export type AutomationTriggerEvent =
  { type: "task_created" } | { type: "task_status_changed"; toStatusKind: string };

export function triggerMatches(trigger: AutomationTrigger, event: AutomationTriggerEvent): boolean {
  if (trigger.type !== event.type) return false;
  if (trigger.type === "task_status_changed" && event.type === "task_status_changed") {
    return trigger.toStatusKind === event.toStatusKind;
  }
  return true;
}

function matchesCondition(
  condition: AutomationCondition,
  task: { priority: TaskPriority | null },
): boolean {
  return task.priority === condition.equals;
}

/** All conditions must match (AND) — an automation with no conditions always runs. */
export function evaluateConditions(
  conditions: AutomationCondition[],
  task: { priority: TaskPriority | null },
): boolean {
  return conditions.every((c) => matchesCondition(c, task));
}

/** Substitutes `{{title}}` in a generate_image action's prompt template with the task's title. */
export function interpolatePrompt(template: string, vars: { title: string }): string {
  return template.replace(/\{\{\s*title\s*\}\}/g, vars.title);
}
