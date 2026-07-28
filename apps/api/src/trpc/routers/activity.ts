import { db, schema } from "@canvas/db";
import { listActivitySchema, listWorkspaceActivitySchema } from "@canvas/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import { assertCan } from "../../lib/permissions";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";

export const activityRouter = router({
  // Task-scoped only (entityType = "task"): a feed of the field-level
  // changes made to this task. Comments have their own, already-visible
  // thread (the Comments section) and aren't duplicated in here.
  list: protectedProcedure.input(listActivitySchema).query(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForTask(task.id);
    await assertCan(ctx.user, workspaceId, "task:view");

    return db
      .select({
        id: schema.activity.id,
        verb: schema.activity.verb,
        createdAt: schema.activity.createdAt,
        actorName: schema.users.name,
      })
      .from(schema.activity)
      .innerJoin(schema.users, eq(schema.users.id, schema.activity.actorId))
      .where(and(eq(schema.activity.entityType, "task"), eq(schema.activity.entityId, task.id)))
      .orderBy(desc(schema.activity.createdAt));
  }),

  // Workspace-wide audit feed for the Admin page (owner/admin via workspace:manage).
  listWorkspace: protectedProcedure
    .input(listWorkspaceActivitySchema)
    .query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "workspace:manage");

      const before = input.before ? new Date(input.before) : undefined;
      const rows = await db
        .select({
          id: schema.activity.id,
          verb: schema.activity.verb,
          entityType: schema.activity.entityType,
          entityId: schema.activity.entityId,
          createdAt: schema.activity.createdAt,
          actorName: schema.users.name,
          actorEmail: schema.users.email,
        })
        .from(schema.activity)
        .innerJoin(schema.users, eq(schema.users.id, schema.activity.actorId))
        .where(
          and(
            eq(schema.activity.workspaceId, input.workspaceId),
            before ? lt(schema.activity.createdAt, before) : undefined,
          ),
        )
        .orderBy(desc(schema.activity.createdAt))
        .limit(input.limit);

      return rows;
    }),
});
