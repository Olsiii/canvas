import { customType, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { spaces } from "./hierarchy";
import { tasks } from "./tasks";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: docs.ydoc_state bytea — TipTap/Yjs CRDT binary snapshot.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const docs = pgTable("docs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
  title: text("title").notNull().default("Untitled"),
  ydocState: bytea("ydoc_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// DATA_MODEL.md: doc_task_links (doc_id fk, task_id fk, uniq pair)
export const docTaskLinks = pgTable(
  "doc_task_links",
  {
    docId: uuid("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.docId, table.taskId] })],
);
