import { z } from "zod";

export const workloadAssignmentsSchema = z.object({
  workspaceId: z.string().uuid(),
  // Date-only strings (YYYY-MM-DD), inclusive range.
  start: z.string().date(),
  end: z.string().date(),
});
