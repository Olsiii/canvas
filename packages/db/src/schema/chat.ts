import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { workspaces } from "./workspaces";

// DATA_MODEL.md: channels (id, workspace_id fk, name null, is_private bool,
// is_dm bool, dm_key text null uniq per (workspace_id, dm_key) where is_dm).
// A DM is modeled as a channel row with isDm=true, isPrivate=true always,
// name=null (no user-given name), and dmKey = the two participants' user
// ids sorted+joined (see lib/dm-key.ts) — this reuses the entire
// messages/threading/realtime/attachment pipeline for free, since a DM is
// authorization-wise indistinguishable from an ordinary private channel
// with exactly 2 members. The partial unique index is what guarantees at
// most one DM channel per pair, same pattern as brainConversations' partial
// unique indexes in image-brain.ts.
export const channels = pgTable(
  "channels",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name"),
    isPrivate: boolean("is_private").notNull().default(false),
    isDm: boolean("is_dm").notNull().default(false),
    dmKey: text("dm_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("channels_workspace_id_idx").on(table.workspaceId),
    uniqueIndex("channels_dm_pair_uniq")
      .on(table.workspaceId, table.dmKey)
      .where(sql`${table.isDm} and ${table.dmKey} is not null`),
  ],
);

// DATA_MODEL.md: channel_members (channel_id fk, user_id fk, uniq pair).
// Only consulted for private channels — public channels are visible to
// every workspace member without a row here (same "no gate until it
// matters" shape as doc_task_links).
export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.userId] })],
);

// DATA_MODEL.md: messages (id, channel_id fk, author_id fk, parent_message_id
// fk null, body_json jsonb, deleted_at). Threading capped at depth 2, same
// rule and reasoning as comments.parentCommentId (see comment-thread.ts).
export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentMessageId: uuid("parent_message_id").references((): AnyPgColumn => messages.id, {
      onDelete: "cascade",
    }),
    bodyJson: jsonb("body_json").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("messages_channel_id_idx").on(table.channelId)],
);
