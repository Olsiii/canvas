import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { env } from "./env";
import { registerAuthRoutes } from "./routes/auth";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

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

await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

registerAuthRoutes(app);

app.get("/health", async () => ({ ok: true }));

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
