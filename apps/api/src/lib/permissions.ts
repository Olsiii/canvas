import { TRPCError } from "@trpc/server";
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
