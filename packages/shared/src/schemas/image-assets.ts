import { z } from "zod";
import { ASPECT_PRESETS } from "../aspect-presets";

export const generateImageAssetSchema = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(2000),
  size: z.enum(ASPECT_PRESETS),
});

export const getImageAssetSchema = z.object({
  assetId: z.string().uuid(),
});
