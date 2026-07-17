import { db, schema } from "@canvas/db";
import {
  acceptInviteSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  listMembersSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { can } from "../../auth/can";
import { getMembershipRole } from "../../lib/membership";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "workspace"
  );
}

export const workspaceRouter = router({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ workspace: schema.workspaces, role: schema.memberships.role })
      .from(schema.memberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
      .where(eq(schema.memberships.userId, ctx.user.id));
    return rows;
  }),

  members: protectedProcedure.input(listMembersSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "hierarchy:view");

    return db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        role: schema.memberships.role,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.workspaceId, input.workspaceId));
  }),

  create: protectedProcedure.input(createWorkspaceSchema).mutation(async ({ ctx, input }) => {
    const base = slugify(input.name);
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.query.workspaces.findFirst({
        where: eq(schema.workspaces.slug, slug),
      });
      if (!existing) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const [workspace] = await db
      .insert(schema.workspaces)
      .values({ name: input.name, slug })
      .returning();
    if (!workspace) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.insert(schema.memberships).values({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      role: "owner",
    });

    await db.insert(schema.activity).values({
      workspaceId: workspace.id,
      actorId: ctx.user.id,
      entityType: "workspace",
      entityId: workspace.id,
      verb: "workspace.created",
    });

    return workspace;
  }),

  invite: protectedProcedure.input(inviteMemberSchema).mutation(async ({ ctx, input }) => {
    const role = await getMembershipRole(input.workspaceId, ctx.user.id);
    if (!can(ctx.user, "workspace:invite", { type: "workspace", role })) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const [invite] = await db
      .insert(schema.invites)
      .values({
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        invitedBy: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning();
    if (!invite) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.insert(schema.activity).values({
      workspaceId: input.workspaceId,
      actorId: ctx.user.id,
      entityType: "invite",
      entityId: invite.id,
      verb: "invite.created",
    });

    // No email delivery yet (Phase 1 notifications). The caller surfaces the link.
    return invite;
  }),

  getInvite: publicProcedure.input(acceptInviteSchema).query(async ({ input }) => {
    const invite = await db.query.invites.findFirst({
      where: eq(schema.invites.id, input.inviteId),
    });
    if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.id, invite.workspaceId),
    });
    if (!workspace) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      email: invite.email,
      role: invite.role,
      workspaceName: workspace.name,
      expired: invite.expiresAt.getTime() < Date.now(),
      accepted: invite.acceptedAt !== null,
    };
  }),

  acceptInvite: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    const invite = await db.query.invites.findFirst({
      where: and(eq(schema.invites.id, input.inviteId), isNull(schema.invites.acceptedAt)),
    });
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invite is invalid or expired" });
    }
    if (invite.email !== ctx.user.email) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This invite was sent to a different email address",
      });
    }

    const existingMembership = await getMembershipRole(invite.workspaceId, ctx.user.id);
    if (!existingMembership) {
      await db.insert(schema.memberships).values({
        workspaceId: invite.workspaceId,
        userId: ctx.user.id,
        role: invite.role,
      });
    }

    await db
      .update(schema.invites)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.invites.id, invite.id));

    await db.insert(schema.activity).values({
      workspaceId: invite.workspaceId,
      actorId: ctx.user.id,
      entityType: "membership",
      entityId: ctx.user.id,
      verb: "invite.accepted",
    });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.id, invite.workspaceId),
    });
    return workspace;
  }),

  updateMemberRole: protectedProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const role = await getMembershipRole(input.workspaceId, ctx.user.id);
      if (!can(ctx.user, "workspace:manage", { type: "workspace", role })) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const targetRole = await getMembershipRole(input.workspaceId, input.userId);
      if (!targetRole) throw new TRPCError({ code: "NOT_FOUND" });
      if (targetRole === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The workspace owner's role can't be changed" });
      }

      await db
        .update(schema.memberships)
        .set({ role: input.role })
        .where(
          and(
            eq(schema.memberships.workspaceId, input.workspaceId),
            eq(schema.memberships.userId, input.userId),
          ),
        );

      await db.insert(schema.activity).values({
        workspaceId: input.workspaceId,
        actorId: ctx.user.id,
        entityType: "membership",
        entityId: input.userId,
        verb: "membership.role_changed",
      });

      return { userId: input.userId, role: input.role };
    }),

  removeMember: protectedProcedure.input(removeMemberSchema).mutation(async ({ ctx, input }) => {
    const role = await getMembershipRole(input.workspaceId, ctx.user.id);
    if (!can(ctx.user, "workspace:manage", { type: "workspace", role })) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const targetRole = await getMembershipRole(input.workspaceId, input.userId);
    if (!targetRole) throw new TRPCError({ code: "NOT_FOUND" });
    if (targetRole === "owner") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The workspace owner can't be removed" });
    }

    await db
      .delete(schema.memberships)
      .where(
        and(
          eq(schema.memberships.workspaceId, input.workspaceId),
          eq(schema.memberships.userId, input.userId),
        ),
      );

    await db.insert(schema.activity).values({
      workspaceId: input.workspaceId,
      actorId: ctx.user.id,
      entityType: "membership",
      entityId: input.userId,
      verb: "membership.removed",
    });

    return { userId: input.userId };
  }),
});
