export const MEMBERSHIP_ROLES = ["owner", "admin", "member", "guest"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

// Higher number = more privilege. Used by apps/api/src/auth/can.ts.
export const ROLE_RANK: Record<MembershipRole, number> = {
  guest: 0,
  member: 1,
  admin: 2,
  owner: 3,
};
