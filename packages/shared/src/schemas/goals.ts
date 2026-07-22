import { z } from "zod";

// M5.3 goals/OKRs linked to tasks. Two metric shapes: a key result driven
// by linked-task completion (no manual updates needed — see M5.2's
// tasks.completed_at), or a manually-tracked numeric current/target.
export const goalMetricSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task_completion") }),
  z.object({
    type: z.literal("numeric"),
    target: z.number(),
    current: z.number(),
    unit: z.string().trim().max(20).optional(),
  }),
]);
export type GoalMetric = z.infer<typeof goalMetricSchema>;

export const listGoalsSchema = z.object({ workspaceId: z.string().uuid() });

export const getGoalSchema = z.object({ goalId: z.string().uuid() });

export const createGoalSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  metric: goalMetricSchema,
  dueDate: z.string().date().nullable().optional(),
});

export const updateGoalSchema = z.object({
  goalId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  metric: goalMetricSchema.optional(),
  dueDate: z.string().date().nullable().optional(),
});

export const deleteGoalSchema = z.object({ goalId: z.string().uuid() });

export const listGoalTaskLinksSchema = z.object({ goalId: z.string().uuid() });

export const addGoalTaskLinkSchema = z.object({
  goalId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const removeGoalTaskLinkSchema = z.object({
  goalId: z.string().uuid(),
  taskId: z.string().uuid(),
});
