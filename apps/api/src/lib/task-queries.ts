import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { requireList, requireSpace } from "./hierarchy";

export async function requireTask(taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(schema.tasks.id, taskId), isNull(schema.tasks.deletedAt)),
  });
  if (!task) throw new TRPCError({ code: "NOT_FOUND" });
  return task;
}

export async function workspaceIdForList(listId: string) {
  const list = await requireList(listId);
  const space = await requireSpace(list.spaceId);
  return space.workspaceId;
}

export async function workspaceIdForTask(taskId: string) {
  const task = await requireTask(taskId);
  return workspaceIdForList(task.listId);
}

// Extracted from trpc/routers/task.ts (M1.2) so the scheduler worker (M3.5:
// spawning a recurring task) can place a new task the same way task.create
// does, without duplicating the logic.
export async function firstStatusForList(listId: string) {
  const status = await db.query.statuses.findFirst({
    where: eq(schema.statuses.listId, listId),
    orderBy: asc(schema.statuses.orderKey),
  });
  if (!status) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This list has no statuses yet" });
  }
  return status;
}

export async function lastTaskOrderKey(listId: string, statusId: string): Promise<string | null> {
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
