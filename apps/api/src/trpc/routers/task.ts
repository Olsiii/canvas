import { db, schema } from "@canvas/db";
import {
  assignTaskSchema,
  createTaskSchema,
  deleteTaskSchema,
  getTaskSchema,
  listTasksSchema,
  unassignTaskSchema,
  updateTaskSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { requireList, requireSpace } from "../../lib/hierarchy";
import { nextOrderKey } from "../../lib/order";
import { assertCan } from "../../lib/permissions";
import { buildTaskUpdateFields } from "../../lib/task-update";
import { protectedProcedure, router } from "../trpc";

async function requireTask(taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(schema.tasks.id, taskId), isNull(schema.tasks.deletedAt)),
  });
  if (!task) throw new TRPCError({ code: "NOT_FOUND" });
  return task;
}

async function requireStatusInList(statusId: string, listId: string) {
  const status = await db.query.statuses.findFirst({ where: eq(schema.statuses.id, statusId) });
  if (!status || status.listId !== listId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Status does not belong to this list" });
  }
  return status;
}

async function firstStatusForList(listId: string) {
  const status = await db.query.statuses.findFirst({
    where: eq(schema.statuses.listId, listId),
    orderBy: asc(schema.statuses.orderKey),
  });
  if (!status) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This list has no statuses yet" });
  }
  return status;
}

async function lastTaskOrderKey(listId: string, statusId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.tasks.orderKey })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.listId, listId),
        eq(schema.tasks.statusId, statusId),
        isNull(schema.tasks.deletedAt),
      ),
    )
    .orderBy(desc(schema.tasks.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

async function workspaceIdForList(listId: string) {
  const list = await requireList(listId);
  const space = await requireSpace(list.spaceId);
  return space.workspaceId;
}

async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.workspaceId, workspaceId),
      eq(schema.memberships.userId, userId),
    ),
  });
  if (!membership) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "User is not a member of this workspace" });
  }
}

async function getAssignees(taskId: string) {
  return db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.taskAssignees)
    .innerJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
    .where(eq(schema.taskAssignees.taskId, taskId));
}

export const taskRouter = router({
  list: protectedProcedure.input(listTasksSchema).query(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForList(input.listId);
    await assertCan(ctx.user, workspaceId, "task:view");

    return db
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.listId, input.listId), isNull(schema.tasks.deletedAt)))
      .orderBy(asc(schema.tasks.orderKey));
  }),

  get: protectedProcedure.input(getTaskSchema).query(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForList(task.listId);
    await assertCan(ctx.user, workspaceId, "task:view");

    const assignees = await getAssignees(task.id);
    return { ...task, assignees };
  }),

  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForList(input.listId);
    await assertCan(ctx.user, workspaceId, "task:create");

    const status = input.statusId
      ? await requireStatusInList(input.statusId, input.listId)
      : await firstStatusForList(input.listId);

    const lastKey = await lastTaskOrderKey(input.listId, status.id);

    const [task] = await db
      .insert(schema.tasks)
      .values({
        listId: input.listId,
        title: input.title,
        statusId: status.id,
        orderKey: nextOrderKey(lastKey),
        createdBy: ctx.user.id,
      })
      .returning();
    if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.created");
    return task;
  }),

  update: protectedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForList(task.listId);
    await assertCan(ctx.user, workspaceId, "task:update");

    let statusId: string | undefined;
    if (input.statusId !== undefined && input.statusId !== task.statusId) {
      const status = await requireStatusInList(input.statusId, task.listId);
      statusId = status.id;
    }

    // An explicit orderKey (e.g. from a board drag-and-drop drop) wins; a
    // bare status change with no position given appends to the column's end.
    const orderKey =
      input.orderKey ??
      (statusId !== undefined
        ? nextOrderKey(await lastTaskOrderKey(task.listId, statusId))
        : undefined);

    const [updated] = await db
      .update(schema.tasks)
      .set({
        ...buildTaskUpdateFields({
          title: input.title,
          statusId,
          orderKey,
          descriptionJson: input.descriptionJson,
          priority: input.priority,
          startDate: input.startDate,
          dueDate: input.dueDate,
        }),
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, input.taskId))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.updated");
    return updated;
  }),

  delete: protectedProcedure.input(deleteTaskSchema).mutation(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForList(task.listId);
    await assertCan(ctx.user, workspaceId, "task:delete");

    await db
      .update(schema.tasks)
      .set({ deletedAt: new Date() })
      .where(eq(schema.tasks.id, task.id));

    await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.deleted");
    return { id: task.id };
  }),

  assignees: router({
    add: protectedProcedure.input(assignTaskSchema).mutation(async ({ ctx, input }) => {
      const task = await requireTask(input.taskId);
      const workspaceId = await workspaceIdForList(task.listId);
      await assertCan(ctx.user, workspaceId, "task:update");
      await requireWorkspaceMember(workspaceId, input.userId);

      await db
        .insert(schema.taskAssignees)
        .values({ taskId: task.id, userId: input.userId })
        .onConflictDoNothing();

      await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.assigned");
      return getAssignees(task.id);
    }),

    remove: protectedProcedure.input(unassignTaskSchema).mutation(async ({ ctx, input }) => {
      const task = await requireTask(input.taskId);
      const workspaceId = await workspaceIdForList(task.listId);
      await assertCan(ctx.user, workspaceId, "task:update");

      await db
        .delete(schema.taskAssignees)
        .where(
          and(
            eq(schema.taskAssignees.taskId, task.id),
            eq(schema.taskAssignees.userId, input.userId),
          ),
        );

      await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.unassigned");
      return getAssignees(task.id);
    }),
  }),
});
