import { db, schema } from "@canvas/db";
import { listActivitySchema, listWorkspaceActivitySchema } from "@canvas/shared";
import { and, desc, eq, gte, ilike, lt, lte } from "drizzle-orm";
import { assertCan } from "../../lib/permissions";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";
import { z } from "zod";

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
  // Cursor-paginated (activity.id — a UUIDv7, so id order == time order) and
  // filterable by actor/entity type/verb substring/date range for the Admin
  // page's audit log, which otherwise only ever showed the newest 100 rows
  // with no way to narrow down a specific change.
  listWorkspace: protectedProcedure
    .input(listWorkspaceActivitySchema)
    .query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "workspace:manage");

      const conditions = [eq(schema.activity.workspaceId, input.workspaceId)];
      if (input.cursor) conditions.push(lt(schema.activity.id, input.cursor));
      if (input.actorId) conditions.push(eq(schema.activity.actorId, input.actorId));
      if (input.entityType) conditions.push(eq(schema.activity.entityType, input.entityType));
      if (input.verb) conditions.push(ilike(schema.activity.verb, `%${input.verb}%`));
      if (input.from) conditions.push(gte(schema.activity.createdAt, new Date(input.from)));
      if (input.to) conditions.push(lte(schema.activity.createdAt, new Date(input.to)));

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
        .where(and(...conditions))
        .orderBy(desc(schema.activity.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return { items, nextCursor: hasMore ? items.at(-1)?.id : undefined };
    }),

  // Distinct entity types actually present in this workspace's activity log,
  // for the audit filter dropdown — dynamic rather than a hardcoded enum
  // since new entity types get logged as features grow.
  entityTypes: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "workspace:manage");

      const rows = await db
        .selectDistinct({ entityType: schema.activity.entityType })
        .from(schema.activity)
        .where(eq(schema.activity.workspaceId, input.workspaceId))
        .orderBy(schema.activity.entityType);

      return rows.map((r) => r.entityType);
    }),
});
