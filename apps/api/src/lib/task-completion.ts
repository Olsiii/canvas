import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { logActivity } from "./activity";
import { nextOrderKey } from "./order";
import { notifyOperationsManagers } from "./notify";
import { publish } from "./realtime";
import {
  firstDoneStatusForList,
  lastTaskOrderKey,
  requireTask,
  workspaceIdForList,
} from "./task-queries";
import { buildTaskUpdateFields, computeCompletedAt, isDoneKind } from "./task-update";

/**
 * Marks a task done using its own list's default done-kind status —
 * for flows that don't offer a specific-status picker: the Home page's
 * quick-complete checkbox and a task-bound public form's submission.
 * `task.update` (trpc/routers/task.ts) stays the path for choosing an
 * exact status; this is a narrower, purpose-built sibling that always ends
 * with the same "task.completed" activity + ops-manager notification a
 * manual done-transition already gets.
 *
 * `actorId` is always a real user — the caller for the Home page checkbox,
 * or the form's own `createdBy` for a public (session-less) submission,
 * since `activity.actorId` is NOT NULL. `opts` lets a task-bound public
 * form record a distinct verb/payload (its submitter's self-reported name)
 * on the same completion activity, instead of the plain "task.completed"
 * a real logged-in actor's own completion gets.
 */
export async function completeTaskWithDefaultStatus(
  taskId: string,
  actorId: string,
  opts?: { verb?: string; extraPayload?: Record<string, unknown> },
) {
  const task = await requireTask(taskId);
  const workspaceId = await workspaceIdForList(task.listId);

  const currentStatus = await db.query.statuses.findFirst({
    where: eq(schema.statuses.id, task.statusId),
  });
  if (currentStatus && isDoneKind(currentStatus.kind)) {
    return task;
  }

  const doneStatus = await firstDoneStatusForList(task.listId);
  const completedAt = computeCompletedAt(doneStatus.kind, task.completedAt, new Date());
  const orderKey = nextOrderKey(await lastTaskOrderKey(task.listId, doneStatus.id));

  const [updated] = await db
    .update(schema.tasks)
    .set({
      ...buildTaskUpdateFields({ statusId: doneStatus.id, orderKey, completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, task.id))
    .returning();
  if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  await logActivity(workspaceId, actorId, "task", task.id, "task.updated");
  const completedActivity = await logActivity(
    workspaceId,
    actorId,
    "task",
    task.id,
    opts?.verb ?? "task.completed",
    { taskId: task.id, listId: task.listId, title: updated.title, ...opts?.extraPayload },
  );
  await notifyOperationsManagers(completedActivity.id, workspaceId);
  await publish(workspaceId, { entity: "task", id: task.id, listId: task.listId, kind: "updated" });

  return updated;
}
