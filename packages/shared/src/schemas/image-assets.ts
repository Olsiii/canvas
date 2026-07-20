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
  // When true, the API loads brand_settings.palette_json and passes it as
  // brandPalette on the image job.
  useBrandPalette: z.boolean().default(false),
});

export const getImageAssetSchema = z.object({
  assetId: z.string().uuid(),
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
