import { db, schema } from "@canvas/db";
import { createScimTokenSchema, deleteScimTokenSchema, listScimTokensSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { generateScimToken } from "../../lib/scim-token";
import { protectedProcedure, router } from "../trpc";

export const scimTokenRouter = router({
  list: protectedProcedure.input(listScimTokensSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "scimToken:view");

    // Never selects `hash` — same reasoning as apiKey.list.
    return db
      .select({
        id: schema.scimTokens.id,
        name: schema.scimTokens.name,
        lastUsedAt: schema.scimTokens.lastUsedAt,
        createdAt: schema.scimTokens.createdAt,
      })
      .from(schema.scimTokens)
      .where(eq(schema.scimTokens.workspaceId, input.workspaceId))
      .orderBy(desc(schema.scimTokens.createdAt));
  }),

  create: protectedProcedure.input(createScimTokenSchema).mutation(async ({ ctx, input }) => {
    // Owner tier — see auth/can.ts: a SCIM token is a standing grant to an
    // external identity provider to add/remove members of this workspace.
    await assertCan(ctx.user, input.workspaceId, "scimToken:create");

    const { raw, hash } = generateScimToken();
    const [scimToken] = await db
      .insert(schema.scimTokens)
      .values({ workspaceId: input.workspaceId, name: input.name, hash, createdBy: ctx.user.id })
      .returning();
    if (!scimToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "scim_token",
      scimToken.id,
      "scim_token.created",
    );
    // The only point in this token's lifetime the raw value is ever available.
    return { id: scimToken.id, name: scimToken.name, createdAt: scimToken.createdAt, token: raw };
  }),

  delete: protectedProcedure.input(deleteScimTokenSchema).mutation(async ({ ctx, input }) => {
    const scimToken = await db.query.scimTokens.findFirst({
      where: eq(schema.scimTokens.id, input.scimTokenId),
    });
    if (!scimToken) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, scimToken.workspaceId, "scimToken:delete");

    await db.delete(schema.scimTokens).where(eq(schema.scimTokens.id, scimToken.id));

    await logActivity(
      scimToken.workspaceId,
      ctx.user.id,
      "scim_token",
      scimToken.id,
      "scim_token.deleted",
    );
    return { id: scimToken.id };
  }),
});
