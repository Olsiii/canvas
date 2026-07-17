import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
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
