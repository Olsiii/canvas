import { authRouter } from "./routers/auth";
import { checklistRouter } from "./routers/checklist";
import { hierarchyRouter } from "./routers/hierarchy";
import { statusRouter } from "./routers/status";
import { taskRouter } from "./routers/task";
import { workspaceRouter } from "./routers/workspace";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),
  auth: authRouter,
  workspace: workspaceRouter,
  hierarchy: hierarchyRouter,
  status: statusRouter,
  task: taskRouter,
  checklist: checklistRouter,
});

export type AppRouter = typeof appRouter;
