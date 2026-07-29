import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { db } from "@canvas/db";
import { env } from "./env";
import { initSentry, Sentry } from "./lib/sentry";
import { ensureBucketExists } from "./lib/storage";
import { redisConnection } from "./queues/connection";
import { registerAiReferenceRoutes } from "./routes/ai-references";
import { registerApiV1Routes } from "./routes/api-v1";
import { registerAttachmentRoutes } from "./routes/attachments";
import { registerAuthRoutes } from "./routes/auth";
import { registerAvatarRoutes } from "./routes/avatars";
import { registerBrainRealtimeRoutes } from "./routes/brain-realtime";
import { registerCopyGenerationRealtimeRoutes } from "./routes/copy-generation-realtime";
import { registerDocRealtimeRoutes } from "./routes/doc-realtime";
import { registerExportRoutes } from "./routes/export";
import { registerImageAssetRealtimeRoutes } from "./routes/image-asset-realtime";
import { registerImageAssetRoutes } from "./routes/image-assets";
import { registerImportRoutes } from "./routes/imports";
import { registerRealtimeRoutes } from "./routes/realtime";
import { registerSamlRoutes } from "./routes/saml";
import { registerScimRoutes } from "./routes/scim";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

initSentry("api");

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type { AppRouter } from "./trpc/router";

// tRPC's fastify adapter batches every query fired in one render pass into
// a single GET whose route param is the comma-joined list of procedure
// names (e.g. "checklist.list,tag.list,customField.values.listForTask,...").
// Fastify's router default (100 chars) is sized for normal route params,
// not this — the task detail panel alone now fires 8+ queries on mount,
// so a 100-char cap here surfaces as an opaque 414 with no server-side
// error log (the request never reaches the tRPC handler at all).
const app = Fastify({
  logger: true,
  // Required behind a TLS terminator so req.protocol / hostname (SCIM, SAML
  // absolute URLs) reflect the public origin rather than the internal hop.
  trustProxy: true,
  routerOptions: { maxParamLength: 5000 },
});

// This is a pure JSON/binary API (no HTML views of its own), but two of its
// own routes serve arbitrary user-uploaded bytes (attachments, image-assets
// — see lib/mime-safety.ts's inline-vs-download content-type guard). Helmet
// is the second, independent layer: X-Frame-Options stops any of those
// responses from being framed by an external site, and the default CSP/
// nosniff/HSTS headers are standard baseline hardening even though most
// responses here are JSON. crossOriginEmbedderPolicy is off — this API is
// never embedded as a cross-origin subresource of another origin's COEP'd
// page, and leaving it on has no benefit here while being a common source
// of breakage for exactly this kind of cross-origin file-serving route.
await app.register(helmet, { crossOriginEmbedderPolicy: false });
await app.register(cors, { origin: env.WEB_URL, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES } });
await app.register(websocket);
// SAML's HTTP-POST binding delivers SAMLResponse as a browser-submitted
// application/x-www-form-urlencoded form (routes/saml.ts) — Fastify has no
// built-in parser for that content type, unlike JSON.
await app.register(formbody);

await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

registerAuthRoutes(app);
registerApiV1Routes(app);
registerAttachmentRoutes(app);
registerAvatarRoutes(app);
registerImageAssetRoutes(app);
registerAiReferenceRoutes(app);
registerImportRoutes(app);
registerExportRoutes(app);
registerSamlRoutes(app);
registerScimRoutes(app);
registerRealtimeRoutes(app);
registerBrainRealtimeRoutes(app);
registerImageAssetRealtimeRoutes(app);
registerCopyGenerationRealtimeRoutes(app);
registerDocRealtimeRoutes(app);

// Captures unhandled route errors when SENTRY_DSN is set (no-op otherwise).
Sentry.setupFastifyErrorHandler(app);

app.get("/health", async (_req, reply) => {
  const checks: Record<string, "ok" | "error"> = { api: "ok" };

  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const pong = await redisConnection.ping();
    checks.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const ready = Object.values(checks).every((v) => v === "ok");
  return reply.code(ready ? 200 : 503).send({ ok: ready, checks });
});

await ensureBucketExists();

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
