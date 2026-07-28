import { ROLE_RANK, type MembershipRole, type WorkspaceAction } from "@canvas/shared";
import type { SessionUser } from "./session";

export type { WorkspaceAction };

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
  "imageAsset:view": "guest",
  // Generating an image costs real money (ai_usage) — same tier as
  // creating a task, not the guest-level "view" tier.
  "imageAsset:create": "member",
  // Same tier as attachment:delete — removing a saved image from the
  // library is ordinary content upkeep, not a workspace-wide concern.
  "imageAsset:delete": "member",
  "imageFolder:view": "guest",
  // Same tier as imageAsset:create/delete — a folder is organizational, and
  // deleting one only unfiles its images rather than deleting them, so it
  // doesn't need tag:delete's admin tier (which removes a tag from every
  // task that has it, a bigger blast radius).
  "imageFolder:create": "member",
  "imageFolder:delete": "member",
  "brain:view": "guest",
  // Sending a chat message costs real money (ai_usage), same reasoning as
  // imageAsset:create.
  "brain:chat": "member",
  "brandSettings:view": "guest",
  // Workspace brand is an admin concern (same tier as workspace:manage).
  "brandSettings:update": "admin",
  "taskTemplate:view": "guest",
  "taskTemplate:create": "member",
  // Same reasoning as tag:delete — a template is a shared workspace
  // resource other members' "new from template" flow depends on.
  "taskTemplate:delete": "admin",
  "doc:view": "guest",
  "doc:create": "member",
  "doc:update": "member",
  "doc:delete": "member",
  // This is the workspace-role floor only. Private channels add a
  // resource-level channel_members check on top (see chat.ts's
  // requireChannelAccess) — the same "role check here, ownership/membership
  // check in the router" split doc.ts already uses for doc_task_links.
  "channel:view": "guest",
  "channel:create": "member",
  // Same reasoning as comment:create: posting in a channel you can already
  // see is participation, not a workspace mutation.
  "message:create": "guest",
  // Same tiers as doc:* — a form is ordinary workspace content, not a
  // shared cross-cutting resource like a tag or template. (Public,
  // unauthenticated submission goes through form.submitPublic, which has
  // no session user and so never calls `can` at all.)
  "form:view": "guest",
  "form:create": "member",
  "form:update": "member",
  "form:delete": "member",
  // Admin tier, unlike form:*/doc:* — an automation runs unattended against
  // every matching task in the workspace and can generate billable AI
  // usage (generate_image), same blast-radius reasoning as
  // brandSettings:update.
  "automation:view": "member",
  "automation:create": "admin",
  "automation:update": "admin",
  "automation:delete": "admin",
  // Member tier, not guest — a dashboard can surface AI usage cost (a
  // financial figure), a step up in sensitivity from ordinary task content
  // that guest-tier views (workload, docs, forms) show. Not admin-only like
  // automations: a dashboard is read-only reporting with no side effects on
  // other members' data, closer in blast radius to a doc than an automation.
  "dashboard:view": "member",
  "dashboard:create": "member",
  "dashboard:update": "member",
  "dashboard:delete": "member",
  // Same tiers as doc:*/form:* — a goal is ordinary workspace content, not
  // a financial-reporting surface like dashboard:* (which can show AI
  // cost) or a blast-radius concern like automation:*.
  "goal:view": "guest",
  "goal:create": "member",
  "goal:update": "member",
  "goal:delete": "member",
  // Admin tier — an API key grants ongoing programmatic access to the
  // whole workspace (scoped only by its creator's own role, see
  // schema/api-platform.ts), and a webhook forwards event data plus a
  // signing secret to an arbitrary external URL. Both are credential-
  // shaped, same blast-radius tier as automation:create.
  "apiKey:view": "admin",
  "apiKey:create": "admin",
  "apiKey:delete": "admin",
  "webhook:view": "admin",
  "webhook:create": "admin",
  "webhook:delete": "admin",
  // Admin tier — an import can bulk-create an entire workspace's worth of
  // spaces/lists/tasks in one run. Same blast-radius reasoning as
  // apiKey:create/webhook:create.
  "import:run": "admin",
  // Same tiers as attachment:* — linking a PR to a task is a task edit,
  // not a workspace-wide credential or bulk-mutation concern.
  "prLink:view": "guest",
  "prLink:create": "member",
  "prLink:delete": "member",
  // Owner tier for the mutating actions — enabling/editing SSO changes how
  // *every* member of the workspace authenticates, and a SCIM token is a
  // standing grant for an external system to add/remove members. Bigger
  // blast radius than an admin-tier credential like an API key or webhook
  // (those only grant what their creator could already do); this changes
  // who can get in at all. Viewing the current config is lower-risk,
  // admin tier, same as apiKey:view/webhook:view.
  "sso:view": "admin",
  "sso:update": "owner",
  "scimToken:view": "admin",
  "scimToken:create": "owner",
  "scimToken:delete": "owner",
  // Admin tier, same as automation:create/apiKey:create — defining or
  // assigning a custom role changes what OTHER members can do, a bigger
  // blast radius than ordinary content but not an authentication/standing-
  // access concern like sso:update/scimToken:*. Privilege escalation is
  // capped structurally instead (see isGrantable/NON_GRANTABLE below): an
  // admin can never grant an owner-only action through a custom role or
  // space override, so this tier can't be used to mint a second owner.
  "customRole:view": "admin",
  "customRole:create": "admin",
  "customRole:update": "admin",
  "customRole:delete": "admin",
  "spaceOverride:view": "admin",
  "spaceOverride:manage": "admin",
  // Admin tier, same reasoning as import:run — a bulk export is the read-
  // side mirror of a bulk import (an entire workspace's worth of content
  // leaving the app in one file, rather than entering it), same blast-
  // radius tier as any other whole-workspace bulk operation.
  "export:run": "admin",
  // Admin tier — seeing every member's individual time entries and AI
  // spend across the whole workspace is a bigger blast radius than
  // dashboard:view's pre-aggregated cost figure (member tier); grantable
  // via a custom role (e.g. a "Finance Manager" template) same as any
  // other admin-tier action above.
  "timeEntry:viewAll": "admin",
};

