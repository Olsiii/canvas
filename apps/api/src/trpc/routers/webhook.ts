import { db, schema } from "@canvas/db";
import { createWebhookSchema, deleteWebhookSchema, listWebhooksSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { generateWebhookSecret } from "../../lib/webhook-signature";
import { protectedProcedure, router } from "../trpc";

export const webhookRouter = router({
  list: protectedProcedure.input(listWebhooksSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "webhook:view");

    // Includes `secret` — unlike an API key hash, a webhook's secret is
    // needed again (to re-verify the signing setup on the receiving end),
    // so it's shown on the list, not hidden after creation.
    return db
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.workspaceId, input.workspaceId))
      .orderBy(desc(schema.webhooks.createdAt));
  }),

  create: protectedProcedure.input(createWebhookSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "webhook:create");

    const [webhook] = await db
      .insert(schema.webhooks)
      .values({
        workspaceId: input.workspaceId,
        url: input.url,
        events: input.events,
        secret: generateWebhookSecret(),
        createdBy: ctx.user.id,
      })
      .returning();
    if (!webhook) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "webhook", webhook.id, "webhook.created", {
      url: webhook.url,
      events: webhook.events,
    });
    return webhook;
  }),

  delete: protectedProcedure.input(deleteWebhookSchema).mutation(async ({ ctx, input }) => {
    const webhook = await db.query.webhooks.findFirst({
      where: eq(schema.webhooks.id, input.webhookId),
    });
    if (!webhook) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, webhook.workspaceId, "webhook:delete");

    await db.delete(schema.webhooks).where(eq(schema.webhooks.id, webhook.id));

    await logActivity(webhook.workspaceId, ctx.user.id, "webhook", webhook.id, "webhook.deleted");
    return { id: webhook.id };
  }),
});
