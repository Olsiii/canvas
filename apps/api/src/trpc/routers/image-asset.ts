import { db, schema } from "@canvas/db";
import { generateImageAssetSchema, getImageAssetSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { imageQueue } from "../../queues/image-queue";
import { protectedProcedure, router } from "../trpc";

// No UI calls this yet — Generation UX (prompt box, aspect/style pickers)
// is M2.4's job, Brain chat orchestration is M2.2/M2.3's. This is the
// minimal real trigger/read boundary M2.1's "interface + adapter behind a
// BullMQ worker" scope needs to be end-to-end verifiable today. See
// PROGRESS.md (M2.1 decisions).
export const imageAssetRouter = router({
  get: protectedProcedure.input(getImageAssetSchema).query(async ({ ctx, input }) => {
    const asset = await db.query.imageAssets.findFirst({
      where: eq(schema.imageAssets.id, input.assetId),
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

    // The actual Gemini call (mocked for now — see image-engine/) happens
    // in the worker process, never here. CLAUDE.md hard rule: "All external
    // AI calls... run in BullMQ workers — never in request handlers."
    await imageQueue.add("generate", {
      kind: "generate",
      assetId: asset.id,
      workspaceId: input.workspaceId,
      userId: ctx.user.id,
      prompt: input.prompt,
      size: input.size,
    });

    return asset;
  }),
});
