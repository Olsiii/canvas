import { z } from "zod";
import { ASPECT_PRESETS } from "../aspect-presets";
import { STYLE_PRESETS } from "../style-presets";

export const generateImageAssetSchema = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(2000),
  size: z.enum(ASPECT_PRESETS).default("square"),
  style: z.enum(STYLE_PRESETS).optional(),
  // How many sibling variants to generate (ARCHITECTURE.md n-variants grid).
  n: z.number().int().min(1).max(4).default(1),
  // When true, the API resolves the effective brand kit (spaceId's own kit,
  // else the workspace default) and passes its palette as brandPalette on
  // the image job.
  useBrandPalette: z.boolean().default(false),
  // The space the generation was triggered from, if any — lets the effective
  // brand kit resolution prefer that space's own kit over the workspace default.
  spaceId: z.string().uuid().optional(),
  // An explicit brand kit choice, picked directly in the Generate panel —
  // takes priority over spaceId/workspace-default resolution when set.
  brandKitId: z.string().uuid().optional(),
  // Where in the Library to file the result — unset = unfiled, same "choose
  // a destination up front" idea as brandKitId above.
  folderId: z.string().uuid().optional(),
  // Optional reference media (images / files / videos) uploaded via
  // POST /ai-references/upload — images also drive image-to-image style
  // generation when the engine supports it; other types are appended as
  // context on the prompt.
  referenceAttachmentIds: z.array(z.string().uuid()).max(8).default([]),
});

export const getImageAssetSchema = z.object({
  assetId: z.string().uuid(),
});

// Phase 6: backs the visual-search image picker — no gallery view existed
// before this (every other consumer fetches one asset at a time via
// getImageAssetSchema).
export const listImageAssetsSchema = z.object({
  workspaceId: z.string().uuid(),
});

// Backs the Library page: every image_asset in the workspace (generated or
// uploaded), independent of whether it's attached to any task — the point
// being that generating/uploading already saves it in Canvas, this is just
// the browsing surface for that.
export const IMAGE_LIBRARY_ORIGINS = ["all", "upload", "generation"] as const;
export type ImageLibraryOrigin = (typeof IMAGE_LIBRARY_ORIGINS)[number];

export const listImageLibrarySchema = z.object({
  workspaceId: z.string().uuid(),
  search: z.string().trim().max(200).optional(),
  origin: z.enum(IMAGE_LIBRARY_ORIGINS).default("all"),
  // Unset = every asset regardless of folder (including unfiled ones) — a
  // specific id narrows to just that folder. There's no "unfiled only"
  // filter; "All" plus visually scanning covers that case without a third
  // axis of filtering.
  folderId: z.string().uuid().optional(),
  // Keyset pagination on the asset id — UUIDv7 ids sort chronologically, so
  // this needs no separate createdAt cursor column.
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(60),
});

export const deleteImageAssetSchema = z.object({
  assetId: z.string().uuid(),
});

export const moveImageAssetSchema = z.object({
  assetId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});

export const createImageFolderSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

export const listImageFoldersSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const deleteImageFolderSchema = z.object({
  folderId: z.string().uuid(),
});

export const promoteImageVersionSchema = z.object({
  assetId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const attachImageAssetToTaskSchema = z.object({
  assetId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const editImageAssetSchema = z.object({
  assetId: z.string().uuid(),
  parentVersionId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(2000),
  size: z.enum(ASPECT_PRESETS).optional(),
});
