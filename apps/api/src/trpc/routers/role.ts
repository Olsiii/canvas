import { db, schema } from "@canvas/db";
import {
  assignCustomRoleSchema,
  createCustomRoleSchema,
  deleteCustomRoleSchema,
  deleteSpaceOverrideSchema,
  listCustomRolesSchema,
  listSpaceOverridesSchema,
  setSpaceOverrideSchema,
  updateCustomRoleSchema,
  type WorkspaceAction,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isGrantable } from "../../auth/can";
import { logActivity } from "../../lib/activity";
import { requireSpace } from "../../lib/hierarchy";
import { getMembershipRole } from "../../lib/membership";
import { assertCan, assertCanInAnyWorkspace } from "../../lib/permissions";
import { isRoleVisibleInWorkspace, principalKey } from "../../lib/space-overrides";
import { protectedProcedure, router } from "../trpc";

function assertGrantable(actions: WorkspaceAction[]) {
  const blocked = actions.filter((a) => !isGrantable(a));
  if (blocked.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `These actions can't be granted via a custom role or space override: ${blocked.join(", ")}`,
    });
  }
}

async function requireCustomRole(customRoleId: string) {
  const role = await db.query.customRoles.findFirst({
    where: and(eq(schema.customRoles.id, customRoleId), isNull(schema.customRoles.deletedAt)),
  });
  if (!role) throw new TRPCError({ code: "NOT_FOUND" });
  return role;
}

// A role has no single workspace of its own anymore (see PROGRESS.md's
// 2026-07-28 account-level decision), but the activity log is workspace-
// scoped by design — so an edit/delete gets logged into every workspace
// the role is currently visible in (every workspace its creator belongs
// to), rather than not logged at all.
async function logActivityEverywhereVisible(
  creatorId: string,
  actorId: string,
  entityId: string,
  verb: string,
) {
  const memberships = await db.query.memberships.findMany({
    where: eq(schema.memberships.userId, creatorId),
  });
  for (const membership of memberships) {
    await logActivity(membership.workspaceId, actorId, "custom_role", entityId, verb);
  }
}

