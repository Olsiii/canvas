import {
  type AnyPgColumn,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

export const imageOrigin = pgEnum("image_origin", ["upload", "generation"]);
export const imageVersionSource = pgEnum("image_version_source", ["upload", "generate", "edit"]);
export const aiUsageKind = pgEnum("ai_usage_kind", ["generate", "edit", "chat", "vision"]);

// `imageAssets.currentVersionId` <-> `imageVersions.assetId` is a genuine
// circular FK between the two tables (DATA_MODEL.md: current_version_id
// "set after first version"). Both `.references()` callbacks below are
// lazy — Drizzle only invokes them once the whole module has finished
// evaluating — so each can name the other `const` even though one is
// declared textually below the other, the same pattern tasks.ts already
// uses for its own self-referencing parentTaskId.
export const imageAssets = pgTable("image_assets", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  origin: imageOrigin("origin").notNull(),
  currentVersionId: uuid("current_version_id").references((): AnyPgColumn => imageVersions.id),
  altText: text("alt_text"),
  tagsJson: jsonb("tags_json").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const imageVersions = pgTable("image_versions", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => imageAssets.id, { onDelete: "cascade" }),
  // A tree, not a list — every edit branches from the version it edited.
  // See ARCHITECTURE.md §3.2 ("branch from any node").
  parentVersionId: uuid("parent_version_id").references((): AnyPgColumn => imageVersions.id),
  source: imageVersionSource("source").notNull(),
  prompt: text("prompt"),
  instruction: text("instruction"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  fileKey: text("file_key").notNull(),
  thumbKey: text("thumb_key"),
  blurhash: text("blurhash"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only metering log (no deletedAt/updatedAt — same shape as
// `activity`). CLAUDE.md hard rule: "Every AI call writes an ai_usage row."
export const aiUsage = pgTable("ai_usage", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: aiUsageKind("kind").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  credits: integer("credits").notNull(),
  costUsdEst: numeric("cost_usd_est", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
