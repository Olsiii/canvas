import { db, schema } from "@canvas/db";
import { createTagSchema, deleteTagSchema, listTagsSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { publish } from "../../lib/realtime";
import { protectedProcedure, router } from "../trpc";

async function requireTag(tagId: string) {
  const tag = await db.query.tags.findFirst({ where: eq(schema.tags.id, tagId) });
  if (!tag) throw new TRPCError({ code: "NOT_FOUND" });
  return tag;
}

export const tagRouter = router({
  list: protectedProcedure.input(listTagsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "tag:view");

    return db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.workspaceId, input.workspaceId))
      .orderBy(asc(schema.tags.name));
  }),

  create: protectedProcedure.input(createTagSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "tag:create");

    const existing = await db.query.tags.findFirst({
      where: and(eq(schema.tags.workspaceId, input.workspaceId), eq(schema.tags.name, input.name)),
    });
    if (existing) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A tag with this name already exists" });
    }

    const [tag] = await db
      .insert(schema.tags)
      .values({ workspaceId: input.workspaceId, name: input.name, color: input.color })
      .returning();
    if (!tag) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "tag", tag.id, "tag.created");
    await publish(input.workspaceId, {
      entity: "tag",
      id: tag.id,
      workspaceId: input.workspaceId,
      kind: "created",
    });
    return tag;
  }),

  delete: protectedProcedure.input(deleteTagSchema).mutation(async ({ ctx, input }) => {
    const tag = await requireTag(input.tagId);
    await assertCan(ctx.user, tag.workspaceId, "tag:delete");

    await db.delete(schema.tags).where(eq(schema.tags.id, tag.id));

    await logActivity(tag.workspaceId, ctx.user.id, "tag", tag.id, "tag.deleted");
    await publish(tag.workspaceId, {
      entity: "tag",
      id: tag.id,
      workspaceId: tag.workspaceId,
      kind: "deleted",
    });
    return { id: tag.id };
  }),
});
