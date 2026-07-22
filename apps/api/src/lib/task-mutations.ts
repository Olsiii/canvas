import { db, schema } from "@canvas/db";
import type { TaskPriority } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { logActivity } from "./activity";
import { runAutomationsForTrigger } from "./automation-runner";
import { nextOrderKey } from "./order";
import { publish } from "./realtime";
import {
  firstStatusForList,
  lastTaskOrderKey,
  requireTask,
  workspaceIdForList,
} from "./task-queries";
import { buildTaskUpdateFields, computeCompletedAt } from "./task-update";
import { triggerWebhooksForEvent } from "./webhook-runner";

// The REST v1 API's own create/update — deliberately not a shared call
// with trpc/routers/task.ts's create/update (which predate this and are
// already covered by their own passing specs). Both paths still end up
// calling the exact same side-effect primitives below (logActivity,
// runAutomationsForTrigger, triggerWebhooksForEvent, publish) so an
// API-created task is indistinguishable from a UI-created one to every
// downstream consumer — only the request-shaping code differs.
async function requireStatusInList(statusId: string, listId: string) {
  const status = await db.query.statuses.findFirst({ where: eq(schema.statuses.id, statusId) });
  if (!status || status.listId !== listId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Status does not belong to this list" });
  }
  return status;
}

export async function createTaskViaApi(input: {
  listId: string;
  title: string;
  statusId?: string;
  descriptionJson?: unknown;
  priority?: TaskPriority | null;
  startDate?: string | null;
  dueDate?: string | null;
  actorId: string;
}) {
  const workspaceId = await workspaceIdForList(input.listId);
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
      createdBy: input.actorId,
      completedAt: computeCompletedAt(status.kind, null, new Date()),
      ...(input.descriptionJson !== undefined ? { descriptionJson: input.descriptionJson } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    })
    .returning();
  if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  await logActivity(workspaceId, input.actorId, "task", task.id, "task.created");
  await runAutomationsForTrigger(workspaceId, { type: "task_created" }, task);
  await triggerWebhooksForEvent(workspaceId, "task.created", {
    taskId: task.id,
    title: task.title,
    listId: task.listId,
  });
  await publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "created" });

  return task;
}

export async function updateTaskViaApi(input: {
  taskId: string;
  title?: string;
  statusId?: string;
  descriptionJson?: unknown;
  priority?: TaskPriority | null;
  startDate?: string | null;
  dueDate?: string | null;
  actorId: string;
}) {
  const task = await requireTask(input.taskId);
  const workspaceId = await workspaceIdForList(task.listId);

  let statusId: string | undefined;
  let newStatusKind: string | undefined;
  let completedAt: Date | null | undefined;
  if (input.statusId !== undefined && input.statusId !== task.statusId) {
    const status = await requireStatusInList(input.statusId, task.listId);
    statusId = status.id;
    newStatusKind = status.kind;
    completedAt = computeCompletedAt(status.kind, task.completedAt, new Date());
  }

  const orderKey =
    statusId !== undefined
      ? nextOrderKey(await lastTaskOrderKey(task.listId, statusId))
      : undefined;

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
        completedAt,
      }),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, task.id))
    .returning();
  if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  await logActivity(workspaceId, input.actorId, "task", task.id, "task.updated");
  if (newStatusKind !== undefined) {
    await runAutomationsForTrigger(
      workspaceId,
      { type: "task_status_changed", toStatusKind: newStatusKind },
      updated,
    );
    await triggerWebhooksForEvent(workspaceId, "task.status_changed", {
      taskId: updated.id,
      title: updated.title,
      listId: updated.listId,
      statusKind: newStatusKind,
    });
  }
  await publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });

  return updated;
}
