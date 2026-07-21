import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { workspaces } from "./workspaces";

// DATA_MODEL.md's Phase-3+ section: (id, workspace_id fk, name, payload_json
// jsonb). `payload_json` shape is `TaskTemplatePayload` (packages/shared/src/
// schemas/task-templates.ts) — title/description/priority/tags/checklists
// captured from a source task at "Save as template" time (M3.6).
export const taskTemplates = pgTable("task_templates", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  payloadJson: jsonb("payload_json").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
