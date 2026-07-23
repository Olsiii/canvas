import { db, schema } from "@canvas/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logActivity } from "../lib/activity";
import {
  parseScimActivePatch,
  parseUserNameEqFilter,
  toScimListResponse,
  toScimUser,
  type ScimUserSource,
} from "../lib/scim";
import { hashScimToken } from "../lib/scim-token";
import { ensureMembership, findOrCreateUserByEmail } from "../lib/user-provisioning";

/**
 * `Authorization: Bearer <token>` -> hash -> scim_tokens row scoped to this
 * exact :workspaceId — unlike api-v1.ts's API keys, a SCIM token has no
 * creator-role to inherit through `can()`; its own existence/hash match IS
 * the authorization (same reasoning as M5.4's webhook secret, see
 * schema/sso.ts). Returns null having already written the error response.
 */
async function authenticateScimRequest(
  req: FastifyRequest<{ Params: { workspaceId: string } }>,
  reply: FastifyReply,
): Promise<{ workspaceId: string; scimTokenId: string; actorId: string } | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) {
    await reply.code(401).send(scimError(401, "Missing Authorization: Bearer <token> header"));
    return null;
  }

  const row = await db.query.scimTokens.findFirst({
    where: and(
      eq(schema.scimTokens.hash, hashScimToken(token)),
      eq(schema.scimTokens.workspaceId, req.params.workspaceId),
    ),
  });
  if (!row) {
    await reply.code(401).send(scimError(401, "Invalid SCIM token for this workspace"));
    return null;
  }

  await db
    .update(schema.scimTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.scimTokens.id, row.id));

  // The activity log's actor for a SCIM-driven change is whoever created
  // the token (same "no session user, attribute to the credential's
  // creator" reasoning automation-runner.ts uses for automation.createdBy).
  return { workspaceId: row.workspaceId, scimTokenId: row.id, actorId: row.createdBy };
}

// SCIM's own error shape (RFC 7644 §3.12), distinct from this app's usual
// `{error: string}` REST error body — IdP connectors parse `detail`/`status`.
function scimError(status: number, detail: string) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    status: String(status),
    detail,
  };
}

async function loadScimUser(
  workspaceId: string,
  membershipId: string,
): Promise<ScimUserSource | null> {
  const row = await db
    .select({
      id: schema.memberships.id,
      role: schema.memberships.role,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(
      and(eq(schema.memberships.id, membershipId), eq(schema.memberships.workspaceId, workspaceId)),
    )
    .then((rows) => rows[0]);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, active: true };
}

async function listScimUsers(workspaceId: string, userNameFilter: string | null) {
  const rows = await db
    .select({
      id: schema.memberships.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(
      userNameFilter
        ? and(
            eq(schema.memberships.workspaceId, workspaceId),
            eq(schema.users.email, userNameFilter),
          )
        : eq(schema.memberships.workspaceId, workspaceId),
    );
  return rows.map((r): ScimUserSource => ({ ...r, active: true }));
}

/**
 * De-provisioning removes the membership row outright — Canvas's data
 * model has no "deactivated but still present" membership state (a
 * membership either exists or it doesn't, same as a manual admin removal
 * via workspace.removeMember), so a SCIM `active:false` PATCH and a SCIM
 * DELETE both resolve to the identical hard-delete-plus-activity-log this
 * app's admin-facing member removal already does. The workspace owner is
 * protected the same way removeMember protects them.
 */
async function deprovision(
  workspaceId: string,
  membershipId: string,
  scimTokenId: string,
  actorId: string,
) {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.id, membershipId),
      eq(schema.memberships.workspaceId, workspaceId),
    ),
  });
  if (!membership) return { ok: false as const, status: 404 };
  if (membership.role === "owner") {
    return {
      ok: false as const,
      status: 400,
      detail: "The workspace owner can't be deprovisioned",
    };
  }

  await db.delete(schema.memberships).where(eq(schema.memberships.id, membershipId));
  await logActivity(
    workspaceId,
    actorId,
    "membership",
    membership.userId,
    "membership.removed_via_scim",
    { scimTokenId },
  );
  return { ok: true as const };
}

