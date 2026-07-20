import { z } from "zod";
import { IMAGE_PROVIDERS } from "../image-providers";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected a #RRGGBB hex color");

export const getBrandSettingsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const upsertBrandSettingsSchema = z.object({
  workspaceId: z.string().uuid(),
  palette: z.array(hexColor).max(8).default([]),
  tone: z.string().trim().max(200).nullable().optional(),
  guidelines: z.string().trim().max(4000).nullable().optional(),
  logoAssetId: z.string().uuid().nullable().optional(),
  // Server-side provider key; UI shows IMAGE_PROVIDER_LABELS, never vendor names.
  imageProvider: z.enum(IMAGE_PROVIDERS).optional(),
});
