import { z } from "zod";
import { TASK_PRIORITIES } from "../priority";

// The shape captured into task_templates.payload_json (M3.6). Validated
// with .parse() when read back at instantiate time, not just trusted as
// `unknown` — it's still app-authored data, but round-tripping through
// jsonb is worth a runtime check same as any other external boundary.
export const taskTemplatePayloadSchema = z.object({
  title: z.string(),
  descriptionJson: z.unknown().nullable(),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  tagIds: z.array(z.string().uuid()),
  checklists: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
});
export type TaskTemplatePayload = z.infer<typeof taskTemplatePayloadSchema>;

export const listTaskTemplatesSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createTaskTemplateFromTaskSchema = z.object({
  taskId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

export const deleteTaskTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export const instantiateTaskTemplateSchema = z.object({
  templateId: z.string().uuid(),
  listId: z.string().uuid(),
});
