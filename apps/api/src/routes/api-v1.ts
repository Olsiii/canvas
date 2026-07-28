import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SessionUser } from "../auth/session";
import { hashApiKey } from "../lib/api-key";
import { assertCan } from "../lib/permissions";
import { checkRateLimit, RATE_LIMIT_MAX_REQUESTS } from "../lib/rate-limit";
import { createTaskViaApi, updateTaskViaApi } from "../lib/task-mutations";
import { requireTask, workspaceIdForList, workspaceIdForTask } from "../lib/task-queries";

interface ApiContext {
  actor: SessionUser;
  workspaceId: string;
}

/**
 * `Authorization: Bearer <key>` -> hash -> api_keys row -> the row's
 * creator, reused as-is as the acting SessionUser (see schema/
 * api-platform.ts: a key's permissions are exactly its creator's current
 * workspace role, re-checked via the same `assertCan` every other
 * mutation in this app goes through — no separate service-account
 * permission path). Also enforces the per-key rate limit and bumps
 * `last_used_at`. Returns null (having already written the error
 * response) when the request should stop here.
 */
async function authenticateApiRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<ApiContext | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) {
    await reply.code(401).send({ error: "Missing Authorization: Bearer <key> header" });
    return null;
  }

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(schema.apiKeys.hash, hashApiKey(token)),
  });
  if (!apiKey) {
    await reply.code(401).send({ error: "Invalid API key" });
    return null;
  }

  const { overLimit } = await checkRateLimit(`apikey:${apiKey.id}`);
  if (overLimit) {
    reply.header("Retry-After", "60");
    await reply
      .code(429)
      .send({ error: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS} requests/minute)` });
    return null;
  }

  const creator = await db.query.users.findFirst({ where: eq(schema.users.id, apiKey.createdBy) });
  if (!creator) {
    await reply.code(401).send({ error: "This key's creator no longer exists" });
    return null;
  }

  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id));

  return {
    actor: {
      id: creator.id,
      email: creator.email,
      name: creator.name,
      avatarUrl: creator.avatarUrl,
    },
    workspaceId: apiKey.workspaceId,
  };
}

const TRPC_CODE_TO_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

async function handleApiError(err: unknown, reply: FastifyReply) {
  if (err instanceof TRPCError) {
    const status = TRPC_CODE_TO_STATUS[err.code] ?? 500;
    return reply.code(status).send({ error: err.message || err.code });
  }
  reply.log.error(err);
  return reply.code(500).send({ error: "Internal server error" });
}

const createTaskBodySchema = z.object({
  listId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  statusId: z.string().uuid().optional(),
  descriptionJson: z.unknown().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});

const updateTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  statusId: z.string().uuid().optional(),
  descriptionJson: z.unknown().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});

/**
 * Public REST API v1 — deliberately one resource (tasks) done completely
 * rather than a shallow mirror of the whole tRPC surface. `/api/v1` is a
 * distinct namespace from every other REST route in this app (`/uploads`,
 * `/image-versions`, `/ws`), all of which are browser-session-cookie
 * endpoints the SPA itself calls; this one is bearer-token, third-party
 * facing, and versioned.
 */
export function registerApiV1Routes(app: FastifyInstance) {
  app.get<{ Querystring: { listId?: string } }>("/api/v1/tasks", async (req, reply) => {
    const ctx = await authenticateApiRequest(req, reply);
    if (!ctx) return;

    const listId = req.query.listId;
    if (!listId) return reply.code(400).send({ error: "listId query parameter is required" });

    try {
      const listWorkspaceId = await workspaceIdForList(listId);
      if (listWorkspaceId !== ctx.workspaceId) {
        return reply
          .code(400)
          .send({ error: "listId does not belong to this API key's workspace" });
      }
      await assertCan(ctx.actor, ctx.workspaceId, "task:view");

      const tasks = await db.query.tasks.findMany({
        where: (t, { and, eq, isNull }) => and(eq(t.listId, listId), isNull(t.deletedAt)),
      });
      return reply.send({ data: tasks });
    } catch (err) {
      return handleApiError(err, reply);
    }
  });

  app.get<{ Params: { taskId: string } }>("/api/v1/tasks/:taskId", async (req, reply) => {
    const ctx = await authenticateApiRequest(req, reply);
    if (!ctx) return;

    try {
      const task = await requireTask(req.params.taskId);
      const taskWorkspaceId = await workspaceIdForList(task.listId);
      if (taskWorkspaceId !== ctx.workspaceId) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.actor, ctx.workspaceId, "task:view");

      return reply.send({ data: task });
    } catch (err) {
      return handleApiError(err, reply);
    }
  });

  app.post("/api/v1/tasks", async (req, reply) => {
    const ctx = await authenticateApiRequest(req, reply);
    if (!ctx) return;

    const parsed = createTaskBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }

    try {
      const listWorkspaceId = await workspaceIdForList(parsed.data.listId);
      if (listWorkspaceId !== ctx.workspaceId) {
        return reply
          .code(400)
          .send({ error: "listId does not belong to this API key's workspace" });
      }
      await assertCan(ctx.actor, ctx.workspaceId, "task:create");

      const task = await createTaskViaApi({ ...parsed.data, actorId: ctx.actor.id });
      return reply.code(201).send({ data: task });
    } catch (err) {
      return handleApiError(err, reply);
    }
  });

  app.patch<{ Params: { taskId: string } }>("/api/v1/tasks/:taskId", async (req, reply) => {
    const ctx = await authenticateApiRequest(req, reply);
    if (!ctx) return;

    const parsed = updateTaskBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }

    try {
      const taskWorkspaceId = await workspaceIdForTask(req.params.taskId);
      if (taskWorkspaceId !== ctx.workspaceId) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCan(ctx.actor, ctx.workspaceId, "task:update");

      const task = await updateTaskViaApi({
        taskId: req.params.taskId,
        ...parsed.data,
        actorId: ctx.actor.id,
      });
      return reply.send({ data: task });
    } catch (err) {
      return handleApiError(err, reply);
    }
  });
}
