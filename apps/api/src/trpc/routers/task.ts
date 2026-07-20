import { db, schema } from "@canvas/db";
import {
  addTaskTagSchema,
  assignTaskSchema,
  bulkUpdateTasksSchema,
  createTaskSchema,
  deleteTaskSchema,
  getTaskSchema,
  listTasksSchema,
  removeTaskTagSchema,
  searchTasksSchema,
  unassignTaskSchema,
  updateTaskSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { nextOrderKey } from "../../lib/order";
import { assertCan } from "../../lib/permissions";
import { publish } from "../../lib/realtime";
import { validateSubtaskParent } from "../../lib/subtask";
import { buildTaskUpdateFields } from "../../lib/task-update";
import { requireTask, workspaceIdForList } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";

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

async function requireTagInWorkspace(tagId: string, workspaceId: string) {
  const tag = await db.query.tags.findFirst({ where: eq(schema.tags.id, tagId) });
  if (!tag || tag.workspaceId !== workspaceId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tag does not belong to this workspace" });
  }
  return tag;
}

async function getTags(taskId: string) {
  return db
    .select({ id: schema.tags.id, name: schema.tags.name, color: schema.tags.color })
    .from(schema.taskTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.taskTags.tagId))
    .where(eq(schema.taskTags.taskId, taskId))
    .orderBy(asc(schema.tags.name));
}

async function getSubtasks(taskId: string) {
  return db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      statusId: schema.tasks.statusId,
    })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.parentTaskId, taskId), isNull(schema.tasks.deletedAt)))
    .orderBy(asc(schema.tasks.orderKey));
}

