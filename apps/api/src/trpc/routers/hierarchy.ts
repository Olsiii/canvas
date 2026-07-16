import { db, schema } from "@canvas/db";
import type { SessionUser } from "../../auth/session";
import {
  createFolderSchema,
  createListSchema,
  createSpaceSchema,
  deleteFolderSchema,
  deleteListSchema,
  deleteSpaceSchema,
  listSpacesSchema,
  updateFolderSchema,
  updateListSchema,
  updateSpaceSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { can, type WorkspaceAction } from "../../auth/can";
import { getMembershipRole } from "../../lib/membership";
import { nextOrderKey } from "../../lib/order";
import { protectedProcedure, router } from "../trpc";

async function assertCan(user: SessionUser, workspaceId: string, action: WorkspaceAction) {
  const role = await getMembershipRole(workspaceId, user.id);
  if (!can(user, action, { type: "workspace", role })) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

async function requireSpace(spaceId: string) {
  const space = await db.query.spaces.findFirst({
    where: and(eq(schema.spaces.id, spaceId), isNull(schema.spaces.deletedAt)),
  });
  if (!space) throw new TRPCError({ code: "NOT_FOUND" });
  return space;
}

async function requireFolder(folderId: string) {
  const folder = await db.query.folders.findFirst({
    where: and(eq(schema.folders.id, folderId), isNull(schema.folders.deletedAt)),
  });
  if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
  return folder;
}

async function requireList(listId: string) {
  const list = await db.query.lists.findFirst({
    where: and(eq(schema.lists.id, listId), isNull(schema.lists.deletedAt)),
  });
  if (!list) throw new TRPCError({ code: "NOT_FOUND" });
  return list;
}

async function lastSpaceOrderKey(workspaceId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.spaces.orderKey })
    .from(schema.spaces)
    .where(and(eq(schema.spaces.workspaceId, workspaceId), isNull(schema.spaces.deletedAt)))
    .orderBy(desc(schema.spaces.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

async function lastFolderOrderKey(spaceId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.folders.orderKey })
    .from(schema.folders)
    .where(and(eq(schema.folders.spaceId, spaceId), isNull(schema.folders.deletedAt)))
    .orderBy(desc(schema.folders.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

async function lastListOrderKey(spaceId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.lists.orderKey })
    .from(schema.lists)
    .where(and(eq(schema.lists.spaceId, spaceId), isNull(schema.lists.deletedAt)))
    .orderBy(desc(schema.lists.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

async function logActivity(
  workspaceId: string,
  actorId: string,
  entityType: string,
  entityId: string,
  verb: string,
) {
  await db.insert(schema.activity).values({ workspaceId, actorId, entityType, entityId, verb });
}

export const hierarchyRouter = router({
  tree: protectedProcedure.input(listSpacesSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "hierarchy:view");

    const [spaceRows, folderRows, listRows] = await Promise.all([
      db
        .select()
        .from(schema.spaces)
        .where(
          and(eq(schema.spaces.workspaceId, input.workspaceId), isNull(schema.spaces.deletedAt)),
        )
        .orderBy(asc(schema.spaces.orderKey)),
      db
        .select({ folder: schema.folders })
        .from(schema.folders)
        .innerJoin(schema.spaces, eq(schema.spaces.id, schema.folders.spaceId))
        .where(
          and(eq(schema.spaces.workspaceId, input.workspaceId), isNull(schema.folders.deletedAt)),
        )
        .orderBy(asc(schema.folders.orderKey)),
      db
        .select({ list: schema.lists })
        .from(schema.lists)
        .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
        .where(
          and(eq(schema.spaces.workspaceId, input.workspaceId), isNull(schema.lists.deletedAt)),
        )
        .orderBy(asc(schema.lists.orderKey)),
    ]);

    return {
      spaces: spaceRows,
      folders: folderRows.map((r) => r.folder),
      lists: listRows.map((r) => r.list),
    };
  }),

  space: router({
    create: protectedProcedure.input(createSpaceSchema).mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "hierarchy:create");

      const lastKey = await lastSpaceOrderKey(input.workspaceId);

      const [space] = await db
        .insert(schema.spaces)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          icon: input.icon ?? null,
          orderKey: nextOrderKey(lastKey),
        })
        .returning();
      if (!space) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(input.workspaceId, ctx.user.id, "space", space.id, "space.created");
      return space;
    }),

    update: protectedProcedure.input(updateSpaceSchema).mutation(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:update");

      const [updated] = await db
        .update(schema.spaces)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.spaces.id, input.spaceId))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(space.workspaceId, ctx.user.id, "space", space.id, "space.updated");
      return updated;
    }),

    delete: protectedProcedure.input(deleteSpaceSchema).mutation(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:delete");

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(schema.spaces)
          .set({ deletedAt: now })
          .where(eq(schema.spaces.id, space.id));
        await tx
          .update(schema.folders)
          .set({ deletedAt: now })
          .where(eq(schema.folders.spaceId, space.id));
        await tx
          .update(schema.lists)
          .set({ deletedAt: now })
          .where(eq(schema.lists.spaceId, space.id));
      });

      await logActivity(space.workspaceId, ctx.user.id, "space", space.id, "space.deleted");
      return { id: space.id };
    }),
  }),

  folder: router({
    create: protectedProcedure.input(createFolderSchema).mutation(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:create");

      const lastKey = await lastFolderOrderKey(input.spaceId);

      const [folder] = await db
        .insert(schema.folders)
        .values({ spaceId: input.spaceId, name: input.name, orderKey: nextOrderKey(lastKey) })
        .returning();
      if (!folder) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(space.workspaceId, ctx.user.id, "folder", folder.id, "folder.created");
      return folder;
    }),

    update: protectedProcedure.input(updateFolderSchema).mutation(async ({ ctx, input }) => {
      const folder = await requireFolder(input.folderId);
      const space = await requireSpace(folder.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:update");

      const [updated] = await db
        .update(schema.folders)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(schema.folders.id, input.folderId))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(space.workspaceId, ctx.user.id, "folder", folder.id, "folder.updated");
      return updated;
    }),

    delete: protectedProcedure.input(deleteFolderSchema).mutation(async ({ ctx, input }) => {
      const folder = await requireFolder(input.folderId);
      const space = await requireSpace(folder.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:delete");

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(schema.folders)
          .set({ deletedAt: now })
          .where(eq(schema.folders.id, folder.id));
        await tx
          .update(schema.lists)
          .set({ deletedAt: now })
          .where(eq(schema.lists.folderId, folder.id));
      });

      await logActivity(space.workspaceId, ctx.user.id, "folder", folder.id, "folder.deleted");
      return { id: folder.id };
    }),
  }),

  list: router({
    create: protectedProcedure.input(createListSchema).mutation(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:create");

      if (input.folderId) {
        const folder = await requireFolder(input.folderId);
        if (folder.spaceId !== input.spaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Folder does not belong to this space",
          });
        }
      }

      const lastKey = await lastListOrderKey(input.spaceId);

      const [list] = await db
        .insert(schema.lists)
        .values({
          spaceId: input.spaceId,
          folderId: input.folderId ?? null,
          name: input.name,
          orderKey: nextOrderKey(lastKey),
        })
        .returning();
      if (!list) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(space.workspaceId, ctx.user.id, "list", list.id, "list.created");
      return list;
    }),

    update: protectedProcedure.input(updateListSchema).mutation(async ({ ctx, input }) => {
      const list = await requireList(input.listId);
      const space = await requireSpace(list.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:update");

      if (input.folderId) {
        const folder = await requireFolder(input.folderId);
        if (folder.spaceId !== list.spaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Folder does not belong to this space",
          });
        }
      }

      const [updated] = await db
        .update(schema.lists)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.lists.id, input.listId))
        .returning();
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(space.workspaceId, ctx.user.id, "list", list.id, "list.updated");
      return updated;
    }),

    delete: protectedProcedure.input(deleteListSchema).mutation(async ({ ctx, input }) => {
      const list = await requireList(input.listId);
      const space = await requireSpace(list.spaceId);
      await assertCan(ctx.user, space.workspaceId, "hierarchy:delete");

      await db
        .update(schema.lists)
        .set({ deletedAt: new Date() })
        .where(eq(schema.lists.id, list.id));

      await logActivity(space.workspaceId, ctx.user.id, "list", list.id, "list.deleted");
      return { id: list.id };
    }),
  }),
});
