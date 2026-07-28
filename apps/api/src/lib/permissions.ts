import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { WorkspaceAction } from "../auth/can";
import { can } from "../auth/can";
import type { SessionUser } from "../auth/session";
import { getMembershipContext } from "./membership";
import { getCustomRoleDeltas, getSpaceOverrideForMembership } from "./space-overrides";

/**
 * `opts.spaceId`, when passed, lets a Phase-6 space_permission_overrides row
 * decide the outcome outright for that one space — see can()'s
 * `spaceOverride` field. Omit it for actions with no space scope (most of
 * them); existing call sites are unaffected either way, since no override
 * rows exist unless an admin has explicitly created one for that space.
 */
export async function assertCan(
  user: SessionUser,
  workspaceId: string,
  action: WorkspaceAction,
  opts?: { spaceId?: string },
) {
  const membership = await getMembershipContext(workspaceId, user.id);
  const { role, customRoleId } = membership;
  const customRole = customRoleId ? await getCustomRoleDeltas(customRoleId) : null;
  const spaceOverride =
    opts?.spaceId && role
      ? await getSpaceOverrideForMembership(opts.spaceId, { role, customRoleId }, action)
      : null;

  if (!can(user, action, { type: "workspace", role, customRole, spaceOverride })) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/**
 * For account-level resources with no single workspace to check against —
 * currently just custom roles (owned by their creator, visible in every
 * workspace that creator belongs to; see role.ts's update/delete). Passes
 * if the user currently holds `action` in at least one of their
 * memberships, so a creator who's since been demoted or removed from every
 * workspace loses standing here too, same as any other admin-tier action
 * would require — ownership alone (checked separately by the caller) isn't
 * enough on its own.
 */
export async function assertCanInAnyWorkspace(user: SessionUser, action: WorkspaceAction) {
  const memberships = await db.query.memberships.findMany({
    where: eq(schema.memberships.userId, user.id),
  });

  for (const membership of memberships) {
    const customRole = membership.customRoleId
      ? await getCustomRoleDeltas(membership.customRoleId)
      : null;
    if (can(user, action, { type: "workspace", role: membership.role, customRole })) {
      return;
    }
  }

  throw new TRPCError({ code: "FORBIDDEN" });
}
