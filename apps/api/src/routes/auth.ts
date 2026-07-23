import { generateCodeVerifier, generateState, OAuth2RequestError } from "arctic";
import type { FastifyInstance } from "fastify";
import { setSessionCookie } from "../auth/cookies";
import { fetchGoogleUserInfo, getGoogleClient } from "../auth/google";
import { createSession } from "../auth/session";
import { env } from "../env";
import { findOrCreateUserByEmail } from "../lib/user-provisioning";

const OAUTH_STATE_COOKIE = "canvas_oauth_state";
const OAUTH_VERIFIER_COOKIE = "canvas_oauth_verifier";
const OAUTH_COOKIE_MAX_AGE_SEC = 60 * 10;

export function registerAuthRoutes(app: FastifyInstance) {
  app.get("/auth/google", async (req, reply) => {
    const google = getGoogleClient();
    if (!google) {
      return reply.redirect(`${env.WEB_URL}/login?error=google_not_configured`);
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: OAUTH_COOKIE_MAX_AGE_SEC,
    });
    reply.setCookie(OAUTH_VERIFIER_COOKIE, codeVerifier, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: OAUTH_COOKIE_MAX_AGE_SEC,
    });

    const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/auth/google/callback",
    async (req, reply) => {
      const google = getGoogleClient();
      const { code, state } = req.query;
      const storedState = req.cookies[OAUTH_STATE_COOKIE];
      const codeVerifier = req.cookies[OAUTH_VERIFIER_COOKIE];

      reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      reply.clearCookie(OAUTH_VERIFIER_COOKIE, { path: "/" });

      if (!google || !code || !state || !storedState || !codeVerifier || state !== storedState) {
        return reply.redirect(`${env.WEB_URL}/login?error=google_oauth_failed`);
      }

      try {
        const tokens = await google.validateAuthorizationCode(code, codeVerifier);
        const googleUser = await fetchGoogleUserInfo(tokens.accessToken());
        const user = await findOrCreateUserByEmail(
          googleUser.email,
          googleUser.name,
          googleUser.picture ?? null,
        );

        const session = await createSession(user.id);
        setSessionCookie(reply, session.id);

        return reply.redirect(`${env.WEB_URL}/`);
      } catch (err) {
        req.log.error(err);
        if (err instanceof OAuth2RequestError) {
          return reply.redirect(`${env.WEB_URL}/login?error=google_oauth_failed`);
        }
        return reply.redirect(`${env.WEB_URL}/login?error=google_oauth_failed`);
      }
    },
  );
}
