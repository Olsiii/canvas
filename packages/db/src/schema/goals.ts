import {
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { tasks } from "./tasks";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: goals (id, workspace_id fk, name, metric_json, due_date).
// `metric_json` shape is `GoalMetric` (packages/shared/src/schemas/goals.ts)
// — either "task_completion" (progress derived from linked tasks'
// completed_at, M5.2) or "numeric" (a manually-updated current/target).
// `createdBy`/timestamps added beyond the compact listing, same as every
// other M4/M5 workspace-content table (forms, automations, dashboards).
export const goals = pgTable(
  "goals",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    metricJson: jsonb("metric_json").$type<unknown>().notNull(),
    dueDate: date("due_date"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_workspace_id_idx").on(table.workspaceId)],
);

// DATA_MODEL.md: goal_links(goal_id, task_id) — same shape as M4.2's
// doc_task_links.
export const goalLinks = pgTable(
  "goal_links",
  {
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.goalId, table.taskId] })],
);
