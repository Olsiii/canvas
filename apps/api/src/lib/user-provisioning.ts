import { db, schema } from "@canvas/db";
import type { MembershipRole } from "@canvas/shared";
import { and, eq } from "drizzle-orm";

/**
 * Find-or-create by email, never touching an existing row — extracted
 * from Google OAuth's callback (routes/auth.ts, M0.2). Safe for Google OAuth
 * because Google itself is the one vouching for control of the email at
 * login time. SAML SSO and SCIM provisioning must NOT reuse this directly
 * for an *existing* user — see findOrCreateSsoUser below.
 */
export async function findOrCreateUserByEmail(
  email: string,
  name: string,
  avatarUrl: string | null = null,
) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing;

  const [created] = await db
    .insert(schema.users)
    .values({ email, name, avatarUrl, passwordHash: null })
    .returning();
  if (!created) throw new Error("Failed to create user");
  return created;
}

export class SsoIdentityConflictError extends Error {
  constructor(email: string) {
    super(
      `An account already exists for ${email} but isn't a member of this workspace yet. ` +
        "Ask a workspace admin to invite this address, then accept the invite before signing in via SSO.",
    );
    this.name = "SsoIdentityConflictError";
  }
}

/**
 * Find-or-create for SAML SSO and SCIM provisioning — NOT a drop-in for
 * findOrCreateUserByEmail. Each workspace registers its own SAML IdP
 * certificate (or SCIM token) with no domain verification, so a workspace's
 * own owner fully controls what that IdP is willing to assert. If an
 * existing *global* user row (e.g. one that signed up with a password, or
 * belongs to a different, unrelated workspace) were silently logged into or
 * attached to here just because the email string matches, any workspace
 * owner could self-configure a SAML IdP and forge an assertion for a
 * victim's email to hijack that victim's real account/session — full
 * account takeover with only the victim's email address, no interaction
 * required. (Found via security audit 2026-08-06.)
 *
 * The safe invariant: an IdP registered for workspace A may freely mint
 * *brand-new* identities (no existing account to take over), and may
 * authenticate a user who is *already a member of workspace A* (an
 * established relationship — that membership can only have been created by
 * an admin's invite + the real account holder explicitly accepting it while
 * already logged in as themselves, or by this exact SSO/SCIM path
 * previously). It may never silently attach to an existing account that has
 * no prior relationship with this workspace.
 */
export async function findOrCreateSsoUser(
  workspaceId: string,
  email: string,
  name: string,
  avatarUrl: string | null = null,
) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!existing) {
    const [created] = await db
      .insert(schema.users)
      .values({ email, name, avatarUrl, passwordHash: null })
      .returning();
    if (!created) throw new Error("Failed to create user");
    return created;
  }

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.workspaceId, workspaceId),
      eq(schema.memberships.userId, existing.id),
    ),
  });
  if (!membership) throw new SsoIdentityConflictError(email);

  return existing;
}

/**
 * Find-or-create a membership, never downgrading an existing one — an
 * SSO/SCIM re-provision of someone who's already a member (e.g. promoted
 * to admin by hand) must not silently reset them back to `defaultRole`.
 */
export async function ensureMembership(
  workspaceId: string,
  userId: string,
  defaultRole: MembershipRole,
) {
  const existing = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.workspaceId, workspaceId),
      eq(schema.memberships.userId, userId),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(schema.memberships)
    .values({ workspaceId, userId, role: defaultRole })
    .returning();
  if (!created) throw new Error("Failed to create membership");
  return created;
}
