import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { lists } from "./hierarchy";

// Drizzle has no built-in tsvector column type — this is a plain wrapper,
// not a real client-side value type (the generated column below is always
// written by Postgres itself, never by the app).
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

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
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    // Subtasks: null for a top-level task. Nesting is capped at depth 2 (a
    // subtask may not itself have subtasks) — enforced in the API layer, not
    // the schema. See PROGRESS.md (M1.6 decisions).
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    descriptionJson: jsonb("description_json").$type<unknown>(),
    // Plain-text extraction of descriptionJson (see lib/plain-text.ts),
    // kept in sync by the API on every description write — to_tsvector has
    // no way to read a jsonb TipTap doc directly, so searchVector below is
    // generated from this column instead of descriptionJson itself.
    descriptionText: text("description_text"),
    statusId: uuid("status_id")
      .notNull()
      .references(() => statuses.id),
    priority: taskPriority("priority"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    // M3.4: not in DATA_MODEL.md's tasks row (no dedicated `milestones`
    // table exists there either) — a milestone is modeled as a flag on an
    // otherwise-ordinary task rather than a new entity. See PROGRESS.md.
    isMilestone: boolean("is_milestone").notNull().default(false),
    orderKey: text("order_key").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // DATA_MODEL.md: "FTS: generated tsvector on tasks.title + description
    // (GIN)". Title weighted above description (a title match ranks higher).
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description_text, '')), 'B')`,
    ),
  },
  (table) => [index("tasks_search_vector_idx").using("gin", table.searchVector)],
);

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

export const taskDependencyKind = pgEnum("task_dependency_kind", ["blocks", "waiting_on"]);

// Gantt arrows (M3.3). Unlike taskAssignees/taskWatchers, DATA_MODEL.md
// gives this edge its own `id` (not a composite PK) — kept as specified.
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: taskDependencyKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.taskId, table.dependsOnTaskId)],
);
