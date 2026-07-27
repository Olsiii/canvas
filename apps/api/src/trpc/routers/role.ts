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
import { and, eq, isNull } from "drizzle-orm";
import { isGrantable } from "../../auth/can";
import { logActivity } from "../../lib/activity";
import { requireSpace } from "../../lib/hierarchy";
import { getMembershipRole } from "../../lib/membership";
import { assertCan } from "../../lib/permissions";
import { principalKey } from "../../lib/space-overrides";
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

export const roleRouter = router({
  list: protectedProcedure.input(listCustomRolesSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "customRole:view");

    return db.query.customRoles.findMany({
      where: and(
        eq(schema.customRoles.workspaceId, input.workspaceId),
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
        workspaceId: input.workspaceId,
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
    await assertCan(ctx.user, role.workspaceId, "customRole:update");
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

    await logActivity(role.workspaceId, ctx.user.id, "custom_role", role.id, "customRole.updated");
    return updated;
  }),

  delete: protectedProcedure.input(deleteCustomRoleSchema).mutation(async ({ ctx, input }) => {
    const role = await requireCustomRole(input.customRoleId);
    await assertCan(ctx.user, role.workspaceId, "customRole:delete");

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

    await logActivity(role.workspaceId, ctx.user.id, "custom_role", role.id, "customRole.deleted");
    return { id: role.id };
  }),

  assignToMember: protectedProcedure
    .input(assignCustomRoleSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "customRole:update");

      if (input.customRoleId) {
        const role = await requireCustomRole(input.customRoleId);
        if (role.workspaceId !== input.workspaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Role belongs to a different workspace",
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
        if (role.workspaceId !== space.workspaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Role belongs to a different workspace",
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
