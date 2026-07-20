import { db, schema } from "@canvas/db";
import {
  attachImageAssetToTaskSchema,
  editImageAssetSchema,
  generateImageAssetSchema,
  getImageAssetSchema,
  promoteImageVersionSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { publishImageAssetJob } from "../../lib/image-asset-realtime";
import { assertCan } from "../../lib/permissions";
import { workspaceIdForTask } from "../../lib/task-queries";
import { imageQueue } from "../../queues/image-queue";
import { protectedProcedure, router } from "../trpc";

export const imageAssetRouter = router({
  get: protectedProcedure.input(getImageAssetSchema).query(async ({ ctx, input }) => {
    const asset = await db.query.imageAssets.findFirst({
      where: and(eq(schema.imageAssets.id, input.assetId), isNull(schema.imageAssets.deletedAt)),
    });
    if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, asset.workspaceId, "imageAsset:view");

    const versions = await db.query.imageVersions.findMany({
      where: eq(schema.imageVersions.assetId, asset.id),
      orderBy: asc(schema.imageVersions.createdAt),
    });
    return { ...asset, versions };
  }),

  generate: protectedProcedure.input(generateImageAssetSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "imageAsset:create");

    let brandPalette: string[] | undefined;
    if (input.useBrandPalette) {
      const brand = await db.query.brandSettings.findFirst({
        where: eq(schema.brandSettings.workspaceId, input.workspaceId),
      });
      if (brand?.paletteJson?.length) brandPalette = brand.paletteJson;
    }

    const [asset] = await db
      .insert(schema.imageAssets)
      .values({ workspaceId: input.workspaceId, createdBy: ctx.user.id, origin: "generation" })
      .returning();
    if (!asset) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "image_asset",
      asset.id,
      "image_asset.generate_requested",
    );

    await imageQueue.add("generate", {
      kind: "generate",
      assetId: asset.id,
      workspaceId: input.workspaceId,
      userId: ctx.user.id,
      prompt: input.prompt,
      size: input.size,
      style: input.style,
      brandPalette,
      n: input.n,
    });

    await publishImageAssetJob(asset.id, {
      status: "queued",
      assetId: asset.id,
      kind: "generate",
    });

    return asset;
  }),

  edit: protectedProcedure.input(editImageAssetSchema).mutation(async ({ ctx, input }) => {
    const asset = await db.query.imageAssets.findFirst({
      where: and(eq(schema.imageAssets.id, input.assetId), isNull(schema.imageAssets.deletedAt)),
    });
    if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, asset.workspaceId, "imageAsset:create");

    const parent = await db.query.imageVersions.findFirst({
      where: and(
        eq(schema.imageVersions.id, input.parentVersionId),
        eq(schema.imageVersions.assetId, asset.id),
      ),
    });
    if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent version not found" });

    await logActivity(
      asset.workspaceId,
      ctx.user.id,
      "image_asset",
      asset.id,
      "image_asset.edit_requested",
      { parentVersionId: parent.id },
    );

    await imageQueue.add("edit", {
      kind: "edit",
      assetId: asset.id,
      workspaceId: asset.workspaceId,
      userId: ctx.user.id,
      parentVersionId: parent.id,
      instruction: input.instruction,
      size: input.size,
    });

    await publishImageAssetJob(asset.id, {
      status: "queued",
      assetId: asset.id,
      kind: "edit",
    });

    return asset;
  }),

  promoteVersion: protectedProcedure
    .input(promoteImageVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const asset = await db.query.imageAssets.findFirst({
        where: and(eq(schema.imageAssets.id, input.assetId), isNull(schema.imageAssets.deletedAt)),
      });
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.user, asset.workspaceId, "imageAsset:create");

      const version = await db.query.imageVersions.findFirst({
        where: and(
          eq(schema.imageVersions.id, input.versionId),
          eq(schema.imageVersions.assetId, asset.id),
        ),
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db
        .update(schema.imageAssets)
        .set({ currentVersionId: version.id, updatedAt: new Date() })
        .where(eq(schema.imageAssets.id, asset.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(
        asset.workspaceId,
        ctx.user.id,
        "image_asset",
        asset.id,
        "image_asset.version_promoted",
        { versionId: version.id },
      );

      return updated;
    }),

  attachToTask: protectedProcedure
    .input(attachImageAssetToTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const asset = await db.query.imageAssets.findFirst({
        where: and(eq(schema.imageAssets.id, input.assetId), isNull(schema.imageAssets.deletedAt)),
      });
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.user, asset.workspaceId, "attachment:create");

      const taskWorkspaceId = await workspaceIdForTask(input.taskId);
      if (taskWorkspaceId !== asset.workspaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Task does not belong to this workspace",
        });
      }
      if (!asset.currentVersionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image has no current version yet" });
      }

      const version = await db.query.imageVersions.findFirst({
        where: eq(schema.imageVersions.id, asset.currentVersionId),
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      const [attachment] = await db
        .insert(schema.attachments)
        .values({
          workspaceId: asset.workspaceId,
          taskId: input.taskId,
          uploaderId: ctx.user.id,
          imageAssetId: asset.id,
          fileKey: version.fileKey,
          fileName: `brain-${asset.id.slice(0, 8)}.png`,
          mime: "image/png",
          sizeBytes: 0,
          thumbKey: version.thumbKey,
          blurhash: version.blurhash,
          width: version.width,
          height: version.height,
        })
        .returning();
      if (!attachment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(
        asset.workspaceId,
        ctx.user.id,
        "attachment",
        attachment.id,
        "attachment.created",
        { taskId: input.taskId, imageAssetId: asset.id, source: "generation_ux" },
      );

      return attachment;
    }),
});
