import { z } from "zod";

// Ported from the standalone trekuartista-copy tool — see PROGRESS.md.
export const COPY_LENGTHS = ["short", "medium", "long"] as const;
export type CopyLength = (typeof COPY_LENGTHS)[number];

export const COPY_LANGUAGES = ["sq", "en", "both"] as const;
export type CopyLanguage = (typeof COPY_LANGUAGES)[number];

export const COPY_TYPES = [
  "Design copy + caption",
  "Social caption",
  "Ad headline",
  "Poster copy",
  "Story text",
  "Product description",
] as const;

export const copyVariantSchema = z.object({
  label: z.string(),
  text: z.string().optional(),
  design_copy: z.string().optional(),
  caption: z.string().optional(),
});

export const generateCopySchema = z.object({
  workspaceId: z.string().uuid(),
  brandKitId: z.string().uuid(),
  copyType: z.string().trim().min(1).max(60),
  length: z.enum(COPY_LENGTHS),
  language: z.enum(COPY_LANGUAGES),
  // One image, or up to 5 frames extracted from a short video — the first
  // becomes the generation's thumbnail (see worker.ts's copywriter job).
  frameAttachmentIds: z.array(z.string().uuid()).min(1).max(5),
  extra: z.string().trim().max(1000).optional(),
});

export const refineCopySchema = z.object({
  generationId: z.string().uuid(),
  variantIndex: z.number().int().min(0).max(2),
  instruction: z.string().trim().min(1).max(500),
  // Re-sent from the client's local upload state — see CopywriterJobData's
  // "refine" branch (apps/api/src/queues/copywriter-queue.ts) for why.
  frameAttachmentIds: z.array(z.string().uuid()).min(1).max(5),
});

export const listCopyGenerationsSchema = z.object({
  workspaceId: z.string().uuid(),
  brandKitId: z.string().uuid().optional(),
});

export const getCopyGenerationSchema = z.object({
  generationId: z.string().uuid(),
});

export const approveCopyVariantSchema = z.object({
  generationId: z.string().uuid(),
  approved: z.array(copyVariantSchema),
});

export const deleteCopyGenerationSchema = z.object({
  generationId: z.string().uuid(),
});

export const saveCopyToLibrarySchema = z.object({
  generationId: z.string().uuid(),
  variantIndex: z.number().int().min(0).max(2),
});

export const listLibraryCopyItemsSchema = z.object({
  folderId: z.string().uuid(),
});

export const deleteLibraryCopyItemSchema = z.object({
  itemId: z.string().uuid(),
});
