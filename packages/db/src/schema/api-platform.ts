import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: api_keys (id, workspace_id fk, hash, name, last_used_at).
// Only the SHA-256 `hash` is ever stored — the raw key is shown once at
// creation time (api-key.ts router) and never persisted or retrievable
// again, standard practice for bearer API credentials. `createdBy` added
// beyond the compact listing: the REST v1 API (routes/api-v1.ts) acts AS
// that user for permission checks and activity attribution, so a key's
// effective access follows its creator's current workspace role exactly
// (if they're removed from the workspace, their keys stop working too) —
// no separate "service account" concept needed.
export const apiKeys = pgTable("api_keys", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  hash: text("hash").notNull().unique(),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// DATA_MODEL.md: webhooks (id, workspace_id fk, url, events text[], secret).
// `createdBy` added for the same reason as above (also used as the
// activity-log actor when a webhook is created/deleted).
export const webhooks = pgTable("webhooks", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secret: text("secret").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
