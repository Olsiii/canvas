import { z } from "zod";
import { IMAGE_PROVIDERS } from "../image-providers";
import { COPY_LANGUAGES } from "./copywriter";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected a #RRGGBB hex color");
const kitName = z.string().trim().min(1).max(100);
const kitFonts = z.string().trim().max(200).nullable().optional();
const kitDefaultCopyLanguage = z.enum(COPY_LANGUAGES).optional();

export const listBrandKitsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const getBrandKitSchema = z.object({
  brandKitId: z.string().uuid(),
});

// brandKitId is an explicit override (picked directly in Generate/Brain);
// spaceId, when provided and no explicit override is set, prefers that
// space's own kit before falling back to the workspace's default kit.
export const getEffectiveBrandKitSchema = z.object({
  workspaceId: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
});

export const createBrandKitSchema = z.object({
  workspaceId: z.string().uuid(),
  name: kitName,
  palette: z.array(hexColor).max(8).default([]),
  tone: z.string().trim().max(200).nullable().optional(),
  guidelines: z.string().trim().max(4000).nullable().optional(),
  logoAssetId: z.string().uuid().nullable().optional(),
  // Server-side provider key; UI shows IMAGE_PROVIDER_LABELS, never vendor names.
  imageProvider: z.enum(IMAGE_PROVIDERS).optional(),
  // Copywriter fields — this kit doubling as a "client" brand profile.
  fonts: kitFonts,
  defaultCopyLanguage: kitDefaultCopyLanguage,
});

export const updateBrandKitSchema = z.object({
  brandKitId: z.string().uuid(),
  name: kitName.optional(),
  palette: z.array(hexColor).max(8).optional(),
  tone: z.string().trim().max(200).nullable().optional(),
  guidelines: z.string().trim().max(4000).nullable().optional(),
  logoAssetId: z.string().uuid().nullable().optional(),
  imageProvider: z.enum(IMAGE_PROVIDERS).optional(),
  fonts: kitFonts,
  defaultCopyLanguage: kitDefaultCopyLanguage,
});

export const deleteBrandKitSchema = z.object({
  brandKitId: z.string().uuid(),
});

export const setDefaultBrandKitSchema = z.object({
  workspaceId: z.string().uuid(),
  brandKitId: z.string().uuid(),
});
