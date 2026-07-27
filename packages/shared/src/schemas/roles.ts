import { z } from "zod";
import { MEMBERSHIP_ROLES } from "../roles";
import { WORKSPACE_ACTIONS } from "../workspace-actions";

// Phase 6: custom roles + per-space permission overrides.

const actionEnum = z.enum(WORKSPACE_ACTIONS);

export const listCustomRolesSchema = z.object({ workspaceId: z.string().uuid() });

export const createCustomRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  baseRole: z.enum(MEMBERSHIP_ROLES).exclude(["owner"]),
  grants: z.array(actionEnum).max(WORKSPACE_ACTIONS.length),
  revokes: z.array(actionEnum).max(WORKSPACE_ACTIONS.length),
});

export const updateCustomRoleSchema = z.object({
  customRoleId: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  baseRole: z.enum(MEMBERSHIP_ROLES).exclude(["owner"]).optional(),
  grants: z.array(actionEnum).max(WORKSPACE_ACTIONS.length).optional(),
  revokes: z.array(actionEnum).max(WORKSPACE_ACTIONS.length).optional(),
});

export const deleteCustomRoleSchema = z.object({ customRoleId: z.string().uuid() });

export const assignCustomRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  customRoleId: z.string().uuid().nullable(),
});

export const listSpaceOverridesSchema = z.object({ spaceId: z.string().uuid() });

export const setSpaceOverrideSchema = z.object({
  spaceId: z.string().uuid(),
  // Exactly one of these identifies the principal this override applies to.
  role: z.enum(MEMBERSHIP_ROLES).optional(),
  customRoleId: z.string().uuid().optional(),
  action: actionEnum,
  allow: z.boolean(),
});

export const deleteSpaceOverrideSchema = z.object({ overrideId: z.string().uuid() });
