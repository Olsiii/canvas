import { db, schema } from "@canvas/db";
import {
  addWidgetSchema,
  createDashboardSchema,
  deleteDashboardSchema,
  getDashboardSchema,
  getWidgetDataSchema,
  listDashboardsSchema,
  removeWidgetSchema,
  updateDashboardSchema,
  widgetConfigSchema,
  type WidgetConfig,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import {
  bucketSumByDay,
  computeBurndownSeries,
  countByStatusKind,
} from "../../lib/dashboard-metrics";
import { nextOrderKey } from "../../lib/order";
import { assertCan } from "../../lib/permissions";
import { protectedProcedure, router } from "../trpc";

async function requireDashboard(dashboardId: string) {
  const dashboard = await db.query.dashboards.findFirst({
    where: eq(schema.dashboards.id, dashboardId),
  });
  if (!dashboard) throw new TRPCError({ code: "NOT_FOUND" });
  return dashboard;
}

async function lastWidgetOrderKey(dashboardId: string): Promise<string | null> {
  const [last] = await db
    .select({ orderKey: schema.widgets.orderKey })
    .from(schema.widgets)
    .where(eq(schema.widgets.dashboardId, dashboardId))
    .orderBy(desc(schema.widgets.orderKey))
    .limit(1);
  return last?.orderKey ?? null;
}

function rangeStart(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function computeWidgetData(workspaceId: string, config: WidgetConfig) {
  const now = new Date();

  switch (config.type) {
    case "task_counts": {
      const rows = await db
        .select({ kind: schema.statuses.kind })
        .from(schema.tasks)
        .innerJoin(schema.statuses, eq(schema.statuses.id, schema.tasks.statusId))
        .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
        .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
        .where(
          and(
            eq(schema.spaces.workspaceId, workspaceId),
            isNull(schema.tasks.deletedAt),
            isNull(schema.tasks.parentTaskId),
          ),
        );
      return {
        type: "task_counts" as const,
        counts: countByStatusKind(rows.map((r) => ({ statusKind: r.kind }))),
      };
    }

    case "burndown": {
      const rows = await db
        .select({ createdAt: schema.tasks.createdAt, completedAt: schema.tasks.completedAt })
        .from(schema.tasks)
        .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
        .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
        .where(
          and(
            eq(schema.spaces.workspaceId, workspaceId),
            isNull(schema.tasks.deletedAt),
            isNull(schema.tasks.parentTaskId),
          ),
        );
      return {
        type: "burndown" as const,
        series: computeBurndownSeries(rows, config.days, now),
      };
    }

    case "time_tracked": {
      const rows = await db
        .select({
          startedAt: schema.timeEntries.startedAt,
          durationSec: schema.timeEntries.durationSec,
        })
        .from(schema.timeEntries)
        .innerJoin(schema.tasks, eq(schema.tasks.id, schema.timeEntries.taskId))
        .innerJoin(schema.lists, eq(schema.lists.id, schema.tasks.listId))
        .innerJoin(schema.spaces, eq(schema.spaces.id, schema.lists.spaceId))
        .where(
          and(
            eq(schema.spaces.workspaceId, workspaceId),
            gte(schema.timeEntries.startedAt, rangeStart(config.days, now)),
          ),
        );
      return {
        type: "time_tracked" as const,
        series: bucketSumByDay(
          // A still-running timer has no durationSec yet — same "doesn't
          // count until stopped" convention the personal timesheet uses.
          rows.map((r) => ({ date: r.startedAt, value: (r.durationSec ?? 0) / 3600 })),
          config.days,
          now,
        ),
      };
    }

    case "ai_usage_cost": {
      const rows = await db
        .select({ createdAt: schema.aiUsage.createdAt, costUsdEst: schema.aiUsage.costUsdEst })
        .from(schema.aiUsage)
        .where(
          and(
            eq(schema.aiUsage.workspaceId, workspaceId),
            gte(schema.aiUsage.createdAt, rangeStart(config.days, now)),
          ),
        );
      return {
        type: "ai_usage_cost" as const,
        series: bucketSumByDay(
          rows.map((r) => ({ date: r.createdAt, value: parseFloat(r.costUsdEst) })),
          config.days,
          now,
        ),
      };
    }
  }
}

export const dashboardRouter = router({
  list: protectedProcedure.input(listDashboardsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "dashboard:view");

    return db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.workspaceId, input.workspaceId))
      .orderBy(asc(schema.dashboards.name));
  }),

  get: protectedProcedure.input(getDashboardSchema).query(async ({ ctx, input }) => {
    const dashboard = await requireDashboard(input.dashboardId);
    await assertCan(ctx.user, dashboard.workspaceId, "dashboard:view");

    const widgetRows = await db
      .select()
      .from(schema.widgets)
      .where(eq(schema.widgets.dashboardId, dashboard.id))
      .orderBy(asc(schema.widgets.orderKey));

    return { ...dashboard, widgets: widgetRows };
  }),

  create: protectedProcedure.input(createDashboardSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "dashboard:create");

    const [dashboard] = await db
      .insert(schema.dashboards)
      .values({ workspaceId: input.workspaceId, name: input.name, createdBy: ctx.user.id })
      .returning();
    if (!dashboard) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return dashboard;
  }),

  update: protectedProcedure.input(updateDashboardSchema).mutation(async ({ ctx, input }) => {
    const dashboard = await requireDashboard(input.dashboardId);
    await assertCan(ctx.user, dashboard.workspaceId, "dashboard:update");

    const [updated] = await db
      .update(schema.dashboards)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(schema.dashboards.id, dashboard.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return updated;
  }),

  delete: protectedProcedure.input(deleteDashboardSchema).mutation(async ({ ctx, input }) => {
    const dashboard = await requireDashboard(input.dashboardId);
    await assertCan(ctx.user, dashboard.workspaceId, "dashboard:delete");

    await db.delete(schema.dashboards).where(eq(schema.dashboards.id, dashboard.id));
    return { id: dashboard.id };
  }),

  widget: router({
    add: protectedProcedure.input(addWidgetSchema).mutation(async ({ ctx, input }) => {
      const dashboard = await requireDashboard(input.dashboardId);
      await assertCan(ctx.user, dashboard.workspaceId, "dashboard:update");

      const lastKey = await lastWidgetOrderKey(dashboard.id);
      const [widget] = await db
        .insert(schema.widgets)
        .values({
          dashboardId: dashboard.id,
          type: input.config.type,
          configJson: input.config,
          orderKey: nextOrderKey(lastKey),
        })
        .returning();
      if (!widget) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return widget;
    }),

    remove: protectedProcedure.input(removeWidgetSchema).mutation(async ({ ctx, input }) => {
      const widget = await db.query.widgets.findFirst({
        where: eq(schema.widgets.id, input.widgetId),
      });
      if (!widget) throw new TRPCError({ code: "NOT_FOUND" });
      const dashboard = await requireDashboard(widget.dashboardId);
      await assertCan(ctx.user, dashboard.workspaceId, "dashboard:update");

      await db.delete(schema.widgets).where(eq(schema.widgets.id, widget.id));
      return { id: widget.id };
    }),

    data: protectedProcedure.input(getWidgetDataSchema).query(async ({ ctx, input }) => {
      const widget = await db.query.widgets.findFirst({
        where: eq(schema.widgets.id, input.widgetId),
      });
      if (!widget) throw new TRPCError({ code: "NOT_FOUND" });
      const dashboard = await requireDashboard(widget.dashboardId);
      await assertCan(ctx.user, dashboard.workspaceId, "dashboard:view");

      const config = widgetConfigSchema.parse(widget.configJson);
      return computeWidgetData(dashboard.workspaceId, config);
    }),
  }),
});
