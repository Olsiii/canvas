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
