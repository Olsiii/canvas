import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

export const automationRunStatus = pgEnum("automation_run_status", ["success", "error"]);

// DATA_MODEL.md: automations (id, workspace_id fk, name, trigger_json,
// conditions_json, actions_json, enabled). `createdBy` added beyond the
// compact listing, same reasoning as forms' `createdBy` (M4.5) — an
// automation-triggered action (e.g. add_tag, post_comment) has no session
// user to attribute its task mutation/activity row to, so it's attributed
// to whoever authored the automation, mirroring M3.5's
// `recurrenceRules`→`template.createdBy` pattern.
export const automations = pgTable("automations", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerJson: jsonb("trigger_json").$type<unknown>().notNull(),
  conditionsJson: jsonb("conditions_json").$type<unknown>().notNull(),
  actionsJson: jsonb("actions_json").$type<unknown>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// DATA_MODEL.md: automation_runs (id, automation_id fk, status, log_json,
// created_at). One row per trigger firing whose conditions matched (a
// trigger that fires but whose conditions don't match leaves no row —
// nothing happened, so there's nothing to log to the run history).
export const automationRuns = pgTable("automation_runs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  automationId: uuid("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  status: automationRunStatus("status").notNull(),
  logJson: jsonb("log_json").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
