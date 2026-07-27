import { z } from "zod";

// M5.2 dashboards + widgets. ROADMAP.md named the original four explicitly:
// "task counts, burndown, time, AI usage/cost". assignee_breakdown and
// priority_breakdown were added later per a direct user request for more
// options useful to regular staff, not just leads.
export const WIDGET_TYPES = [
  "task_counts",
  "burndown",
  "time_tracked",
  "ai_usage_cost",
  "assignee_breakdown",
  "priority_breakdown",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

const daysRange = z.number().int().min(7).max(90).default(14);

export const widgetConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task_counts") }),
  z.object({ type: z.literal("burndown"), days: daysRange }),
  z.object({ type: z.literal("time_tracked"), days: daysRange }),
  z.object({ type: z.literal("ai_usage_cost"), days: daysRange }),
  z.object({ type: z.literal("assignee_breakdown") }),
  z.object({ type: z.literal("priority_breakdown") }),
]);
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const listDashboardsSchema = z.object({ workspaceId: z.string().uuid() });

export const getDashboardSchema = z.object({ dashboardId: z.string().uuid() });

export const createDashboardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const updateDashboardSchema = z.object({
  dashboardId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const deleteDashboardSchema = z.object({ dashboardId: z.string().uuid() });

export const addWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  config: widgetConfigSchema,
});

export const removeWidgetSchema = z.object({ widgetId: z.string().uuid() });

export const getWidgetDataSchema = z.object({ widgetId: z.string().uuid() });
