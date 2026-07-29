import { db, schema } from "@canvas/db";
import {
  approveCopyVariantSchema,
  deleteCopyGenerationSchema,
  deleteLibraryCopyItemSchema,
  generateCopySchema,
  getCopyGenerationSchema,
  listCopyGenerationsSchema,
  listLibraryCopyItemsSchema,
  refineCopySchema,
  saveCopyToLibrarySchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { AiQuotaError, assertAiQuota } from "../../lib/ai-quota";
import { resolveAiReferences } from "../../lib/ai-references";
import { assertCan } from "../../lib/permissions";
import { publishCopyGenerationJob } from "../../lib/copy-generation-realtime";
import { ensureCopyLibraryFolder } from "../../lib/copy-library";
import { copywriterQueue } from "../../queues/copywriter-queue";
import { protectedProcedure, router } from "../trpc";

async function requireGeneration(generationId: string) {
  const generation = await db.query.copyGenerations.findFirst({
    where: and(
      eq(schema.copyGenerations.id, generationId),
      isNull(schema.copyGenerations.deletedAt),
    ),
  });
  if (!generation) throw new TRPCError({ code: "NOT_FOUND" });
  return generation;
}

async function requireBrandKit(brandKitId: string) {
  const kit = await db.query.brandSettings.findFirst({
    where: eq(schema.brandSettings.id, brandKitId),
  });
  if (!kit) throw new TRPCError({ code: "NOT_FOUND" });
  return kit;
}

async function assertAiQuotaOrThrow(userId: string) {
  try {
    // Shares Brain's Claude-call quota tier — same underlying cost driver
    // (Claude tokens), distinct from the image-engine "generate" tier.
    await assertAiQuota(userId, "brain");
  } catch (err) {
    if (err instanceof AiQuotaError) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: err.message });
    }
    throw err;
  }
}

