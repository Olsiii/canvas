import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { attachments } from "./attachments";
import { users } from "./auth";
import { brandSettings, copyLanguage, imageFolders } from "./image-brain";
import { workspaces } from "./workspaces";

export const copyLength = pgEnum("copy_length", ["short", "medium", "long"]);
export const copyGenerationStatus = pgEnum("copy_generation_status", [
  "pending",
  "completed",
  "failed",
]);

export type CopyVariant = {
  label: string;
  text?: string;
  design_copy?: string;
  caption?: string;
};

// Ported from a standalone internal tool (trekuartista-copy) — reuses
// brand_settings as the "client" brand profile (see its fonts/
// defaultCopyLanguage fields) rather than a parallel clients entity. A
// generation starts 'pending' (the tRPC mutation just inserts the row and
// enqueues the AI call — CLAUDE.md: AI calls run in BullMQ workers, never
// request handlers) and the worker fills designRead/variantsJson/status.
export const copyGenerations = pgTable(
  "copy_generations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandKitId: uuid("brand_kit_id")
      .notNull()
      .references(() => brandSettings.id, { onDelete: "cascade" }),
    // Attribution only — approve/delete gating uses this, not a workspace
    // permission tier, but losing the user shouldn't delete the generation.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // The representative frame (or the single image) — set via the same
    // attachment upload endpoint reference-image attach already uses.
    // Losing the attachment just drops the thumbnail, not the generation.
    sourceAttachmentId: uuid("source_attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    copyType: text("copy_type").notNull(),
    length: copyLength("length").notNull(),
    language: copyLanguage("language").notNull(),
    status: copyGenerationStatus("status").notNull().default("pending"),
    designRead: text("design_read"),
    variantsJson: jsonb("variants_json").$type<CopyVariant[]>(),
    // The brand-voice flywheel: approved variants feed back as few-shot
    // examples on the next generation for this brand kit (see
    // lib/copywriter.ts's fetchApprovedExamples).
    approvedJson: jsonb("approved_json").$type<CopyVariant[]>().notNull().default([]),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("copy_generations_brand_kit_id_idx").on(table.brandKitId),
    index("copy_generations_workspace_id_idx").on(table.workspaceId),
  ],
);

// A single saved copy variant, filed under Library > Copy > <brand kit>
// (see lib/copy-library.ts). Deliberately denormalized from copy_generations
// (its own label/text/design_copy/caption columns, not a foreign key into
// variants_json) so a saved item survives independently of the generation
// it came from — the user can delete generations from History without
// touching anything they've explicitly saved to the Library.
export const libraryCopyItems = pgTable(
  "library_copy_items",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Unfiled (not deleted) if its folder is later removed — organization,
    // not ownership, same precedent as image_assets.folderId.
    folderId: uuid("folder_id").references(() => imageFolders.id, { onDelete: "set null" }),
    brandKitId: uuid("brand_kit_id").references(() => brandSettings.id, { onDelete: "set null" }),
    sourceGenerationId: uuid("source_generation_id").references(() => copyGenerations.id, {
      onDelete: "set null",
    }),
    thumbnailAttachmentId: uuid("thumbnail_attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    copyType: text("copy_type").notNull(),
    length: copyLength("length").notNull(),
    language: copyLanguage("language").notNull(),
    text: text("text"),
    designCopy: text("design_copy"),
    caption: text("caption"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("library_copy_items_folder_id_idx").on(table.folderId),
    index("library_copy_items_workspace_id_idx").on(table.workspaceId),
  ],
);
