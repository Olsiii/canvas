import { db, schema } from "@canvas/db";
import { getBrandSettingsSchema, upsertBrandSettingsSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

export const brandSettingsRouter = router({
  get: protectedProcedure.input(getBrandSettingsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "brandSettings:view");
    const row = await db.query.brandSettings.findFirst({
      where: eq(schema.brandSettings.workspaceId, input.workspaceId),
    });
    return (
      row ?? {
        id: null,
        workspaceId: input.workspaceId,
        paletteJson: [] as string[],
        tone: null,
        logoAssetId: null,
        guidelines: null,
      }
    );
  }),

  upsert: protectedProcedure.input(upsertBrandSettingsSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "brandSettings:update");

    const existing = await db.query.brandSettings.findFirst({
      where: eq(schema.brandSettings.workspaceId, input.workspaceId),
    });

    if (existing) {
      const [updated] = await db
        .update(schema.brandSettings)
        .set({
          paletteJson: input.palette,
          tone: input.tone === undefined ? existing.tone : input.tone,
          guidelines: input.guidelines === undefined ? existing.guidelines : input.guidelines,
          logoAssetId: input.logoAssetId === undefined ? existing.logoAssetId : input.logoAssetId,
          updatedAt: new Date(),
        })
        .where(eq(schema.brandSettings.id, existing.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await logActivity(
        input.workspaceId,
        ctx.user.id,
        "brand_settings",
        updated.id,
        "brand_settings.updated",
      );
      return updated;
    }

    const [created] = await db
      .insert(schema.brandSettings)
      .values({
        workspaceId: input.workspaceId,
        paletteJson: input.palette,
        tone: input.tone ?? null,
        guidelines: input.guidelines ?? null,
        logoAssetId: input.logoAssetId ?? null,
      })
      .returning();
    if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "brand_settings",
      created.id,
      "brand_settings.created",
    );
    return created;
  }),
});
