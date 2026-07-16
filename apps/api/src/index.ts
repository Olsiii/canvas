import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { env } from "./env";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

export type { AppRouter } from "./trpc/router";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: { router: appRouter, createContext },
});

app.get("/health", async () => ({ ok: true }));

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`api listening on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
