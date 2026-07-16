import { db, schema } from "@canvas/db";

export async function logActivity(
  workspaceId: string,
  actorId: string,
  entityType: string,
  entityId: string,
  verb: string,
) {
  await db.insert(schema.activity).values({ workspaceId, actorId, entityType, entityId, verb });
}
