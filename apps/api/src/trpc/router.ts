import { activityRouter } from "./routers/activity";
import { aiUsageRouter } from "./routers/ai-usage";
import { apiKeyRouter } from "./routers/api-key";
import { attachmentRouter } from "./routers/attachment";
import { authRouter } from "./routers/auth";
import { automationRouter } from "./routers/automation";
import { brainRouter } from "./routers/brain";
import { brandKitRouter } from "./routers/brand-kit";
import { chatRouter } from "./routers/chat";
import { checklistRouter } from "./routers/checklist";
import { commentRouter } from "./routers/comment";
import { customFieldRouter } from "./routers/custom-field";
import { dashboardRouter } from "./routers/dashboard";
import { docRouter } from "./routers/doc";
import { formRouter } from "./routers/form";
import { goalRouter } from "./routers/goal";
import { hierarchyRouter } from "./routers/hierarchy";
import { imageAssetRouter } from "./routers/image-asset";
import { importRouter } from "./routers/import";
import { notificationRouter } from "./routers/notification";
import { prLinkRouter } from "./routers/pr-link";
import { reminderRouter } from "./routers/reminder";
import { roleRouter } from "./routers/role";
import { scimTokenRouter } from "./routers/scim-token";
import { searchRouter } from "./routers/search";
import { ssoRouter } from "./routers/sso";
import { statusRouter } from "./routers/status";
import { tagRouter } from "./routers/tag";
import { taskRouter } from "./routers/task";
import { taskTemplateRouter } from "./routers/task-template";
import { timeEntryRouter } from "./routers/time-entry";
import { webhookRouter } from "./routers/webhook";
import { workloadRouter } from "./routers/workload";
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
  reminder: reminderRouter,
  activity: activityRouter,
  tag: tagRouter,
  taskTemplate: taskTemplateRouter,
  timeEntry: timeEntryRouter,
  workload: workloadRouter,
  customField: customFieldRouter,
  attachment: attachmentRouter,
  imageAsset: imageAssetRouter,
  brandKit: brandKitRouter,
  brain: brainRouter,
  doc: docRouter,
  chat: chatRouter,
  form: formRouter,
  automation: automationRouter,
  dashboard: dashboardRouter,
  goal: goalRouter,
  apiKey: apiKeyRouter,
  webhook: webhookRouter,
  import: importRouter,
  prLink: prLinkRouter,
  sso: ssoRouter,
  scimToken: scimTokenRouter,
  role: roleRouter,
  search: searchRouter,
  aiUsage: aiUsageRouter,
});

export type AppRouter = typeof appRouter;
