import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { lists } from "./hierarchy";
import { tasks } from "./tasks";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: forms (id, workspace_id fk, list_id fk, schema_json jsonb,
// public_token uniq). `name`/`createdBy`/timestamps added beyond the compact
// listing, same as docs' created_at/updated_at — a builder needs a display
// name, and a public submission has no session user to attribute the
// resulting task to (see form.ts's submitPublic, which uses createdBy the
// same way M3.5's scheduler attributes a spawned recurring task to
// template.createdBy).
//
// `taskId` (nullable, added later than the rest of the table): when set,
// the form is in "task completion" mode instead of "intake" mode — the
// public page shows that one task's info + a file-attach widget instead of
// custom fields, and submitting marks the task done rather than creating a
// new one. `set null` on the task's own deletion rather than cascading the
// form away, since the form (and whatever got attached through it) is
// still worth keeping around as a record even if its task is later
// deleted. `listId` stays required either way — a form is still organized
// under a list for permission/listing purposes even in completion mode.
export const forms = pgTable("forms", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  schemaJson: jsonb("schema_json").$type<unknown>().notNull(),
  publicToken: text("public_token")
    .notNull()
    .unique()
    .$defaultFn(() => uuidv7()),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