export const copywriterRouter = router({
  listMine: protectedProcedure.input(listCopyGenerationsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "copyGeneration:create");
    return db.query.copyGenerations.findMany({
      where: and(
        eq(schema.copyGenerations.workspaceId, input.workspaceId),
        eq(schema.copyGenerations.createdBy, ctx.user.id),
        isNull(schema.copyGenerations.deletedAt),
        ...(input.brandKitId ? [eq(schema.copyGenerations.brandKitId, input.brandKitId)] : []),
      ),
      orderBy: desc(schema.copyGenerations.createdAt),
      limit: 100,
    });
  }),

  get: protectedProcedure.input(getCopyGenerationSchema).query(async ({ ctx, input }) => {
    const generation = await requireGeneration(input.generationId);
    await assertCan(ctx.user, generation.workspaceId, "copyGeneration:create");
    return generation;
  }),

  generate: protectedProcedure.input(generateCopySchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "copyGeneration:create");
    await assertAiQuotaOrThrow(ctx.user.id);

    const brandKit = await requireBrandKit(input.brandKitId);
    if (brandKit.workspaceId !== input.workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Brand kit belongs to another workspace",
      });
    }

    // Same reference-attachment ownership check Brain's messages.send already
    // does — without it, frameAttachmentIds from another workspace would be
    // fetched and described by the AI (a cross-workspace data leak).
    await resolveAiReferences(input.workspaceId, input.frameAttachmentIds);

    const [generation] = await db
      .insert(schema.copyGenerations)
      .values({
        workspaceId: input.workspaceId,
        brandKitId: input.brandKitId,
        createdBy: ctx.user.id,
        sourceAttachmentId: input.frameAttachmentIds[0],
        copyType: input.copyType,
        length: input.length,
        language: input.language,
        status: "pending",
      })
      .returning();
    if (!generation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "copy_generation",
      generation.id,
      "copy_generation.requested",
    );

    await copywriterQueue.add("generate", {
      kind: "generate",
      generationId: generation.id,
      workspaceId: input.workspaceId,
      brandKitId: input.brandKitId,
      userId: ctx.user.id,
      copyType: input.copyType,
      length: input.length,
      language: input.language,
      frameAttachmentIds: input.frameAttachmentIds,
      extra: input.extra,
    });

    await publishCopyGenerationJob(generation.id, {
      status: "queued",
      generationId: generation.id,
    });

    return generation;
  }),

  refine: protectedProcedure.input(refineCopySchema).mutation(async ({ ctx, input }) => {
    const generation = await requireGeneration(input.generationId);
    await assertCan(ctx.user, generation.workspaceId, "copyGeneration:create");
    await assertAiQuotaOrThrow(ctx.user.id);

    if (!generation.variantsJson || !generation.variantsJson[input.variantIndex]) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Variant index out of range" });
    }

    // Same cross-workspace check as generate() above.
    await resolveAiReferences(generation.workspaceId, input.frameAttachmentIds);

    await copywriterQueue.add("refine", {
      kind: "refine",
      generationId: generation.id,
      workspaceId: generation.workspaceId,
      brandKitId: generation.brandKitId,
      userId: ctx.user.id,
      variantIndex: input.variantIndex,
      instruction: input.instruction,
      frameAttachmentIds: input.frameAttachmentIds,
    });

    await publishCopyGenerationJob(generation.id, {
      status: "queued",
      generationId: generation.id,
    });

    return { ok: true as const };
  }),

  approve: protectedProcedure.input(approveCopyVariantSchema).mutation(async ({ ctx, input }) => {
    const generation = await requireGeneration(input.generationId);
    // Shared curation, not owner-only: any member who can generate copy can
    // mark a variant as real brand voice — the flywheel benefits from
    // everyone's judgment, not just whoever happened to run the generation.
    await assertCan(ctx.user, generation.workspaceId, "copyGeneration:create");

    const [updated] = await db
      .update(schema.copyGenerations)
      .set({ approvedJson: input.approved, updatedAt: new Date() })
      .where(eq(schema.copyGenerations.id, input.generationId))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return updated;
  }),

  delete: protectedProcedure.input(deleteCopyGenerationSchema).mutation(async ({ ctx, input }) => {
    const generation = await requireGeneration(input.generationId);
    await assertCan(ctx.user, generation.workspaceId, "copyGeneration:create");
    // Own-only, unlike approve — deleting someone else's generation is
    // destructive, not shared curation.
    if (generation.createdBy !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db
      .update(schema.copyGenerations)
      .set({ deletedAt: new Date() })
      .where(eq(schema.copyGenerations.id, input.generationId));

    await logActivity(
      generation.workspaceId,
      ctx.user.id,
      "copy_generation",
      generation.id,
      "copy_generation.deleted",
    );
    return { ok: true as const };
  }),

  // Saves one chosen variant into Library > Copy > <brand kit> — distinct
  // from `approve` (which feeds the brand-voice flywheel and never leaves
  // copy_generations). Denormalizes the variant's own fields onto the new
  // row so it survives independently of the generation it came from.
  saveToLibrary: protectedProcedure
    .input(saveCopyToLibrarySchema)
    .mutation(async ({ ctx, input }) => {
      const generation = await requireGeneration(input.generationId);
      await assertCan(ctx.user, generation.workspaceId, "copyGeneration:create");

      const variant = generation.variantsJson?.[input.variantIndex];
      if (!variant) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Variant index out of range" });
      }

      const brandKit = await requireBrandKit(generation.brandKitId);
      const folderId = await ensureCopyLibraryFolder(
        generation.workspaceId,
        brandKit.id,
        brandKit.name,
        ctx.user.id,
      );

      const [item] = await db
        .insert(schema.libraryCopyItems)
        .values({
          workspaceId: generation.workspaceId,
          folderId,
          brandKitId: brandKit.id,
          sourceGenerationId: generation.id,
          thumbnailAttachmentId: generation.sourceAttachmentId,
          label: variant.label,
          copyType: generation.copyType,
          length: generation.length,
          language: generation.language,
          text: variant.text ?? null,
          designCopy: variant.design_copy ?? null,
          caption: variant.caption ?? null,
          createdBy: ctx.user.id,
        })
        .returning();
      if (!item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(
        generation.workspaceId,
        ctx.user.id,
        "library_copy_item",
        item.id,
        "library_copy_item.saved",
      );

      return { ...item, brandKitName: brandKit.name };
    }),

  listLibraryItems: protectedProcedure
    .input(listLibraryCopyItemsSchema)
    .query(async ({ ctx, input }) => {
      const folder = await db.query.imageFolders.findFirst({
        where: and(
          eq(schema.imageFolders.id, input.folderId),
          isNull(schema.imageFolders.deletedAt),
        ),
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.user, folder.workspaceId, "libraryCopyItem:view");

      return db.query.libraryCopyItems.findMany({
        where: and(
          eq(schema.libraryCopyItems.folderId, input.folderId),
          isNull(schema.libraryCopyItems.deletedAt),
        ),
        orderBy: desc(schema.libraryCopyItems.createdAt),
      });
    }),

  deleteLibraryItem: protectedProcedure
    .input(deleteLibraryCopyItemSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await db.query.libraryCopyItems.findFirst({
        where: and(
          eq(schema.libraryCopyItems.id, input.itemId),
          isNull(schema.libraryCopyItems.deletedAt),
        ),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.user, item.workspaceId, "libraryCopyItem:delete");

      await db
        .update(schema.libraryCopyItems)
        .set({ deletedAt: new Date() })
        .where(eq(schema.libraryCopyItems.id, input.itemId));

      await logActivity(
        item.workspaceId,
        ctx.user.id,
        "library_copy_item",
        item.id,
        "library_copy_item.deleted",
      );
      return { ok: true as const };
    }),
});
