import { db, schema } from "@canvas/db";
import {
  createImageFolderSchema,
  deleteImageFolderSchema,
  listImageFoldersSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

export const imageFolderRouter = router({
  list: protectedProcedure.input(listImageFoldersSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "imageFolder:view");

    return db.query.imageFolders.findMany({
      where: and(
        eq(schema.imageFolders.workspaceId, input.workspaceId),
        isNull(schema.imageFolders.deletedAt),
      ),
      orderBy: asc(schema.imageFolders.name),
    });
  }),

  create: protectedProcedure.input(createImageFolderSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "imageFolder:create");

    const [folder] = await db
      .insert(schema.imageFolders)
      .values({ workspaceId: input.workspaceId, name: input.name, createdBy: ctx.user.id })
      .returning();
    if (!folder) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(
      input.workspaceId,
      ctx.user.id,
      "image_folder",
      folder.id,
      "image_folder.created",
    );

    return folder;
  }),

  delete: protectedProcedure.input(deleteImageFolderSchema).mutation(async ({ ctx, input }) => {
    const folder = await db.query.imageFolders.findFirst({
      where: and(eq(schema.imageFolders.id, input.folderId), isNull(schema.imageFolders.deletedAt)),
    });
    if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, folder.workspaceId, "imageFolder:delete");

    // System-managed (Copywriter's auto-provisioned Copy > brand-kit
    // hierarchy, see lib/copy-library.ts) — the web UI already hides the
    // delete control for these, but that's not a server-side guarantee on
    // its own; enforce it here too.
    if (folder.kind !== "custom") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This folder is managed automatically and can't be deleted directly",
      });
    }

    // Only one level of nesting ever exists (the Copywriter's "Copy" root ->
    // one child per brand kit — see lib/copy-library.ts), so a plain
    // (non-recursive) child lookup covers every folder this delete can
    // possibly cascade into.
    const children = await db.query.imageFolders.findMany({
      where: and(
        eq(schema.imageFolders.parentFolderId, folder.id),
        isNull(schema.imageFolders.deletedAt),
      ),
    });
    const folderIds = [folder.id, ...children.map((c) => c.id)];

    // Organization, not ownership — the images/saved copy themselves stay,
    // just unfiled.
    for (const id of folderIds) {
      await db
        .update(schema.imageAssets)
        .set({ folderId: null, updatedAt: new Date() })
        .where(eq(schema.imageAssets.folderId, id));
      await db
        .update(schema.libraryCopyItems)
        .set({ folderId: null, updatedAt: new Date() })
        .where(eq(schema.libraryCopyItems.folderId, id));
    }

    const now = new Date();
    for (const id of folderIds) {
      await db
        .update(schema.imageFolders)
        .set({ deletedAt: now })
        .where(eq(schema.imageFolders.id, id));
    }

    await logActivity(
      folder.workspaceId,
      ctx.user.id,
      "image_folder",
      folder.id,
      "image_folder.deleted",
    );

    return { id: folder.id };
  }),
});
