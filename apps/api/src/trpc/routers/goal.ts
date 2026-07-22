import { db, schema } from "@canvas/db";
import {
  addGoalTaskLinkSchema,
  createGoalSchema,
  deleteGoalSchema,
  getGoalSchema,
  goalMetricSchema,
  listGoalsSchema,
  listGoalTaskLinksSchema,
  removeGoalTaskLinkSchema,
  updateGoalSchema,
  type GoalMetric,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { computeGoalProgress } from "../../lib/goal-progress";
import { assertCan } from "../../lib/permissions";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";

async function requireGoal(goalId: string) {
  const goal = await db.query.goals.findFirst({ where: eq(schema.goals.id, goalId) });
  if (!goal) throw new TRPCError({ code: "NOT_FOUND" });
  return goal;
}

async function listLinksForGoal(goalId: string) {
  return db
    .select({
      goalId: schema.goalLinks.goalId,
      taskId: schema.goalLinks.taskId,
      taskTitle: schema.tasks.title,
      completedAt: schema.tasks.completedAt,
      createdAt: schema.goalLinks.createdAt,
    })
    .from(schema.goalLinks)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.goalLinks.taskId))
    .where(and(eq(schema.goalLinks.goalId, goalId), isNull(schema.tasks.deletedAt)))
    .orderBy(asc(schema.tasks.title));
}

async function progressForGoal(goalId: string, metric: GoalMetric) {
  if (metric.type !== "task_completion") return computeGoalProgress(metric, []);
  const links = await listLinksForGoal(goalId);
  return computeGoalProgress(metric, links);
}

export const goalRouter = router({
  list: protectedProcedure.input(listGoalsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "goal:view");

    const rows = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.workspaceId, input.workspaceId))
      .orderBy(asc(schema.goals.name));

    return Promise.all(
      rows.map(async (goal) => ({
        ...goal,
        progress: await progressForGoal(goal.id, goalMetricSchema.parse(goal.metricJson)),
      })),
    );
  }),

  get: protectedProcedure.input(getGoalSchema).query(async ({ ctx, input }) => {
    const goal = await requireGoal(input.goalId);
    await assertCan(ctx.user, goal.workspaceId, "goal:view");

    const metric = goalMetricSchema.parse(goal.metricJson);
    const links = await listLinksForGoal(goal.id);
    return { ...goal, links, progress: await progressForGoal(goal.id, metric) };
  }),

  create: protectedProcedure.input(createGoalSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "goal:create");

    const [goal] = await db
      .insert(schema.goals)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        metricJson: input.metric,
        dueDate: input.dueDate ?? null,
        createdBy: ctx.user.id,
      })
      .returning();
    if (!goal) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "goal", goal.id, "goal.created");
    return goal;
  }),

  update: protectedProcedure.input(updateGoalSchema).mutation(async ({ ctx, input }) => {
    const goal = await requireGoal(input.goalId);
    await assertCan(ctx.user, goal.workspaceId, "goal:update");

    const [updated] = await db
      .update(schema.goals)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.metric !== undefined ? { metricJson: input.metric } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.goals.id, goal.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(goal.workspaceId, ctx.user.id, "goal", goal.id, "goal.updated");
    return updated;
  }),

  delete: protectedProcedure.input(deleteGoalSchema).mutation(async ({ ctx, input }) => {
    const goal = await requireGoal(input.goalId);
    await assertCan(ctx.user, goal.workspaceId, "goal:delete");

    await db.delete(schema.goals).where(eq(schema.goals.id, goal.id));

    await logActivity(goal.workspaceId, ctx.user.id, "goal", goal.id, "goal.deleted");
    return { id: goal.id };
  }),

  links: router({
    list: protectedProcedure.input(listGoalTaskLinksSchema).query(async ({ ctx, input }) => {
      const goal = await requireGoal(input.goalId);
      await assertCan(ctx.user, goal.workspaceId, "goal:view");
      return listLinksForGoal(goal.id);
    }),

    add: protectedProcedure.input(addGoalTaskLinkSchema).mutation(async ({ ctx, input }) => {
      const goal = await requireGoal(input.goalId);
      await assertCan(ctx.user, goal.workspaceId, "goal:update");

      const task = await requireTask(input.taskId);
      const taskWorkspaceId = await workspaceIdForTask(task.id);
      if (taskWorkspaceId !== goal.workspaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Task does not belong to this workspace",
        });
      }
      await assertCan(ctx.user, goal.workspaceId, "task:view");

      await db
        .insert(schema.goalLinks)
        .values({ goalId: goal.id, taskId: task.id })
        .onConflictDoNothing();

      await logActivity(goal.workspaceId, ctx.user.id, "goal", goal.id, "goal.task_linked", {
        taskId: task.id,
      });
      return listLinksForGoal(goal.id);
    }),

    remove: protectedProcedure.input(removeGoalTaskLinkSchema).mutation(async ({ ctx, input }) => {
      const goal = await requireGoal(input.goalId);
      await assertCan(ctx.user, goal.workspaceId, "goal:update");

      await db
        .delete(schema.goalLinks)
        .where(
          and(eq(schema.goalLinks.goalId, goal.id), eq(schema.goalLinks.taskId, input.taskId)),
        );

      await logActivity(goal.workspaceId, ctx.user.id, "goal", goal.id, "goal.task_unlinked", {
        taskId: input.taskId,
      });
      return listLinksForGoal(goal.id);
    }),
  }),
});
