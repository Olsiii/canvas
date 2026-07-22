import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: dashboards (id, workspace_id fk, name). `createdBy`/
// timestamps added beyond the compact listing, same as every other M4/M5
// workspace-content table (forms, automations) — needed for the same
// "who built this" bookkeeping other list pages already show.
export const dashboards = pgTable("dashboards", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// DATA_MODEL.md: widgets (id, dashboard_id fk, type, config_json, order_key).
// `type` + `config_json` shape is `WidgetConfig` (packages/shared/src/
// schemas/dashboards.ts) — a discriminated union keyed by the same `type`
// stored redundantly in its own column so the widget list query can filter/
// sort without parsing every row's jsonb.
export const widgets = pgTable("widgets", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  dashboardId: uuid("dashboard_id")
    .notNull()
    .references(() => dashboards.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  configJson: jsonb("config_json").$type<unknown>().notNull(),
  orderKey: text("order_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