export function registerScimRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/scim+json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get<{ Params: { workspaceId: string }; Querystring: { filter?: string } }>(
    "/scim/v2/:workspaceId/Users",
    async (req, reply) => {
      const ctx = await authenticateScimRequest(req, reply);
      if (!ctx) return;

      const emailFilter = parseUserNameEqFilter(req.query.filter);
      const users = await listScimUsers(ctx.workspaceId, emailFilter);
      const baseUrl = `${req.protocol}://${req.hostname}/scim/v2/${ctx.workspaceId}/Users`;
      return reply.send(toScimListResponse(users, baseUrl));
    },
  );

  app.get<{ Params: { workspaceId: string; membershipId: string } }>(
    "/scim/v2/:workspaceId/Users/:membershipId",
    async (req, reply) => {
      const ctx = await authenticateScimRequest(req, reply);
      if (!ctx) return;

      const user = await loadScimUser(ctx.workspaceId, req.params.membershipId);
      if (!user) return reply.code(404).send(scimError(404, "User not found"));
      const baseUrl = `${req.protocol}://${req.hostname}/scim/v2/${ctx.workspaceId}/Users`;
      return reply.send(toScimUser(user, baseUrl));
    },
  );

  app.post<{
    Params: { workspaceId: string };
    Body: { userName?: string; name?: { formatted?: string } };
  }>("/scim/v2/:workspaceId/Users", async (req, reply) => {
    const ctx = await authenticateScimRequest(req, reply);
    if (!ctx) return;

    const email = req.body?.userName;
    if (!email) return reply.code(400).send(scimError(400, "userName is required"));
    const name = req.body?.name?.formatted || email.split("@")[0]!;

    const user = await findOrCreateUserByEmail(email, name);
    const membership = await ensureMembership(ctx.workspaceId, user.id, "member");
    await logActivity(
      ctx.workspaceId,
      ctx.actorId,
      "membership",
      user.id,
      "membership.provisioned_via_scim",
      { scimTokenId: ctx.scimTokenId },
    );

    const baseUrl = `${req.protocol}://${req.hostname}/scim/v2/${ctx.workspaceId}/Users`;
    return reply
      .code(201)
      .send(
        toScimUser(
          { id: membership.id, email: user.email, name: user.name, active: true },
          baseUrl,
        ),
      );
  });

  app.put<{ Params: { workspaceId: string; membershipId: string }; Body: { active?: boolean } }>(
    "/scim/v2/:workspaceId/Users/:membershipId",
    async (req, reply) => {
      const ctx = await authenticateScimRequest(req, reply);
      if (!ctx) return;

      if (req.body?.active === false) {
        const result = await deprovision(
          ctx.workspaceId,
          req.params.membershipId,
          ctx.scimTokenId,
          ctx.actorId,
        );
        if (!result.ok)
          return reply
            .code(result.status)
            .send(scimError(result.status, result.detail ?? "Not found"));
        return reply.code(204).send();
      }

      const user = await loadScimUser(ctx.workspaceId, req.params.membershipId);
      if (!user) return reply.code(404).send(scimError(404, "User not found"));
      const baseUrl = `${req.protocol}://${req.hostname}/scim/v2/${ctx.workspaceId}/Users`;
      return reply.send(toScimUser(user, baseUrl));
    },
  );

  app.patch<{ Params: { workspaceId: string; membershipId: string } }>(
    "/scim/v2/:workspaceId/Users/:membershipId",
    async (req, reply) => {
      const ctx = await authenticateScimRequest(req, reply);
      if (!ctx) return;

      const requestedActive = parseScimActivePatch(req.body);
      if (requestedActive === false) {
        const result = await deprovision(
          ctx.workspaceId,
          req.params.membershipId,
          ctx.scimTokenId,
          ctx.actorId,
        );
        if (!result.ok)
          return reply
            .code(result.status)
            .send(scimError(result.status, result.detail ?? "Not found"));
        return reply.code(204).send();
      }

      const user = await loadScimUser(ctx.workspaceId, req.params.membershipId);
      if (!user) return reply.code(404).send(scimError(404, "User not found"));
      const baseUrl = `${req.protocol}://${req.hostname}/scim/v2/${ctx.workspaceId}/Users`;
      return reply.send(toScimUser(user, baseUrl));
    },
  );

  app.delete<{ Params: { workspaceId: string; membershipId: string } }>(
    "/scim/v2/:workspaceId/Users/:membershipId",
    async (req, reply) => {
      const ctx = await authenticateScimRequest(req, reply);
      if (!ctx) return;

      const result = await deprovision(
        ctx.workspaceId,
        req.params.membershipId,
        ctx.scimTokenId,
        ctx.actorId,
      );
      if (!result.ok)
        return reply
          .code(result.status)
          .send(scimError(result.status, result.detail ?? "Not found"));
      return reply.code(204).send();
    },
  );
}
