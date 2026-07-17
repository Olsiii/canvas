import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { tasks } from "./tasks";

export const checklists = pgTable("checklists", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  orderKey: text("order_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  checklistId: uuid("checklist_id")
    .notNull()
    .references(() => checklists.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  done: boolean("done").notNull().default(false),
  orderKey: text("order_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
