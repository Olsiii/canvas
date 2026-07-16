import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export function createContext({ req, res }: CreateFastifyContextOptions) {
  return { req, res };
}

export type Context = ReturnType<typeof createContext>;
