import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew when <15 days left

export const SESSION_COOKIE_NAME = "canvas_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export async function createSession(userId: string) {
  const [session] = await db
    .insert(schema.sessions)
    .values({ userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .returning();
  return session!;
}

export async function validateSession(
  sessionId: string,
): Promise<{ session: typeof schema.sessions.$inferSelect; user: SessionUser } | null> {
  const [row] = await db
    .select({
      session: schema.sessions,
      user: {
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
      },
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, sessionId));

  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    return null;
  }

  if (row.session.expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(schema.sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(schema.sessions.id, sessionId));
    row.session.expiresAt = newExpiresAt;
  }

  return row;
}

export async function invalidateSession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}
