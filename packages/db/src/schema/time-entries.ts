import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { tasks } from "./tasks";

// DATA_MODEL.md's Phase-3+ section: (id, task_id fk, user_id fk, started_at,
// ended_at null, duration_sec, note). `duration_sec` is nullable here too,
// beyond what the doc's shorthand marks — see PROGRESS.md (M3.7 decisions):
// a running timer (ended_at null) genuinely has no final duration yet.
export const timeEntries = pgTable("time_entries", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSec: integer("duration_sec"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
