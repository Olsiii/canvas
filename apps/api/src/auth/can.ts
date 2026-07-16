import { ROLE_RANK, type MembershipRole } from "@canvas/shared";
import type { SessionUser } from "./session";

export type WorkspaceAction =
  | "workspace:invite"
  | "workspace:manage"
  | "workspace:delete"
  | "hierarchy:view"
  | "hierarchy:create"
  | "hierarchy:update"
  | "hierarchy:delete";

const MIN_ROLE: Record<WorkspaceAction, MembershipRole> = {
  "workspace:invite": "admin",
  "workspace:manage": "admin",
  "workspace:delete": "owner",
  "hierarchy:view": "guest",
  "hierarchy:create": "member",
  "hierarchy:update": "member",
  "hierarchy:delete": "admin",
};

export interface WorkspaceResource {
  type: "workspace";
  /** The acting user's membership role in this workspace, or null if not a member. */
  role: MembershipRole | null;
}

export function can(
  _user: SessionUser,
  action: WorkspaceAction,
  resource: WorkspaceResource,
): boolean {
  if (!resource.role) return false;
  return ROLE_RANK[resource.role] >= ROLE_RANK[MIN_ROLE[action]];
}
