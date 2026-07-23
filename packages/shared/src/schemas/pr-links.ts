import { z } from "zod";

// M5.6 integrations: GitHub PR links.
export const TASK_PR_LINK_STATES = ["open", "closed", "merged", "unknown"] as const;
export type TaskPrLinkState = (typeof TASK_PR_LINK_STATES)[number];

export const listPrLinksSchema = z.object({ taskId: z.string().uuid() });

export const createPrLinkSchema = z.object({
  taskId: z.string().uuid(),
  // Validated/parsed server-side into owner/repo/number — see
  // apps/api/src/lib/github-client.ts's parsePullRequestUrl.
  url: z.string().trim().url(),
});

export const refreshPrLinkSchema = z.object({ prLinkId: z.string().uuid() });

export const deletePrLinkSchema = z.object({ prLinkId: z.string().uuid() });
