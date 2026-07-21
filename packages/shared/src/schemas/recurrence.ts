import { z } from "zod";
import { RECURRENCE_PRESETS } from "../recurrence";

export const setTaskRecurrenceSchema = z.object({
  taskId: z.string().uuid(),
  preset: z.enum(RECURRENCE_PRESETS),
});

export const clearTaskRecurrenceSchema = z.object({
  taskId: z.string().uuid(),
});
