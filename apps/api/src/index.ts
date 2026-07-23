import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { env } from "./env";
import { ensureBucketExists } from "./lib/storage";
import { registerApiV1Routes } from "./routes/api-v1";
import { registerAttachmentRoutes } from "./routes/attachments";
import { registerAuthRoutes } from "./routes/auth";
import { registerBrainRealtimeRoutes } from "./routes/brain-realtime";
import { registerDocRealtimeRoutes } from "./routes/doc-realtime";
import { registerImageAssetRealtimeRoutes } from "./routes/image-asset-realtime";
import { registerImageAssetRoutes } from "./routes/image-assets";
import { registerImportRoutes } from "./routes/imports";
import { registerRealtimeRoutes } from "./routes/realtime";
import { registerSamlRoutes } from "./routes/saml";
import { registerScimRoutes } from "./routes/scim";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type { AppRouter } from "./trpc/router";

// tRPC's fastify adapter batches every query fired in one render pass into
// a single GET whose route param is the comma-joined list of procedure
// names (e.g. "checklist.list,tag.list,customField.values.listForTask,...").
// Fastify's router default (100 chars) is sized for normal route params,
// not this — the task detail panel alone now fires 8+ queries on mount,
// so a 100-char cap here surfaces as an opaque 414 with no server-side
// error log (the request never reaches the tRPC handler at all).
const app = Fastify({ logger: true, routerOptions: { maxParamLength: 5000 } });

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
registerImageAssetRoutes(app);
registerImportRoutes(app);
registerSamlRoutes(app);
registerScimRoutes(app);
registerRealtimeRoutes(app);
registerBrainRealtimeRoutes(app);
registerImageAssetRealtimeRoutes(app);
registerDocRealtimeRoutes(app);

app.get("/health", async () => ({ ok: true }));

await ensureBucketExists();

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
