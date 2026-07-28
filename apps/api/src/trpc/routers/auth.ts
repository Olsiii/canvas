import { db, schema } from "@canvas/db";
import { logInSchema, signUpSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { clearSessionCookie, setSessionCookie } from "../../auth/cookies";
import { hashPassword, verifyPassword } from "../../auth/password";
import { createSession, invalidateSession } from "../../auth/session";
import { assertAuthRateLimit, AuthRateLimitError } from "../../lib/rate-limit";
import { publicProcedure, protectedProcedure, router } from "../trpc";

// `X-Forwarded-For` is appended-to by each proxy hop, so its FIRST entry is
// whatever the client itself sent — trusting it unconditionally lets anyone
// bypass this rate limit by sending a fresh spoofed value on every request.
// Its LAST entry is the one added by the hop closest to us, which — for the
// single reverse proxy this app expects in front of it (see index.ts's
// `trustProxy: true` comment) — is the one we actually control and can
// trust. If the real deployment ever sits behind more than one hop, this
// (and `trustProxy`, currently a blanket `true`) needs to change to trust
// exactly that many hops, not fewer/more.
function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const hops = forwarded.split(",").map((h) => h.trim());
    const nearest = hops.at(-1);
    if (nearest) return nearest;
  }
  return req.ip ?? "unknown";
}

function tooManyRequests(): never {
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Try again in a minute.",
  });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signUp: publicProcedure.input(signUpSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertAuthRateLimit(clientIp(ctx.req));
    } catch (err) {
      if (err instanceof AuthRateLimitError) tooManyRequests();
      throw err;
    }

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, input.email),
    });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(schema.users)
      .values({ email: input.email, name: input.name, passwordHash })
      .returning();
    if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    if (input.inviteId) {
      const invite = await db.query.invites.findFirst({
        where: and(
          eq(schema.invites.id, input.inviteId),
          eq(schema.invites.email, input.email),
          isNull(schema.invites.acceptedAt),
        ),
      });
      if (invite && invite.expiresAt.getTime() > Date.now()) {
        await db.insert(schema.memberships).values({
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        });
        await db
          .update(schema.invites)
          .set({ acceptedAt: new Date() })
          .where(eq(schema.invites.id, invite.id));
        await db.insert(schema.activity).values({
          workspaceId: invite.workspaceId,
          actorId: user.id,
          entityType: "membership",
          entityId: user.id,
          verb: "invite.accepted",
        });
      }
    }

    const session = await createSession(user.id);
    setSessionCookie(ctx.res, session.id);

    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }),

  logIn: publicProcedure.input(logInSchema).mutation(async ({ ctx, input }) => {
    try {
      await assertAuthRateLimit(clientIp(ctx.req), input.email);
    } catch (err) {
      if (err instanceof AuthRateLimitError) tooManyRequests();
      throw err;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, input.email),
    });
    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
    }

    const session = await createSession(user.id);
    setSessionCookie(ctx.res, session.id);

    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }),

  logOut: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) {
      await invalidateSession(ctx.sessionId);
    }
    clearSessionCookie(ctx.res);
    return { ok: true as const };
  }),
});
