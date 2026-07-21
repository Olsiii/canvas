import { z } from "zod";

// Scoped to task-linked reminders only for M3.5 — see PROGRESS.md.
export const createReminderSchema = z.object({
  taskId: z.string().uuid(),
  // `<input type="datetime-local">`'s value: no timezone offset. Treated as
  // the server's local time, matching this app's date handling elsewhere
  // (no per-user timezone support yet — see PROGRESS.md).
  remindAt: z.string().datetime({ local: true }),
  note: z.string().trim().max(500).optional(),
});

export const dismissReminderSchema = z.object({
  reminderId: z.string().uuid(),
});
