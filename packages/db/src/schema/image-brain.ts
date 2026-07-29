import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

export const imageOrigin = pgEnum("image_origin", ["upload", "generation"]);
export const imageVersionSource = pgEnum("image_version_source", ["upload", "generate", "edit"]);
export const aiUsageKind = pgEnum("ai_usage_kind", ["generate", "edit", "chat", "vision", "embed"]);
export const brainContextType = pgEnum("brain_context_type", ["task", "doc", "channel", "global"]);
export const brainMessageRole = pgEnum("brain_message_role", ["user", "assistant", "tool"]);
export const copyLanguage = pgEnum("copy_language", ["sq", "en", "both"]);
// 'custom' is every folder a user creates by hand (still flat, no nesting
// exposed in that UI). 'copy_root'/'copy_client' are the one system-managed
// exception: the Copywriter's "Copy" folder and its one auto-created child
// per brand kit — the only nesting this table supports, and never user-set.
export const folderKind = pgEnum("folder_kind", ["custom", "copy_root", "copy_client"]);

// Organizes the Library (e.g. "Zone Club") — one flat level for user-created
// ('custom') folders, same simplicity tier as tags rather than the
// space/folder/list hierarchy. parentFolderId/kind/brandKitId exist solely
// for the Copywriter's auto-provisioned "Copy" > brand-kit hierarchy (see
// lib/copy-library.ts) — never set by the plain "New folder" UI.
export const imageFolders = pgTable(
  "image_folders",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentFolderId: uuid("parent_folder_id").references((): AnyPgColumn => imageFolders.id, {
      onDelete: "cascade",
    }),
    kind: folderKind("kind").notNull().default("custom"),
    // Set only on 'copy_client' folders, for direct lookup without a name
    // string match. onDelete "set null" rather than cascade: if the brand
    // kit is later deleted, the folder (and whatever copy is saved in it)
    // stays around instead of silently vanishing.
    brandKitId: uuid("brand_kit_id").references((): AnyPgColumn => brandSettings.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("image_folders_workspace_id_idx").on(table.workspaceId),
    index("image_folders_parent_folder_id_idx").on(table.parentFolderId),
    // At most one root "Copy" folder per workspace, and at most one child
    // folder per brand kit — both enforced at the DB level so a race between
    // two concurrent saves can't create duplicates (same reasoning as
    // brain_conversations' partial unique indexes).
    uniqueIndex("image_folders_copy_root_uniq")
      .on(table.workspaceId)
      .where(sql`${table.kind} = 'copy_root' and ${table.deletedAt} is null`),
    uniqueIndex("image_folders_copy_client_uniq")
      .on(table.workspaceId, table.brandKitId)
      .where(sql`${table.kind} = 'copy_client' and ${table.deletedAt} is null`),
  ],
);

// `imageAssets.currentVersionId` <-> `imageVersions.assetId` is a genuine
// circular FK between the two tables (DATA_MODEL.md: current_version_id
// "set after first version"). Both `.references()` callbacks below are
// lazy — Drizzle only invokes them once the whole module has finished
// evaluating — so each can name the other `const` even though one is
// declared textually below the other, the same pattern tasks.ts already
// uses for its own self-referencing parentTaskId.
export const imageAssets = pgTable(
  "image_assets",
  {
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
    // Unset = unfiled, shown in the Library's "All" view but no specific
    // folder. Deleting a folder unfiles its assets rather than cascading —
    // a folder is organization, not ownership (see imageFolder.delete).
    folderId: uuid("folder_id").references(() => imageFolders.id, { onDelete: "set null" }),
    altText: text("alt_text"),
    tagsJson: jsonb("tags_json").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("image_assets_workspace_id_idx").on(table.workspaceId),
    index("image_assets_folder_id_idx").on(table.folderId),
  ],
);

export const imageVersions = pgTable(
  "image_versions",
  {
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
  },
  (table) => [index("image_versions_asset_id_idx").on(table.assetId)],
);

// Append-only metering log (no deletedAt/updatedAt — same shape as
// `activity`). CLAUDE.md hard rule: "Every AI call writes an ai_usage row."
export const aiUsage = pgTable(
  "ai_usage",
  {
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
  },
  // Dashboard AI-usage-cost widget queries by workspaceId + a date range.
  (table) => [index("ai_usage_workspace_id_idx").on(table.workspaceId)],
);

// DATA_MODEL.md: "One brain_conversation per context (task, doc, channel, or
// global)". M2.2 only ever creates 'task'/'global' conversations (Docs is
// M4.1, Chat is M4.3 — no UI surface exists yet for those contexts), but the
// enum matches the full spec now rather than needing a migration later.
// `contextId` is null for 'global'. Conversations are scoped per-user (see
// PROGRESS.md M2.2 decisions), found-or-created by the API layer.
//
// **Revised from M2.2's original call.** M2.2 judged a race producing two
// rows here "rare" and not worth a partial unique index. It isn't rare:
// React StrictMode double-invokes the mount effect that fires
// getOrCreateConversation, so two concurrent SELECT-then-INSERT calls
// reliably both miss the not-yet-committed row and both insert — a
// duplicate conversation on effectively every first-open. Since
// findFirst() has no orderBy, a later getOrCreateConversation call can then
// non-deterministically return the *other*, message-less duplicate,
// silently orphaning the conversation the user was actually in (found via
// PROGRESS.md M3.4's CI investigation). These two partial unique indexes
// are the real backstop; the API layer pairs them with
// insert(...).onConflictDoNothing().
export const brainConversations = pgTable(
  "brain_conversations",
  {
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
    // Optional: when set, this conversation's system prompt includes the
    // kit's palette/tone/guidelines (see worker.ts's buildSystemPrompt call)
    // — same "explicit choice, not auto-resolved from space" model the
    // Generate panel's brandKitId override uses.
    brandKitId: uuid("brand_kit_id").references((): AnyPgColumn => brandSettings.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("brain_conversations_task_uniq")
      .on(table.workspaceId, table.contextId, table.createdBy)
      .where(sql`${table.contextType} != 'global'`),
    uniqueIndex("brain_conversations_global_uniq")
      .on(table.workspaceId, table.createdBy)
      .where(sql`${table.contextType} = 'global'`),
  ],
);

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

// Many rows per workspace ("brand kits" — e.g. one per client). Palette/
// tone/guidelines feed Generation UX (M2.4) and Brain system context.
// logo_asset_id is optional and may point at a Brain image_asset used as
// the brand mark. is_default marks the workspace's fallback kit, used
// whenever a space has no brand_kit_id of its own (see spaces table).
export const brandSettings = pgTable("brand_settings", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  isDefault: boolean("is_default").notNull().default(false),
  paletteJson: jsonb("palette_json").$type<string[]>().notNull().default([]),
  tone: text("tone"),
  logoAssetId: uuid("logo_asset_id").references((): AnyPgColumn => imageAssets.id, {
    onDelete: "set null",
  }),
  guidelines: text("guidelines"),
  // M2.7: workspace default ImageEngine ("gemini" | "openai"). Stored as
  // text rather than pgEnum so adding adapters later doesn't need an enum
  // migration; validated at the API boundary via IMAGE_PROVIDERS.
  imageProvider: text("image_provider").notNull().default("gemini"),
  // Copywriter fields (this kit doubling as a "client" brand profile) —
  // fonts has no equivalent elsewhere on this table; defaultCopyLanguage
  // just pre-fills the language picker when generating copy for this kit.
  fonts: text("fonts"),
  defaultCopyLanguage: copyLanguage("default_copy_language").notNull().default("sq"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
