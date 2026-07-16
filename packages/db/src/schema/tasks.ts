import {
  date,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { lists } from "./hierarchy";

export const statusKind = pgEnum("status_kind", ["open", "active", "done", "closed"]);
export const taskPriority = pgEnum("task_priority", ["urgent", "high", "normal", "low"]);

export const statuses = pgTable("statuses", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  kind: statusKind("kind").notNull(),
  orderKey: text("order_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Deliberately not cascading on statusId: deleting a status must not silently
// delete every task in it. See PROGRESS.md (M1.2 decisions).
export const tasks = pgTable("tasks", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  descriptionJson: jsonb("description_json").$type<unknown>(),
  statusId: uuid("status_id")
    .notNull()
    .references(() => statuses.id),
  priority: taskPriority("priority"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  orderKey: text("order_key").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })],
);
