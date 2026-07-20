import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { comments } from "./comments";
import { tasks } from "./tasks";
import { workspaces } from "./workspaces";

// DATA_MODEL.md's `attachments` row has no `deleted_at` (unlike `tasks`/
// `comments`) — hard delete, same precedent as M1.6's checklists/M1.8's
// task_tags. `thumbKey`/`blurhash`/`width`/`height` are additive beyond
// DATA_MODEL.md's literal row: CLAUDE.md's UI hard rule ("blurhash
// placeholder -> thumb -> full-res") needs somewhere to live, and the
// Phase-2 `image_versions` table that would normally hold this doesn't
// exist yet. Nullable — only ever set when `mime` is an image type. Named
// to match `image_versions`' shape so a future Image Brain migration can
// reuse the convention. See PROGRESS.md (M1.9 decisions).
export const attachments = pgTable("attachments", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  thumbKey: text("thumb_key"),
  blurhash: text("blurhash"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
