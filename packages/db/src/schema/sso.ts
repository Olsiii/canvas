import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./auth";
import { membershipRole, workspaces } from "./workspaces";

// Phase 6: SAML SSO, one IdP per workspace (SP-initiated). Not in
// DATA_MODEL.md — Phase 6 isn't detailed there. `workspaceId` is unique: a
// workspace has at most one SSO configuration, same "one row per scope"
// shape as M5.2's brand_settings.
export const ssoConfigs = pgTable("sso_configs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  idpEntityId: text("idp_entity_id").notNull(),
  idpSsoUrl: text("idp_sso_url").notNull(),
  idpCertificate: text("idp_certificate").notNull(),
  // The role a brand-new SSO-provisioned member gets. An existing member
  // who already has a membership keeps whatever role they have — SSO login
  // never touches an existing membership row, same as Google OAuth's
  // find-or-create never downgrading an existing user.
  defaultRole: membershipRole("default_role").notNull().default("member"),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// SCIM provisioning tokens — same hash-only-storage shape as M5.4's
// api_keys (see lib/scim-token.ts), scoped to one workspace each. Unlike
// an API key, a SCIM token has no creator-role to inherit through `can()`:
// its own existence/hash match IS the authorization to manage that
// workspace's membership list (see routes/scim.ts).
export const scimTokens = pgTable("scim_tokens", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hash: text("hash").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
