import { ROLE_RANK, type MembershipRole } from "@canvas/shared";
import type { SessionUser } from "./session";

export type WorkspaceAction =
  | "workspace:invite"
  | "workspace:manage"
  | "workspace:delete"
  | "hierarchy:view"
  | "hierarchy:create"
  | "hierarchy:update"
  | "hierarchy:delete"
  | "status:view"
  | "status:create"
  | "status:update"
  | "status:delete"
  | "task:view"
  | "task:create"
  | "task:update"
  | "task:delete"
  | "comment:view"
  | "comment:create"
  | "tag:view"
  | "tag:create"
  | "tag:delete"
  | "customFieldDef:view"
  | "customFieldDef:create"
  | "customFieldDef:update"
  | "customFieldDef:delete"
  | "customFieldValue:update"
  | "attachment:view"
  | "attachment:create"
  | "attachment:delete";

const MIN_ROLE: Record<WorkspaceAction, MembershipRole> = {
  "workspace:invite": "admin",
  "workspace:manage": "admin",
  "workspace:delete": "owner",
  "hierarchy:view": "guest",
  "hierarchy:create": "member",
  "hierarchy:update": "member",
  "hierarchy:delete": "admin",
  "status:view": "guest",
  "status:create": "member",
  "status:update": "member",
  "status:delete": "admin",
  "task:view": "guest",
  "task:create": "member",
  "task:update": "member",
  "task:delete": "member",
  "comment:view": "guest",
  // Deliberately guest-level, unlike task:create: commenting is how a
  // guest participates in a task they can already see, not a change to the
  // task itself.
  "comment:create": "guest",
  "tag:view": "guest",
  "tag:create": "member",
  // Deleting a tag removes it from every task that has it — same
  // destructiveness tier as hierarchy:delete/status:delete.
  "tag:delete": "admin",
  "customFieldDef:view": "guest",
  "customFieldDef:create": "member",
  "customFieldDef:update": "member",
  "customFieldDef:delete": "admin",
  // Setting a task's own field value is a task edit, same tier as task:update.
  "customFieldValue:update": "member",
  "attachment:view": "guest",
  // Uploading/removing a file is a task edit, same tier as task:update.
  "attachment:create": "member",
  "attachment:delete": "member",
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
