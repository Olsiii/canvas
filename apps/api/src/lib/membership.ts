import { db, schema } from "@canvas/db";
import { and, eq } from "drizzle-orm";

export async function getMembershipRole(workspaceId: string, userId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.workspaceId, workspaceId),
      eq(schema.memberships.userId, userId),
    ),
  });
  return membership?.role ?? null;
}

// Like getMembershipRole, but also surfaces the custom role id (if any) so
// callers that need to resolve grants/revokes (assertCan) don't have to
// re-query. Kept separate from getMembershipRole rather than changing its
// return shape — several call sites (workspace.ts's updateMemberRole/
// removeMember) destructure a plain role string directly.
export async function getMembershipContext(workspaceId: string, userId: string) {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.workspaceId, workspaceId),
      eq(schema.memberships.userId, userId),
    ),
  });
  return { role: membership?.role ?? null, customRoleId: membership?.customRoleId ?? null };
}
