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
