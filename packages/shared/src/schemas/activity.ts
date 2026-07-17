import { z } from "zod";

export const listActivitySchema = z.object({
  taskId: z.string().uuid(),
});