export const taskRouter = router({
  list: protectedProcedure.input(listTasksSchema).query(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForList(input.listId);
    await assertCan(ctx.user, workspaceId, "task:view");

    // Subtasks are reached via their parent's detail panel, not shown as
    // their own top-level card/row here — otherwise they'd appear twice.
    return db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.listId, input.listId),
          isNull(schema.tasks.deletedAt),
          isNull(schema.tasks.parentTaskId),
        ),
      )
      .orderBy(asc(schema.tasks.orderKey));
  }),

  get: protectedProcedure.input(getTaskSchema).query(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForList(task.listId);
    await assertCan(ctx.user, workspaceId, "task:view");

    const assignees = await getAssignees(task.id);
    const tags = await getTags(task.id);
    const subtasks = task.parentTaskId ? [] : await getSubtasks(task.id);
    return { ...task, assignees, tags, subtasks };
  }),

  // Workspace-wide (not scoped to one list, unlike `list` above) — the
  // point of search is finding a task without already knowing where it
  // lives. DATA_MODEL.md: "FTS: generated tsvector on tasks.title +
  // description (GIN)" (see schema/tasks.ts's searchVector column).
  search: protectedProcedure.input(searchTasksSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "task:view");

    const tsquery = sql`websearch_to_tsquery('english', ${input.query})`;
    const rank = sql<number>`ts_rank(${schema.tasks.searchVector}, ${tsquery})`;

    return db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        listId: schema.tasks.listId,
        listName: schema.lists.name,
        spaceName: schema.spaces.name,
      })
      .from(schema.tasks)
      .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
      .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
      .where(
        and(
          eq(schema.spaces.workspaceId, input.workspaceId),
          isNull(schema.tasks.deletedAt),
          isNull(schema.lists.deletedAt),
          isNull(schema.spaces.deletedAt),
          sql`${schema.tasks.searchVector} @@ ${tsquery}`,
        ),
      )
      .orderBy(desc(rank))
      .limit(20);
  }),

  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForList(input.listId);
    await assertCan(ctx.user, workspaceId, "task:create");

    let parentTaskId: string | undefined;
    if (input.parentTaskId) {
      const parent = await requireTask(input.parentTaskId);
      const error = validateSubtaskParent(parent, input.listId);
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
      parentTaskId = parent.id;
    }

    const status = input.statusId
      ? await requireStatusInList(input.statusId, input.listId)
      : await firstStatusForList(input.listId);

    const lastKey = await lastTaskOrderKey(input.listId, status.id);

    const [task] = await db
      .insert(schema.tasks)
      .values({
        listId: input.listId,
        parentTaskId,
        title: input.title,
        statusId: status.id,
        orderKey: nextOrderKey(lastKey),
        createdBy: ctx.user.id,
      })
      .returning();
    if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.created");
    publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "created" });
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
    publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });
    return updated;
  }),

  bulkUpdate: protectedProcedure.input(bulkUpdateTasksSchema).mutation(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForList(input.listId);
    await assertCan(ctx.user, workspaceId, "task:update");

    if (input.statusId !== undefined) {
      await requireStatusInList(input.statusId, input.listId);
    }

    const rows = await db
      .select({ id: schema.tasks.id, statusId: schema.tasks.statusId })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.listId, input.listId),
          inArray(schema.tasks.id, input.taskIds),
          isNull(schema.tasks.deletedAt),
        ),
      );

    if (rows.length !== input.taskIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One or more tasks were not found in this list",
      });
    }

    // Status changes append each task to the end of the new column so we
    // don't invent a shared orderKey for the whole selection.
    let orderKeyByTaskId: Map<string, string> | undefined;
    if (input.statusId !== undefined) {
      orderKeyByTaskId = new Map();
      let lastKey = await lastTaskOrderKey(input.listId, input.statusId);
      for (const row of rows) {
        if (row.statusId === input.statusId) continue;
        lastKey = nextOrderKey(lastKey);
        orderKeyByTaskId.set(row.id, lastKey);
      }
    }

    const updatedAt = new Date();
    for (const row of rows) {
      const orderKey = orderKeyByTaskId?.get(row.id);
      await db
        .update(schema.tasks)
        .set({
          ...buildTaskUpdateFields({
            statusId:
              input.statusId !== undefined && row.statusId !== input.statusId
                ? input.statusId
                : undefined,
            orderKey,
            priority: input.priority,
            startDate: input.startDate,
            dueDate: input.dueDate,
          }),
          updatedAt,
        })
        .where(eq(schema.tasks.id, row.id));
      publish(workspaceId, {
        entity: "task",
        id: row.id,
        listId: input.listId,
        kind: "updated",
      });
    }

    await logActivity(workspaceId, ctx.user.id, "list", input.listId, "task.bulk_updated", {
      taskIds: input.taskIds,
      statusId: input.statusId,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
    });

    return { updated: rows.length };
  }),

  delete: protectedProcedure.input(deleteTaskSchema).mutation(async ({ ctx, input }) => {
    const task = await requireTask(input.taskId);
    const workspaceId = await workspaceIdForList(task.listId);
    await assertCan(ctx.user, workspaceId, "task:delete");

    const deletedAt = new Date();
    await db.update(schema.tasks).set({ deletedAt }).where(eq(schema.tasks.id, task.id));
    // Cascade the soft delete to subtasks — a deleted parent's subtasks
    // would otherwise become permanently unreachable (excluded from
    // task.list, but their parent's detail panel can no longer be opened).
    await db
      .update(schema.tasks)
      .set({ deletedAt })
      .where(and(eq(schema.tasks.parentTaskId, task.id), isNull(schema.tasks.deletedAt)));

    await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.deleted");
    publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "deleted" });
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
      publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });
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
      publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });
      return getAssignees(task.id);
    }),
  }),

  tags: router({
    add: protectedProcedure.input(addTaskTagSchema).mutation(async ({ ctx, input }) => {
      const task = await requireTask(input.taskId);
      const workspaceId = await workspaceIdForList(task.listId);
      await assertCan(ctx.user, workspaceId, "task:update");
      await requireTagInWorkspace(input.tagId, workspaceId);

      await db
        .insert(schema.taskTags)
        .values({ taskId: task.id, tagId: input.tagId })
        .onConflictDoNothing();

      await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.tagged");
      publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });
      return getTags(task.id);
    }),

    remove: protectedProcedure.input(removeTaskTagSchema).mutation(async ({ ctx, input }) => {
      const task = await requireTask(input.taskId);
      const workspaceId = await workspaceIdForList(task.listId);
      await assertCan(ctx.user, workspaceId, "task:update");

      await db
        .delete(schema.taskTags)
        .where(and(eq(schema.taskTags.taskId, task.id), eq(schema.taskTags.tagId, input.tagId)));

      await logActivity(workspaceId, ctx.user.id, "task", task.id, "task.untagged");
      publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });
      return getTags(task.id);
    }),
  }),
});
