import { db, schema } from "@canvas/db";

export async function logActivity(
  workspaceId: string,
  actorId: string,
  entityType: string,
  entityId: string,
  verb: string,
  payloadJson?: unknown,
) {
  const [row] = await db
    .insert(schema.activity)
    .values({ workspaceId, actorId, entityType, entityId, verb, payloadJson })
    .returning();
  if (!row) throw new Error("Failed to insert activity row");
  return row;
}
