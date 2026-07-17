import { jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { lists } from "./hierarchy";
import { tasks } from "./tasks";
import { workspaces } from "./workspaces";

export const customFieldType = pgEnum("custom_field_type", [
  "text",
  "number",
  "date",
  "dropdown",
  "label",
  "checkbox",
  "url",
  "currency",
  "image",
]);

export const customFieldDefs = pgTable("custom_field_defs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  // null = workspace-wide (applies to every list). Not exposed by the UI
  // yet — see PROGRESS.md (M1.8 decisions) — but supported by the schema
  // and API since DATA_MODEL.md specifies it.
  listId: uuid("list_id").references(() => lists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: customFieldType("type").notNull(),
  optionsJson: jsonb("options_json").$type<unknown>(),
  orderKey: text("order_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    fieldDefId: uuid("field_def_id")
      .notNull()
      .references(() => customFieldDefs.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    valueJson: jsonb("value_json").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.fieldDefId, table.taskId)],
);
