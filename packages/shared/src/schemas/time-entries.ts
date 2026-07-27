import { z } from "zod";

export const startTimerSchema = z.object({
  taskId: z.string().uuid(),
});

export const createManualTimeEntrySchema = z
  .object({
    taskId: z.string().uuid(),
    // `<input type="datetime-local">` values — no timezone offset, treated
    // as the server's local time (same convention as M3.5's reminders).
    startedAt: z.string().datetime({ local: true }),
    endedAt: z.string().datetime({ local: true }),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => new Date(v.endedAt).getTime() > new Date(v.startedAt).getTime(), {
    message: "End time must be after start time",
    path: ["endedAt"],
  });

export const deleteTimeEntrySchema = z.object({
  entryId: z.string().uuid(),
});

export const listTimeEntriesForTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export const timesheetSchema = z.object({
  workspaceId: z.string().uuid(),
  // Date-only strings (YYYY-MM-DD), inclusive range.
  start: z.string().date(),
  end: z.string().date(),
});

// Same shape as timesheetSchema — kept as a separate export since it's
// gated by a different, more sensitive permission (timeEntry:viewAll).
export const workspaceTimesheetSchema = timesheetSchema;
