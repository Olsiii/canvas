import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { tasks } from "./tasks";

// M5.6 integrations: GitHub PR links. Not in DATA_MODEL.md's compact
// listing — scoped only by taskId (no workspaceId column), same shape as
// M1.6's checklists: every query reaches it through workspaceIdForTask,
// there's no workspace-wide "list all PR links" view to justify the extra
// column. "unknown" covers a PR the GitHub API call failed to resolve
// (private repo with no token configured, deleted PR, rate-limited) —
// the link is still saved, just without a live status.
export const taskPrLinkState = pgEnum("task_pr_link_state", [
  "open",
  "closed",
  "merged",
  "unknown",
]);

export const taskPrLinks = pgTable("task_pr_links", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  // Cached from the GitHub API at link time / on refresh — see
  // github-client.ts. Null title means the fetch never succeeded.
  title: text("title"),
  state: taskPrLinkState("state").notNull().default("unknown"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
