import { db, schema } from "@canvas/db";
import { and, eq } from "drizzle-orm";

// Single source of truth for "which brand kit applies here": an explicit
// choice (the user picked one directly in Generate or Brain) wins, then a
// space's own kit, then the workspace's is_default kit, otherwise none.
// Used by the brandKit.getEffective procedure, image generation's brand
// palette lookup, Brain's system-prompt context, and the image engine's
// provider selection, so all four agree on the same fallback rule.
export async function resolveEffectiveBrandKit({
  workspaceId,
  spaceId,
  brandKitId,
}: {
  workspaceId: string;
  spaceId?: string;
  brandKitId?: string | null;
}) {
  if (brandKitId) {
    const kit = await db.query.brandSettings.findFirst({
      where: and(
        eq(schema.brandSettings.id, brandKitId),
        eq(schema.brandSettings.workspaceId, workspaceId),
      ),
    });
    if (kit) return kit;
  }

  if (spaceId) {
    const space = await db.query.spaces.findFirst({
      where: eq(schema.spaces.id, spaceId),
    });
    if (space?.brandKitId) {
      const kit = await db.query.brandSettings.findFirst({
        where: eq(schema.brandSettings.id, space.brandKitId),
      });
      if (kit) return kit;
    }
  }

  return (
    (await db.query.brandSettings.findFirst({
      where: and(
        eq(schema.brandSettings.workspaceId, workspaceId),
        eq(schema.brandSettings.isDefault, true),
      ),
    })) ?? null
  );
}
