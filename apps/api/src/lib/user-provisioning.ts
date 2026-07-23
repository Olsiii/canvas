import { db, schema } from "@canvas/db";
import type { MembershipRole } from "@canvas/shared";
import { and, eq } from "drizzle-orm";

/**
 * Find-or-create by email, never touching an existing row — extracted
 * from Google OAuth's callback (routes/auth.ts, M0.2) so SAML SSO and SCIM
 * provisioning (Phase 6) share the exact same "an identity provider vouches
 * for this email" logic rather than three near-duplicate implementations.
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
