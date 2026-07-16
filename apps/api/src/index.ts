import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { env } from "./env";
import { registerAuthRoutes } from "./routes/auth";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

export type { AppRouter } from "./trpc/router";

const app = Fastify({ logger: true });

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
