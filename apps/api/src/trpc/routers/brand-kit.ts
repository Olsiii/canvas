import { db, schema } from "@canvas/db";
import {
  createBrandKitSchema,
  DEFAULT_IMAGE_PROVIDER,
  deleteBrandKitSchema,
  getBrandKitSchema,
  getEffectiveBrandKitSchema,
  listBrandKitsSchema,
  setDefaultBrandKitSchema,
  updateBrandKitSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { resolveEffectiveBrandKit } from "../../lib/brand-kit";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

async function requireBrandKit(brandKitId: string) {
  const kit = await db.query.brandSettings.findFirst({
    where: eq(schema.brandSettings.id, brandKitId),
  });
  if (!kit) throw new TRPCError({ code: "NOT_FOUND" });
  return kit;
}

export const brandKitRouter = router({
  list: protectedProcedure.input(listBrandKitsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "brandSettings:view");
    return db.query.brandSettings.findMany({
      where: eq(schema.brandSettings.workspaceId, input.workspaceId),
      orderBy: (kits, { asc }) => [asc(kits.createdAt)],
    });
  }),

  get: protectedProcedure.input(getBrandKitSchema).query(async ({ ctx, input }) => {
    const kit = await requireBrandKit(input.brandKitId);
    await assertCan(ctx.user, kit.workspaceId, "brandSettings:view");
    return kit;
  }),

  // Resolves the kit that actually applies for a given context (space, if
  // given, else the workspace default) — returns null rather than a
  // placeholder row when nothing is configured yet, so callers can tell
  // "no kit" apart from "a kit with empty fields".
  getEffective: protectedProcedure
    .input(getEffectiveBrandKitSchema)
    .query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "brandSettings:view");
      return resolveEffectiveBrandKit(input);
    }),

  create: protectedProcedure.input(createBrandKitSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "brandSettings:update");

    // A workspace's first kit becomes its default automatically (matching
    // the old single-brand-config behavior); later kits need an explicit
    // "Make default".
    const existing = await db.query.brandSettings.findFirst({
      where: eq(schema.brandSettings.workspaceId, input.workspaceId),
    });

    const [created] = await db
      .insert(schema.brandSettings)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        isDefault: !existing,
        paletteJson: input.palette,
        tone: input.tone ?? null,
        guidelines: input.guidelines ?? null,
        logoAssetId: input.logoAssetId ?? null,
        imageProvider: input.imageProvider ?? DEFAULT_IMAGE_PROVIDER,
        fonts: input.fonts ?? null,
        ...(input.defaultCopyLanguage ? { defaultCopyLanguage: input.defaultCopyLanguage } : {}),
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

  update: protectedProcedure.input(updateBrandKitSchema).mutation(async ({ ctx, input }) => {
    const existing = await requireBrandKit(input.brandKitId);
    await assertCan(ctx.user, existing.workspaceId, "brandSettings:update");

    const [updated] = await db
      .update(schema.brandSettings)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.palette !== undefined ? { paletteJson: input.palette } : {}),
        ...(input.tone !== undefined ? { tone: input.tone } : {}),
        ...(input.guidelines !== undefined ? { guidelines: input.guidelines } : {}),
        ...(input.logoAssetId !== undefined ? { logoAssetId: input.logoAssetId } : {}),
        ...(input.imageProvider !== undefined ? { imageProvider: input.imageProvider } : {}),
        ...(input.fonts !== undefined ? { fonts: input.fonts } : {}),
        ...(input.defaultCopyLanguage !== undefined
          ? { defaultCopyLanguage: input.defaultCopyLanguage }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.brandSettings.id, input.brandKitId))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await logActivity(
      existing.workspaceId,
      ctx.user.id,
      "brand_settings",
      updated.id,
      "brand_settings.updated",
    );
    return updated;
  }),

  delete: protectedProcedure.input(deleteBrandKitSchema).mutation(async ({ ctx, input }) => {
    const existing = await requireBrandKit(input.brandKitId);
    await assertCan(ctx.user, existing.workspaceId, "brandSettings:update");

    // Any space pointing at this kit falls back to onDelete: set null (see
    // spaces.brand_kit_id) — no manual cleanup needed here.
    await db.delete(schema.brandSettings).where(eq(schema.brandSettings.id, input.brandKitId));

    // Deleting the workspace's default kit must not leave it with zero
    // defaults — resolveEffectiveBrandKit's workspace-fallback query only
    // ever looks for isDefault=true, so without this the workspace would
    // silently fall back to "no kit" until an admin happened to notice and
    // re-pick one by hand.
    if (existing.isDefault) {
      const nextDefault = await db.query.brandSettings.findFirst({
        where: eq(schema.brandSettings.workspaceId, existing.workspaceId),
        orderBy: (kits, { asc }) => [asc(kits.createdAt)],
      });
      if (nextDefault) {
        await db
          .update(schema.brandSettings)
          .set({ isDefault: true })
          .where(eq(schema.brandSettings.id, nextDefault.id));
      }
    }

    await logActivity(
      existing.workspaceId,
      ctx.user.id,
      "brand_settings",
      input.brandKitId,
      "brand_settings.deleted",
    );
    return { ok: true as const };
  }),

  setDefault: protectedProcedure
    .input(setDefaultBrandKitSchema)
    .mutation(async ({ ctx, input }) => {
      const kit = await requireBrandKit(input.brandKitId);
      if (kit.workspaceId !== input.workspaceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kit belongs to another workspace" });
      }
      await assertCan(ctx.user, input.workspaceId, "brandSettings:update");

      await db.transaction(async (tx) => {
        await tx
          .update(schema.brandSettings)
          .set({ isDefault: false })
          .where(
            and(
              eq(schema.brandSettings.workspaceId, input.workspaceId),
              eq(schema.brandSettings.isDefault, true),
            ),
          );
        await tx
          .update(schema.brandSettings)
          .set({ isDefault: true })
          .where(eq(schema.brandSettings.id, input.brandKitId));
      });

      await logActivity(
        input.workspaceId,
        ctx.user.id,
        "brand_settings",
        input.brandKitId,
        "brand_settings.default_set",
      );
      return { ok: true as const };
    }),
});
