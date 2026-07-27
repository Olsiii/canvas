import {
  type AnyPgColumn,
  boolean,
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
import { workspaces } from "./workspaces";

// DATA_MODEL.md: channels (id, workspace_id fk, name, is_private bool)
export const channels = pgTable(
  "channels",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("channels_workspace_id_idx").on(table.workspaceId)],
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
