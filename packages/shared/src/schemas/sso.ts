import { z } from "zod";
import { MEMBERSHIP_ROLES } from "../roles";

// Phase 6: SAML SSO + SCIM provisioning, one config/token set per workspace.

export const getSsoConfigSchema = z.object({ workspaceId: z.string().uuid() });

export const upsertSsoConfigSchema = z.object({
  workspaceId: z.string().uuid(),
  idpEntityId: z.string().trim().min(1).max(500),
  idpSsoUrl: z.string().trim().url(),
  idpCertificate: z.string().trim().min(1).max(10_000),
  // Never "owner" via auto-provisioning — same exclusion invite/
  // updateMemberRole already apply (schemas/workspace.ts).
  defaultRole: z.enum(MEMBERSHIP_ROLES).exclude(["owner"]),
  enabled: z.boolean(),
});

export const deleteSsoConfigSchema = z.object({ workspaceId: z.string().uuid() });

export const listScimTokensSchema = z.object({ workspaceId: z.string().uuid() });

export const createScimTokenSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const deleteScimTokenSchema = z.object({ scimTokenId: z.string().uuid() });
