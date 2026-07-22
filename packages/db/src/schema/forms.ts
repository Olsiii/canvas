import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { lists } from "./hierarchy";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: forms (id, workspace_id fk, list_id fk, schema_json jsonb,
// public_token uniq). `name`/`createdBy`/timestamps added beyond the compact
// listing, same as docs' created_at/updated_at — a builder needs a display
// name, and a public submission has no session user to attribute the
// resulting task to (see form.ts's submitPublic, which uses createdBy the
// same way M3.5's scheduler attributes a spawned recurring task to
// template.createdBy).
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
