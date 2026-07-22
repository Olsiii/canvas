import { z } from "zod";
import { STATUS_KINDS } from "../statuses";
import { TASK_PRIORITIES } from "../priority";

// M5.1 automations engine: trigger -> condition -> action, per ROADMAP.md.

export const automationTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task_created") }),
  z.object({ type: z.literal("task_status_changed"), toStatusKind: z.enum(STATUS_KINDS) }),
]);
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

// Deliberately a single shape (not a union) for v1 — "priority equals X" is
// the only condition the UI builds, and DATA_MODEL.md's conditions_json is
// an array so more shapes can be added later without a migration.
export const automationConditionSchema = z.object({
  field: z.literal("priority"),
  equals: z.enum(TASK_PRIORITIES),
});
export type AutomationCondition = z.infer<typeof automationConditionSchema>;

export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_priority"), priority: z.enum(TASK_PRIORITIES) }),
  z.object({ type: z.literal("add_tag"), tagId: z.string().uuid() }),
  z.object({ type: z.literal("post_comment"), text: z.string().trim().min(1).max(2000) }),
  // {{title}} is substituted with the triggering task's title (see
  // apps/api/src/lib/automation-engine.ts's interpolatePrompt).
  z.object({ type: z.literal("generate_image"), prompt: z.string().trim().min(1).max(500) }),
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationActionType = AutomationAction["type"];

export const listAutomationsSchema = z.object({ workspaceId: z.string().uuid() });

export const getAutomationSchema = z.object({ automationId: z.string().uuid() });

export const createAutomationSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  trigger: automationTriggerSchema,
  conditions: z.array(automationConditionSchema).max(5),
  actions: z.array(automationActionSchema).min(1).max(5),
});

export const updateAutomationSchema = z.object({
  automationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  trigger: automationTriggerSchema.optional(),
  conditions: z.array(automationConditionSchema).max(5).optional(),
  actions: z.array(automationActionSchema).min(1).max(5).optional(),
  enabled: z.boolean().optional(),
});

export const deleteAutomationSchema = z.object({ automationId: z.string().uuid() });

export const listAutomationRunsSchema = z.object({ automationId: z.string().uuid() });
