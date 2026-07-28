import { z } from "zod";

export const listActivitySchema = z.object({
  taskId: z.string().uuid(),
});

export const listWorkspaceActivitySchema = z.object({
  workspaceId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(50),
  /** ISO timestamp cursor — return rows strictly older than this. */
  before: z.string().datetime().optional(),
});
