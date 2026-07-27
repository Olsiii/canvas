import { z } from "zod";

export const workspaceAiUsageCostSchema = z.object({
  workspaceId: z.string().uuid(),
  // Date-only strings (YYYY-MM-DD), inclusive range — same convention as
  // workspaceTimesheetSchema, since the two are shown side by side.
  start: z.string().date(),
  end: z.string().date(),
});
