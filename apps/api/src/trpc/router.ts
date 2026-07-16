import { authRouter } from "./routers/auth";
import { workspaceRouter } from "./routers/workspace";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),
  auth: authRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
