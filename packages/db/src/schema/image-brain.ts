import {
  type AnyPgColumn,
  index,
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
export const brainContextType = pgEnum("brain_context_type", ["task", "doc", "channel", "global"]);
export const brainMessageRole = pgEnum("brain_message_role", ["user", "assistant", "tool"]);

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

// DATA_MODEL.md: "One brain_conversation per context (task, doc, channel, or
// global)". M2.2 only ever creates 'task'/'global' conversations (Docs is
// M4.1, Chat is M4.3 — no UI surface exists yet for those contexts), but the
// enum matches the full spec now rather than needing a migration later.
// `contextId` is null for 'global'. No DB unique constraint enforcing
// "one per (workspace, contextType, contextId, createdBy)" — conversations
// are scoped per-user (see PROGRESS.md M2.2 decisions), found-or-created by
// the API layer; a rare race producing two rows is a low-stakes edge case,
// not worth a partial unique index on a nullable column for this milestone.
export const brainConversations = pgTable("brain_conversations", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  contextType: brainContextType("context_type").notNull(),
  contextId: uuid("context_id"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brainMessages = pgTable(
  "brain_messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => brainConversations.id, { onDelete: "cascade" }),
    role: brainMessageRole("role").notNull(),
    // "text + tool calls + image refs" per DATA_MODEL.md — M2.2 only ever
    // writes `{ text: string }` (no tool-use yet; that's M2.3). Kept as
    // unknown jsonb rather than a narrower type so M2.3 can extend the shape
    // without a schema migration.
    contentJson: jsonb("content_json").$type<unknown>().notNull(),
    imageVersionIds: uuid("image_version_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // DATA_MODEL.md: "brain_messages(conversation_id, created_at)" — list
    // history is always ordered by created_at within one conversation.
    index("brain_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ],
);
