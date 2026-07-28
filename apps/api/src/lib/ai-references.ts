import { db, schema } from "@canvas/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getPresignedUrl } from "./storage";

export type ResolvedAiReference = {
  attachmentId: string;
  fileName: string;
  mime: string;
  imageVersionId: string | null;
  /** Presigned URL for image references only. */
  imageUrl: string | null;
};

/** Load workspace-scoped AI reference attachments; throws if any id is foreign. */
export async function resolveAiReferences(
  workspaceId: string,
  attachmentIds: string[],
): Promise<ResolvedAiReference[]> {
  if (attachmentIds.length === 0) return [];

  const rows = await db
    .select({
      id: schema.attachments.id,
      fileName: schema.attachments.fileName,
      mime: schema.attachments.mime,
      imageAssetId: schema.attachments.imageAssetId,
      currentVersionId: schema.imageAssets.currentVersionId,
      fileKey: schema.imageVersions.fileKey,
    })
    .from(schema.attachments)
    .leftJoin(
      schema.imageAssets,
      and(
        eq(schema.imageAssets.id, schema.attachments.imageAssetId),
        isNull(schema.imageAssets.deletedAt),
      ),
    )
    .leftJoin(
      schema.imageVersions,
      eq(schema.imageVersions.id, schema.imageAssets.currentVersionId),
    )
    .where(
      and(
        eq(schema.attachments.workspaceId, workspaceId),
        inArray(schema.attachments.id, attachmentIds),
      ),
    );

  if (rows.length !== attachmentIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more reference attachments were not found in this workspace",
    });
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ResolvedAiReference[] = [];
  for (const id of attachmentIds) {
    const row = byId.get(id)!;
    let imageUrl: string | null = null;
    if (row.fileKey) {
      imageUrl = await getPresignedUrl(row.fileKey);
    }
    out.push({
      attachmentId: row.id,
      fileName: row.fileName,
      mime: row.mime,
      imageVersionId: row.currentVersionId,
      imageUrl,
    });
  }
  return out;
}

/** Prompt suffix listing non-image references (files / videos). */
export function referenceContextSuffix(refs: ResolvedAiReference[]): string {
  const nonImage = refs.filter((r) => !r.imageVersionId);
  if (nonImage.length === 0) return "";
  const lines = nonImage.map((r) => `- ${r.fileName} (${r.mime})`);
  return `\n\nAttached reference files (use as context; contents are not extracted):\n${lines.join("\n")}`;
}
