import { index, pgTable, text, timestamp, unique, uuid, vector } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { workspaces } from "./workspaces";

// Phase 6: semantic + visual search. Gemini's text-embedding-004 dimension
// (see embedding-engine/types.ts) — picking one fixed dimension/space for
// the whole system, not per-workspace-configurable like ImageEngine,
// because two different embedding models produce vectors that aren't
// comparable to each other at all (not just a dimension mismatch); a
// workspace can't mix providers within one similarity search.
export const EMBEDDING_DIMENSIONS = 768;

// One row per (entityType, entityId) — same polymorphic-target convention
// `activity`/`notifications` already use, rather than a separate table per
// entity kind. Recomputed in place on update (no version history: unlike
// image_versions, an embedding has no independent meaning once its source
// text/tags change — the old vector is just wrong, not a prior revision
// worth keeping).
export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    model: text("model").notNull(),
    vector: vector("vector", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.entityType, table.entityId),
    // search.ts's nearest-neighbor queries filter by workspaceId +
    // entityType before ordering by cosineDistance — the unique
    // constraint above doesn't serve that (entityType isn't its leading
    // column, and it has no workspaceId at all).
    index("embeddings_workspace_id_entity_type_idx").on(table.workspaceId, table.entityType),
  ],
);
