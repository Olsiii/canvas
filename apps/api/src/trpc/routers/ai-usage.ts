import { db, schema } from "@canvas/db";
import { workspaceAiUsageCostSchema } from "@canvas/shared";
import { and, eq, gte, lte } from "drizzle-orm";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

export const aiUsageRouter = router({
  // Workspace-wide AI spend for the Timesheet page's "Team overview" (a
  // Finance Manager-style role's other main concern, alongside time) —
  // same `timeEntry:viewAll` gate since both are shown together and both
  // expose individual-member activity, not just a pre-aggregated total
  // like the Dashboards ai_usage_cost widget (member-tier `dashboard:view`).
  workspaceCost: protectedProcedure
    .input(workspaceAiUsageCostSchema)
    .query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "timeEntry:viewAll");

      const rangeStart = new Date(`${input.start}T00:00:00`);
      const rangeEnd = new Date(`${input.end}T23:59:59.999`);

      const rows = await db
        .select({
          userId: schema.aiUsage.userId,
          kind: schema.aiUsage.kind,
          costUsdEst: schema.aiUsage.costUsdEst,
        })
        .from(schema.aiUsage)
        .where(
          and(
            eq(schema.aiUsage.workspaceId, input.workspaceId),
            gte(schema.aiUsage.createdAt, rangeStart),
            lte(schema.aiUsage.createdAt, rangeEnd),
          ),
        );

      const byUser = new Map<string, number>();
      const byKind = new Map<string, number>();
      let totalUsd = 0;
      for (const row of rows) {
        const cost = parseFloat(row.costUsdEst);
        totalUsd += cost;
        byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + cost);
        byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + cost);
      }

      return {
        totalUsd,
        byUser: [...byUser.entries()].map(([userId, usd]) => ({ userId, usd })),
        byKind: [...byKind.entries()].map(([kind, usd]) => ({ kind, usd })),
      };
    }),
});
