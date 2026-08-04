import { z } from "zod";

export const listActivitySchema = z.object({
  taskId: z.string().uuid(),
});

export const listWorkspaceActivitySchema = z.object({
  workspaceId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(50),
  /** Pagination cursor from the previous page's `nextCursor` — an activity id. */
  cursor: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().min(1).optional(),
  /** Substring match against `verb` (e.g. "task" matches every task.* verb). */
  verb: z.string().trim().min(1).optional(),
  /** Inclusive start of the created-at range. */
  from: z.string().datetime().optional(),
  /** Inclusive end of the created-at range. */
  to: z.string().datetime().optional(),
});
