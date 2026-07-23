import { db, schema } from "@canvas/db";
import {
  createPrLinkSchema,
  deletePrLinkSchema,
  listPrLinksSchema,
  refreshPrLinkSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { GitHubClient, parsePullRequestUrl } from "../../lib/github-client";
import { assertCan } from "../../lib/permissions";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";

/** Best-effort — a private repo, deleted PR, or rate limit leaves the link's state "unknown" rather than failing the mutation that owns this call. */
async function fetchPrDetails(owner: string, repo: string, number: number) {
  try {
    const pr = await new GitHubClient().getPullRequest(owner, repo, number);
    return { title: pr.title, state: pr.state };
  } catch {
    return { title: null, state: "unknown" as const };
  }
}

export const prLinkRouter = router({
  list: protectedProcedure.input(listPrLinksSchema).query(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForTask(input.taskId);
    await assertCan(ctx.user, workspaceId, "prLink:view");

    return db.query.taskPrLinks.findMany({
      where: eq(schema.taskPrLinks.taskId, input.taskId),
      orderBy: asc(schema.taskPrLinks.createdAt),
    });
  }),

  create: protectedProcedure.input(createPrLinkSchema).mutation(async ({ ctx, input }) => {
    await requireTask(input.taskId);
    const workspaceId = await workspaceIdForTask(input.taskId);
    await assertCan(ctx.user, workspaceId, "prLink:create");

    const { owner, repo, number } = parsePullRequestUrl(input.url);
    const details = await fetchPrDetails(owner, repo, number);

    const [link] = await db
      .insert(schema.taskPrLinks)
      .values({
        taskId: input.taskId,
        url: input.url,
        owner,
        repo,
        number,
        title: details.title,
        state: details.state,
        createdBy: ctx.user.id,
      })
      .returning();
    if (!link) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(workspaceId, ctx.user.id, "task", input.taskId, "task.pr_linked", {
      url: input.url,
    });
    return link;
  }),

  refresh: protectedProcedure.input(refreshPrLinkSchema).mutation(async ({ ctx, input }) => {
    const link = await db.query.taskPrLinks.findFirst({
      where: eq(schema.taskPrLinks.id, input.prLinkId),
    });
    if (!link) throw new TRPCError({ code: "NOT_FOUND" });
    const workspaceId = await workspaceIdForTask(link.taskId);
    await assertCan(ctx.user, workspaceId, "prLink:create");

    const details = await fetchPrDetails(link.owner, link.repo, link.number);
    const [updated] = await db
      .update(schema.taskPrLinks)
      .set({ title: details.title, state: details.state })
      .where(eq(schema.taskPrLinks.id, link.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return updated;
  }),

  delete: protectedProcedure.input(deletePrLinkSchema).mutation(async ({ ctx, input }) => {
    const link = await db.query.taskPrLinks.findFirst({
      where: eq(schema.taskPrLinks.id, input.prLinkId),
    });
    if (!link) throw new TRPCError({ code: "NOT_FOUND" });
    const workspaceId = await workspaceIdForTask(link.taskId);
    await assertCan(ctx.user, workspaceId, "prLink:delete");

    await db.delete(schema.taskPrLinks).where(eq(schema.taskPrLinks.id, link.id));
    return { id: link.id };
  }),
});
