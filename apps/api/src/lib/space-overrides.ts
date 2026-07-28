import { db, schema } from "@canvas/db";
import type { MembershipRole } from "@canvas/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { WorkspaceAction } from "../auth/can";

export type Principal = { role: MembershipRole } | { customRoleId: string };

// Synthetic principal key — pure, unit-tested (space-overrides.test.ts).
// Encodes exactly one of role/customRoleId so space_permission_overrides
// can enforce uniqueness on a single text column instead of two nullable
// ones (Postgres treats each NULL as distinct, which would defeat a unique
// constraint across nullable role/customRoleId columns).
export function principalKey(principal: Principal): string {
  return "role" in principal ? `role:${principal.role}` : `customRole:${principal.customRoleId}`;
}

export async function getCustomRoleDeltas(customRoleId: string) {
  const role = await db.query.customRoles.findFirst({
    where: and(eq(schema.customRoles.id, customRoleId), isNull(schema.customRoles.deletedAt)),
  });
  if (!role) return null;
  return {
    grants: (role.grants as WorkspaceAction[]) ?? [],
    revokes: (role.revokes as WorkspaceAction[]) ?? [],
  };
}

// A custom role is account-level (owned by its creator, not a single
// workspace — see PROGRESS.md's 2026-07-28 decision): it's usable for
// assignment/space-overrides in any workspace where the creator currently
// holds a membership. This is the one check every such call site shares.
export async function isRoleVisibleInWorkspace(
  roleCreatedBy: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, roleCreatedBy),
      eq(schema.memberships.workspaceId, workspaceId),
    ),
  });
  return !!membership;
}

export async function getSpaceOverride(
  spaceId: string,
  principal: Principal,
  action: WorkspaceAction,
): Promise<boolean | null> {
  const row = await db.query.spacePermissionOverrides.findFirst({
    where: and(
      eq(schema.spacePermissionOverrides.spaceId, spaceId),
      eq(schema.spacePermissionOverrides.principal, principalKey(principal)),
      eq(schema.spacePermissionOverrides.action, action),
    ),
  });
  return row?.allow ?? null;
}

// A membership with a custom role is checked against BOTH principals, most
// specific first: the custom role's own override, then a fallback to one
// targeting its base role. An admin locking down a space for "every guest"
// shouldn't be silently bypassed just because one guest also picked up an
// unrelated custom role — the custom-role override only takes priority when
// one actually exists for this exact action.
export async function getSpaceOverrideForMembership(
  spaceId: string,
  membership: { role: MembershipRole; customRoleId: string | null },
  action: WorkspaceAction,
): Promise<boolean | null> {
  if (membership.customRoleId) {
    const viaCustomRole = await getSpaceOverride(
      spaceId,
      { customRoleId: membership.customRoleId },
      action,
    );
    if (viaCustomRole !== null) return viaCustomRole;
  }
  return getSpaceOverride(spaceId, { role: membership.role }, action);
}
