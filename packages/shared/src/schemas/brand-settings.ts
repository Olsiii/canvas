import { z } from "zod";

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
});
