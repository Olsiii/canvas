import { db, schema } from "@canvas/db";
import { and, eq, isNull, type SQL } from "drizzle-orm";

const COPY_ROOT_FOLDER_NAME = "Copy";

// Finds (or lazily creates) the workspace's single "Copy" root folder and
// the one child folder for this specific brand kit — Library > Copy >
// <brand kit>. Both are DB-unique per workspace/brand-kit (see the partial
// unique indexes on image_folders), so a race between two concurrent saves
// can't create duplicates; `onConflictDoNothing` + a re-select covers that
// race without needing a transaction.
export async function ensureCopyLibraryFolder(
  workspaceId: string,
  brandKitId: string,
  brandKitName: string,
  createdBy: string,
): Promise<string> {
  const root = await findOrCreateFolder({
    workspaceId,
    createdBy,
    name: COPY_ROOT_FOLDER_NAME,
    kind: "copy_root",
    where: and(
      eq(schema.imageFolders.workspaceId, workspaceId),
      eq(schema.imageFolders.kind, "copy_root"),
      isNull(schema.imageFolders.deletedAt),
    ),
  });

  const client = await findOrCreateFolder({
    workspaceId,
    createdBy,
    name: brandKitName,
    kind: "copy_client",
    parentFolderId: root.id,
    brandKitId,
    where: and(
      eq(schema.imageFolders.workspaceId, workspaceId),
      eq(schema.imageFolders.kind, "copy_client"),
      eq(schema.imageFolders.brandKitId, brandKitId),
      isNull(schema.imageFolders.deletedAt),
    ),
  });

  return client.id;
}

async function findOrCreateFolder(args: {
  workspaceId: string;
  createdBy: string;
  name: string;
  kind: "copy_root" | "copy_client";
  parentFolderId?: string;
  brandKitId?: string;
  where: SQL | undefined;
}) {
  const existing = await db.query.imageFolders.findFirst({ where: args.where });
  if (existing) return existing;

  const [created] = await db
    .insert(schema.imageFolders)
    .values({
      workspaceId: args.workspaceId,
      name: args.name,
      kind: args.kind,
      parentFolderId: args.parentFolderId ?? null,
      brandKitId: args.brandKitId ?? null,
      createdBy: args.createdBy,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost the create race — the unique index rejected our insert, so the
  // winning row is there now.
  const winner = await db.query.imageFolders.findFirst({ where: args.where });
  if (!winner) throw new Error(`Failed to find or create folder "${args.name}"`);
  return winner;
}
