import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// M5.5 importers. Not in DATA_MODEL.md's compact listing (Phase 5 there
// stops at api_keys/webhooks) — an import is a real async job (a ClickUp
// import makes many external API calls; a CSV import can create thousands
// of rows), so it needs the same "row tracks job status, worker does the
// work" shape M2.1's image_versions/M5.4's webhooks jobs already use, not
// just a fire-and-forget mutation. `sourceDetail` names the CSV tool
// ("trello"/"asana") when source is "csv"; null for "clickup_api".
export const importSource = pgEnum("import_source", ["clickup_api", "csv"]);
export const importStatus = pgEnum("import_status", ["pending", "running", "done", "failed"]);

export const imports = pgTable("imports", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  source: importSource("source").notNull(),
  sourceDetail: text("source_detail"),
  status: importStatus("status").notNull().default("pending"),
  // CSV: the parsed rows + target space/list naming, read by the worker so
  // the (cheap, pure, local) parsing can happen in the request handler
  // while the (potentially large) DB writes still run off the request
  // path. ClickUp: never persisted here — the API token is passed as
  // BullMQ job data only, not written to Postgres. See PROGRESS.md.
  payloadJson: jsonb("payload_json").$type<unknown>(),
  // Counts of what got created, plus any per-row skip reasons — shown on
  // the import history list once status is "done".
  summaryJson: jsonb("summary_json").$type<unknown>(),
  error: text("error"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
