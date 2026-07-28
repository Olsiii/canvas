import { db, schema } from "@canvas/db";
import { and, eq } from "drizzle-orm";

// Shared by every notification-creating call site (comment/chat @mentions,
// task assignment, urgent-priority broadcasts) — a bare insert against an
// existing `activity` row, same shape everywhere. Extracted from what were
// three near-identical inline copies in comment.ts/chat.ts.
export async function notifyUsers(activityId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await db.insert(schema.notifications).values(unique.map((userId) => ({ userId, activityId })));
}

// Every member of a workspace, optionally excluding the actor (who doesn't
// need telling about their own action) — used for workspace-wide
// broadcasts like a task newly flagged urgent.
export async function notifyWorkspace(
  activityId: string,
  workspaceId: string,
  excludeUserId?: string,
) {
  const members = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(eq(schema.memberships.workspaceId, workspaceId));
  const userIds = members.map((m) => m.userId).filter((id) => id !== excludeUserId);
  await notifyUsers(activityId, userIds);
}

// Whoever's flagged isOperationsManager on a workspace's memberships. Split
// out from notifyOperationsManagers so a caller notifying about several
// activities in the same workspace (e.g. task.bulkUpdate) can look this up
// once instead of re-querying membership per activity.
export async function getOperationsManagerIds(workspaceId: string): Promise<string[]> {
  const managers = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.workspaceId, workspaceId),
        eq(schema.memberships.isOperationsManager, true),
      ),
    );
  return managers.map((m) => m.userId);
}

// Used when a task reaches a done-kind status, same "who should hear about
// this" reasoning as notifyWorkspace but narrowed to a named role instead of
// everyone.
export async function notifyOperationsManagers(activityId: string, workspaceId: string) {
  const managerIds = await getOperationsManagerIds(workspaceId);
  await notifyUsers(activityId, managerIds);
}
