import { db, schema } from "@canvas/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { setSessionCookie } from "../auth/cookies";
import { buildMetadataOnlySamlClient, buildSamlClient } from "../auth/saml";
import { createSession } from "../auth/session";
import { env } from "../env";
import {
  ensureMembership,
  findOrCreateSsoUser,
  SsoIdentityConflictError,
} from "../lib/user-provisioning";

async function requireEnabledSsoConfig(workspaceId: string) {
  return db.query.ssoConfigs.findFirst({
    where: and(eq(schema.ssoConfigs.workspaceId, workspaceId), eq(schema.ssoConfigs.enabled, true)),
  });
}

/**
 * SP-initiated SAML SSO, one IdP per workspace. Registered alongside
 * /auth/google (routes/auth.ts) as a second login path — this one keyed by
 * workspaceId in the URL rather than a single global entry point, since
 * each workspace brings its own IdP.
 */
export function registerSamlRoutes(app: FastifyInstance) {
  app.get<{ Params: { workspaceId: string } }>(
    "/auth/saml/:workspaceId/login",
    async (req, reply) => {
      const config = await requireEnabledSsoConfig(req.params.workspaceId);
      if (!config) {
        return reply.redirect(`${env.WEB_URL}/login?error=sso_not_configured`);
      }

      try {
        const client = buildSamlClient(config, req.params.workspaceId);
        const url = await client.getAuthorizeUrlAsync("", undefined, {});
        return reply.redirect(url);
      } catch (err) {
        req.log.error(err);
        return reply.redirect(`${env.WEB_URL}/login?error=sso_failed`);
      }
    },
  );

  app.post<{
    Params: { workspaceId: string };
    Body: { SAMLResponse?: string; RelayState?: string };
  }>("/auth/saml/:workspaceId/callback", async (req, reply) => {
    const { workspaceId } = req.params;
    const config = await requireEnabledSsoConfig(workspaceId);
    const samlResponse = req.body?.SAMLResponse;
    if (!config || !samlResponse) {
      return reply.redirect(`${env.WEB_URL}/login?error=sso_failed`);
    }

    try {
      const client = buildSamlClient(config, workspaceId);
      const { profile } = await client.validatePostResponseAsync({ SAMLResponse: samlResponse });
      if (!profile)
        throw new Error("SAML response carried no profile (this was a logout, not a login)");

      // Prefer an explicit email attribute; fall back to NameID, the one
      // field every SAML assertion is guaranteed to carry — standard
      // practice when the IdP is configured with NameID format
      // "emailAddress" (the common case for workforce SSO).
      const email = (typeof profile.email === "string" && profile.email) || profile.nameID;
      const displayName =
        (typeof profile.displayName === "string" && profile.displayName) ||
        (typeof profile.firstName === "string" && typeof profile.lastName === "string"
          ? `${profile.firstName} ${profile.lastName}`
          : email.split("@")[0]!);

      const user = await findOrCreateSsoUser(workspaceId, email, displayName);
      await ensureMembership(workspaceId, user.id, config.defaultRole);

      const session = await createSession(user.id);
      setSessionCookie(reply, session.id);

      return reply.redirect(`${env.WEB_URL}/w/${workspaceId}`);
    } catch (err) {
      if (err instanceof SsoIdentityConflictError) {
        req.log.warn(err.message);
        return reply.redirect(`${env.WEB_URL}/login?error=sso_identity_conflict`);
      }
      req.log.error(err);
      return reply.redirect(`${env.WEB_URL}/login?error=sso_failed`);
    }
  });

  app.get<{ Params: { workspaceId: string } }>(
    "/auth/saml/:workspaceId/metadata",
    async (req, reply) => {
      const client = buildMetadataOnlySamlClient(req.params.workspaceId);
      const xml = client.generateServiceProviderMetadata(null, null);
      reply.header("Content-Type", "application/xml");
      return reply.send(xml);
    },
  );
}