// Actions a custom role's grants or a space override's `allow: true` can
// never include — same reasoning as sso:update/scimToken:* themselves:
// these change who has standing, workspace-wide destructive/authentication
// power, and must stay strictly rank-gated so an admin can't use
// customRole:create (its own admin-tier action) to mint a second owner.
export function isGrantable(action: WorkspaceAction): boolean {
  return MIN_ROLE[action] !== "owner";
}

export interface WorkspaceResource {
  type: "workspace";
  /** The acting user's membership role in this workspace, or null if not a member. */
  role: MembershipRole | null;
  /**
   * Set when the membership has a custom role: permission deltas layered on
   * top of `role`'s rank. `revokes` beats `grants` beats the rank table.
   */
  customRole?: { grants: WorkspaceAction[]; revokes: WorkspaceAction[] } | null;
  /**
   * Set when a space-level override was resolved for this exact
   * (space, principal, action) — see lib/space-overrides.ts. The most
   * specific layer: when present it decides the outcome outright, ahead of
   * both the custom role and the rank table.
   */
  spaceOverride?: boolean | null;
}

export function can(
  _user: SessionUser,
  action: WorkspaceAction,
  resource: WorkspaceResource,
): boolean {
  if (!resource.role) return false;
  if (resource.spaceOverride !== undefined && resource.spaceOverride !== null) {
    return resource.spaceOverride;
  }

  const baseAllowed = ROLE_RANK[resource.role] >= ROLE_RANK[MIN_ROLE[action]];
  if (!resource.customRole) return baseAllowed;
  if (resource.customRole.revokes.includes(action)) return false;
  if (resource.customRole.grants.includes(action)) return true;
  return baseAllowed;
}