export const roleRouter = router({
  // Account-level: every non-deleted role whose creator currently belongs
  // to this workspace, not just roles "created in" it — see
  // isRoleVisibleInWorkspace. A team running several workspaces sees the
  // same role library in each one instead of redefining it per workspace.
  list: protectedProcedure.input(listCustomRolesSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "customRole:view");

    const creatorIds = (
      await db
        .select({ userId: schema.memberships.userId })
        .from(schema.memberships)
        .where(eq(schema.memberships.workspaceId, input.workspaceId))
    ).map((m) => m.userId);
    if (creatorIds.length === 0) return [];

    return db.query.customRoles.findMany({
      where: and(
        inArray(schema.customRoles.createdBy, creatorIds),
        isNull(schema.customRoles.deletedAt),
      ),
      orderBy: (roles, { asc }) => asc(roles.name),
    });
  }),

  create: protectedProcedure.input(createCustomRoleSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "customRole:create");
    assertGrantable(input.grants);

    const [role] = await db
      .insert(schema.customRoles)
      .values({
        createdBy: ctx.user.id,
        name: input.name,
        baseRole: input.baseRole,
        grants: input.grants,
        revokes: input.revokes,
      })
      .returning();
    if (!role) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "custom_role", role.id, "customRole.created");
    return role;
  }),

  update: protectedProcedure.input(updateCustomRoleSchema).mutation(async ({ ctx, input }) => {
    const role = await requireCustomRole(input.customRoleId);
    // Ownership-based, not workspace-based — the role can be visible in
    // several workspaces at once, so "does the caller manage this
    // workspace" isn't a meaningful question here; only its creator edits
    // it, same as no one else being able to rename another user's saved
    // view or template. Ownership alone isn't enough on its own, though —
    // also require the creator to *currently* hold customRole:update
    // somewhere, so being demoted/removed from every workspace they once
    // administered actually revokes this, rather than leaving a stale
    // creator with permanent edit power over a role that's still assigned
    // to other people in workspaces they no longer belong to.
    if (role.createdBy !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await assertCanInAnyWorkspace(ctx.user, "customRole:update");
    if (input.grants) assertGrantable(input.grants);

    const [updated] = await db
      .update(schema.customRoles)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.baseRole !== undefined ? { baseRole: input.baseRole } : {}),
        ...(input.grants !== undefined ? { grants: input.grants } : {}),
        ...(input.revokes !== undefined ? { revokes: input.revokes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.customRoles.id, input.customRoleId))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivityEverywhereVisible(role.createdBy, ctx.user.id, role.id, "customRole.updated");
    return updated;
  }),

  delete: protectedProcedure.input(deleteCustomRoleSchema).mutation(async ({ ctx, input }) => {
    const role = await requireCustomRole(input.customRoleId);
    if (role.createdBy !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await assertCanInAnyWorkspace(ctx.user, "customRole:delete");

    // Members holding this role fall back to their base `role` rank — role
    // is NOT NULL on memberships regardless, so there's no floor to
    // restore, just the delta layer to remove.
    await db.transaction(async (tx) => {
      await tx
        .update(schema.memberships)
        .set({ customRoleId: null })
        .where(eq(schema.memberships.customRoleId, role.id));
      await tx
        .update(schema.customRoles)
        .set({ deletedAt: new Date() })
        .where(eq(schema.customRoles.id, role.id));
    });

    await logActivityEverywhereVisible(role.createdBy, ctx.user.id, role.id, "customRole.deleted");
    return { id: role.id };
  }),

  assignToMember: protectedProcedure
    .input(assignCustomRoleSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "customRole:update");

      if (input.customRoleId) {
        const role = await requireCustomRole(input.customRoleId);
        if (!(await isRoleVisibleInWorkspace(role.createdBy, input.workspaceId))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Role isn't available in this workspace",
          });
        }
      }

      const targetRole = await getMembershipRole(input.workspaceId, input.userId);
      if (!targetRole) throw new TRPCError({ code: "NOT_FOUND" });
      if (targetRole === "owner") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The workspace owner can't be assigned a custom role",
        });
      }

      await db
        .update(schema.memberships)
        .set({ customRoleId: input.customRoleId })
        .where(
          and(
            eq(schema.memberships.workspaceId, input.workspaceId),
            eq(schema.memberships.userId, input.userId),
          ),
        );

      await logActivity(
        input.workspaceId,
        ctx.user.id,
        "membership",
        input.userId,
        "customRole.assigned",
      );
      return { ok: true as const };
    }),

  spaceOverride: router({
    list: protectedProcedure.input(listSpaceOverridesSchema).query(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "spaceOverride:view");

      return db.query.spacePermissionOverrides.findMany({
        where: eq(schema.spacePermissionOverrides.spaceId, input.spaceId),
        orderBy: (overrides, { asc }) => asc(overrides.action),
      });
    }),

    set: protectedProcedure.input(setSpaceOverrideSchema).mutation(async ({ ctx, input }) => {
      const space = await requireSpace(input.spaceId);
      await assertCan(ctx.user, space.workspaceId, "spaceOverride:manage");

      if (input.role && input.customRoleId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An override targets either a role or a custom role, not both",
        });
      }
      if (!input.role && !input.customRoleId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An override needs a target principal",
        });
      }
      if (input.allow) assertGrantable([input.action]);

      let principal: string;
      if (input.customRoleId) {
        const role = await requireCustomRole(input.customRoleId);
        if (!(await isRoleVisibleInWorkspace(role.createdBy, space.workspaceId))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Role isn't available in this workspace",
          });
        }
        principal = principalKey({ customRoleId: input.customRoleId });
      } else {
        principal = principalKey({ role: input.role! });
      }

      const [override] = await db
        .insert(schema.spacePermissionOverrides)
        .values({ spaceId: input.spaceId, principal, action: input.action, allow: input.allow })
        .onConflictDoUpdate({
          target: [
            schema.spacePermissionOverrides.spaceId,
            schema.spacePermissionOverrides.principal,
            schema.spacePermissionOverrides.action,
          ],
          set: { allow: input.allow },
        })
        .returning();
      if (!override) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(
        space.workspaceId,
        ctx.user.id,
        "space_permission_override",
        override.id,
        "spaceOverride.set",
      );
      return override;
    }),

    delete: protectedProcedure.input(deleteSpaceOverrideSchema).mutation(async ({ ctx, input }) => {
      const override = await db.query.spacePermissionOverrides.findFirst({
        where: eq(schema.spacePermissionOverrides.id, input.overrideId),
      });
      if (!override) throw new TRPCError({ code: "NOT_FOUND" });
      const space = await requireSpace(override.spaceId);
      await assertCan(ctx.user, space.workspaceId, "spaceOverride:manage");

      await db
        .delete(schema.spacePermissionOverrides)
        .where(eq(schema.spacePermissionOverrides.id, override.id));

      await logActivity(
        space.workspaceId,
        ctx.user.id,
        "space_permission_override",
        override.id,
        "spaceOverride.deleted",
      );
      return { id: override.id };
    }),
  }),
});
