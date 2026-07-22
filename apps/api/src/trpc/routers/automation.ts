import { db, schema } from "@canvas/db";
import {
  createAutomationSchema,
  deleteAutomationSchema,
  getAutomationSchema,
  listAutomationRunsSchema,
  listAutomationsSchema,
  updateAutomationSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

async function requireAutomation(automationId: string) {
  const automation = await db.query.automations.findFirst({
    where: eq(schema.automations.id, automationId),
  });
  if (!automation) throw new TRPCError({ code: "NOT_FOUND" });
  return automation;
}

export const automationRouter = router({
  list: protectedProcedure.input(listAutomationsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "automation:view");

    return db
      .select()
      .from(schema.automations)
      .where(eq(schema.automations.workspaceId, input.workspaceId))
      .orderBy(desc(schema.automations.createdAt));
  }),

  get: protectedProcedure.input(getAutomationSchema).query(async ({ ctx, input }) => {
    const automation = await requireAutomation(input.automationId);
    await assertCan(ctx.user, automation.workspaceId, "automation:view");
    return automation;
  }),

  create: protectedProcedure.input(createAutomationSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "automation:create");

    const [automation] = await db
      .insert(schema.automations)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        triggerJson: input.trigger,
        conditionsJson: input.conditions,
        actionsJson: input.actions,
        createdBy: ctx.user.id,
      })
      .returning();
    if (!automation) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "automation",
      automation.id,
      "automation.created",
    );
    return automation;
  }),

  update: protectedProcedure.input(updateAutomationSchema).mutation(async ({ ctx, input }) => {
    const automation = await requireAutomation(input.automationId);
    await assertCan(ctx.user, automation.workspaceId, "automation:update");

    const [updated] = await db
      .update(schema.automations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.trigger !== undefined ? { triggerJson: input.trigger } : {}),
        ...(input.conditions !== undefined ? { conditionsJson: input.conditions } : {}),
        ...(input.actions !== undefined ? { actionsJson: input.actions } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.automations.id, automation.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      automation.workspaceId,
      ctx.user.id,
      "automation",
      automation.id,
      "automation.updated",
    );
    return updated;
  }),

  delete: protectedProcedure.input(deleteAutomationSchema).mutation(async ({ ctx, input }) => {
    const automation = await requireAutomation(input.automationId);
    await assertCan(ctx.user, automation.workspaceId, "automation:delete");

    await db.delete(schema.automations).where(eq(schema.automations.id, automation.id));

    await logActivity(
      automation.workspaceId,
      ctx.user.id,
      "automation",
      automation.id,
      "automation.deleted",
    );
    return { id: automation.id };
  }),

  runs: router({
    list: protectedProcedure.input(listAutomationRunsSchema).query(async ({ ctx, input }) => {
      const automation = await requireAutomation(input.automationId);
      await assertCan(ctx.user, automation.workspaceId, "automation:view");

      return db
        .select()
        .from(schema.automationRuns)
        .where(eq(schema.automationRuns.automationId, automation.id))
        .orderBy(desc(schema.automationRuns.createdAt));
    }),
  }),
});
