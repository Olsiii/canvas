import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { tasks } from "./tasks";

// One rule per task (DATA_MODEL.md: "task_id fk uniq") — a task is either a
// recurring template or it isn't. `next_run_at` doubles as the anchor for
// computing the occurrence after it (see apps/api/src/lib/recurrence.ts) —
// no separate dtstart column, since re-anchoring on the current next_run_at
// is equivalent to a fixed original dtstart for every INTERVAL=1 preset
// this milestone exposes (daily/weekdays/weekly/monthly).
export const recurrenceRules = pgTable("recurrence_rules", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  taskId: uuid("task_id")
    .notNull()
    .unique()
    .references(() => tasks.id, { onDelete: "cascade" }),
  rrule: text("rrule").notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// DATA_MODEL.md's `task_id fk null` allows a standalone reminder with no
// task at all, but a standalone reminder has no workspace to log an
// `activity` row against (every other notification in this app is sourced
// from one) — scoped down to task-linked reminders only for M3.5; see
// PROGRESS.md. The column itself stays nullable, matching DATA_MODEL.md.
export const reminders = pgTable("reminders", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  note: text("note"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
