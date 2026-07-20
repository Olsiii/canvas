import { activityRouter } from "./routers/activity";
import { attachmentRouter } from "./routers/attachment";
import { authRouter } from "./routers/auth";
import { checklistRouter } from "./routers/checklist";
import { commentRouter } from "./routers/comment";
import { customFieldRouter } from "./routers/custom-field";
import { hierarchyRouter } from "./routers/hierarchy";
import { notificationRouter } from "./routers/notification";
import { statusRouter } from "./routers/status";
import { tagRouter } from "./routers/tag";
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
  comment: commentRouter,
  notification: notificationRouter,
  activity: activityRouter,
  tag: tagRouter,
  customField: customFieldRouter,
  attachment: attachmentRouter,
});

export type AppRouter = typeof appRouter;
