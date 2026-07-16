import { db, schema } from "@canvas/db";
import { logInSchema, signUpSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { clearSessionCookie, setSessionCookie } from "../../auth/cookies";
import { hashPassword, verifyPassword } from "../../auth/password";
import { createSession, invalidateSession } from "../../auth/session";
import { publicProcedure, protectedProcedure, router } from "../trpc";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signUp: publicProcedure.input(signUpSchema).mutation(async ({ ctx, input }) => {
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
