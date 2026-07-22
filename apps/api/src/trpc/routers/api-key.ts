import { db, schema } from "@canvas/db";
import { createApiKeySchema, deleteApiKeySchema, listApiKeysSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { generateApiKey } from "../../lib/api-key";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

export const apiKeyRouter = router({
  list: protectedProcedure.input(listApiKeysSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "apiKey:view");

    // Never selects `hash` — nothing about a stored key needs to reach the
    // client once the raw value has been shown at creation time.
    return db
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        createdAt: schema.apiKeys.createdAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.workspaceId, input.workspaceId))
      .orderBy(desc(schema.apiKeys.createdAt));
  }),

  create: protectedProcedure.input(createApiKeySchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "apiKey:create");

    const { raw, hash } = generateApiKey();
    const [apiKey] = await db
      .insert(schema.apiKeys)
      .values({ workspaceId: input.workspaceId, name: input.name, hash, createdBy: ctx.user.id })
      .returning();
    if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "api_key", apiKey.id, "api_key.created");
    // The only point in this key's lifetime the raw value is ever available.
    return { id: apiKey.id, name: apiKey.name, createdAt: apiKey.createdAt, key: raw };
  }),

  delete: protectedProcedure.input(deleteApiKeySchema).mutation(async ({ ctx, input }) => {
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(schema.apiKeys.id, input.apiKeyId),
    });
    if (!apiKey) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, apiKey.workspaceId, "apiKey:delete");

    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, apiKey.id));

    await logActivity(apiKey.workspaceId, ctx.user.id, "api_key", apiKey.id, "api_key.deleted");
    return { id: apiKey.id };
  }),
});
