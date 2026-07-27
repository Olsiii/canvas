import type { AppRouter } from "@canvas/api";
import {
  BarChart,
  DonutChart,
  formatShortDate,
  LineChart,
  SERIES_COLOR,
} from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { STATUS_KINDS } from "@canvas/shared";
import type { inferRouterOutputs } from "@trpc/server";
import { Clock3, Flag, ListChecks, TrendingDown, Users, Wallet, X } from "lucide-react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Widget = RouterOutputs["dashboard"]["get"]["widgets"][number];

const WIDGET_TITLES: Record<string, string> = {
  task_counts: "Task counts",
  burndown: "Tasks remaining over time",
  time_tracked: "Time tracked",
  ai_usage_cost: "AI usage cost",
  assignee_breakdown: "Open tasks by assignee",
  priority_breakdown: "Open tasks by priority",
};

const WIDGET_ICONS: Record<string, typeof ListChecks> = {
  task_counts: ListChecks,
  burndown: TrendingDown,
  time_tracked: Clock3,
  ai_usage_cost: Wallet,
  assignee_breakdown: Users,
  priority_breakdown: Flag,
};

function formatHours(v: number): string {
  return `${v.toFixed(1)}h`;
}

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

export function DashboardWidget({ widget, onRemoved }: { widget: Widget; onRemoved: () => void }) {
  const data = trpc.dashboard.widget.data.useQuery({ widgetId: widget.id });
  const remove = trpc.dashboard.widget.remove.useMutation({ onSuccess: onRemoved });
  const Icon = WIDGET_ICONS[widget.type] ?? ListChecks;

  return (
    <Card data-testid={`widget-${widget.id}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="bg-accent-soft text-accent flex h-7 w-7 items-center justify-center rounded-md">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle>{WIDGET_TITLES[widget.type] ?? widget.type}</CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate({ widgetId: widget.id })}
          aria-label="Remove widget"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        {data.isLoading || !data.data ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : data.data.type === "task_counts" ? (
          <TaskCountsWidget counts={data.data.counts} />
        ) : data.data.type === "burndown" ? (
          <BurndownWidget series={data.data.series} />
        ) : data.data.type === "assignee_breakdown" ? (
          <CountBreakdownWidget
            items={data.data.counts.map((c) => ({ label: c.name, value: c.count }))}
            centerLabel="Open tasks"
          />
        ) : data.data.type === "priority_breakdown" ? (
          <CountBreakdownWidget
            items={data.data.counts.map((c) => ({
              label: c.priority.charAt(0).toUpperCase() + c.priority.slice(1),
              value: c.count,
            }))}
            centerLabel="Open tasks"
          />
        ) : data.data.type === "time_tracked" ? (
          <SeriesWidget
            series={data.data.series}
            color={SERIES_COLOR.timeTracked}
            valueLabel={formatHours}
            summaryLabel="Total"
            summaryValue={(series) => series.reduce((sum, s) => sum + s.value, 0)}
            chart="bar"
          />
        ) : (
          <SeriesWidget
            series={data.data.series}
            color={SERIES_COLOR.aiUsageCost}
            valueLabel={formatUsd}
            summaryLabel="Total"
            summaryValue={(series) => series.reduce((sum, s) => sum + s.value, 0)}
            chart="bar"
          />
        )}
      </CardContent>
    </Card>
  );
}

function TaskCountsWidget({ counts }: { counts: Record<string, number> }) {
  const data = STATUS_KINDS.map((kind) => ({
    label: kind.charAt(0).toUpperCase() + kind.slice(1),
    value: counts[kind] ?? 0,
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <DonutChart data={data} centerLabel="Total tasks" centerValue={String(total)} />
      {/* Accessible table view alongside the chart, not color-only. */}
      <dl className="mt-3 grid grid-cols-4 gap-2 text-xs" data-testid="widget-table">
        {data.map((d) => (
          <div key={d.label}>
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd className="font-medium">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CountBreakdownWidget({
  items,
  centerLabel,
}: {
  items: { label: string; value: number }[];
  centerLabel: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div>
      <DonutChart data={items} centerLabel={centerLabel} centerValue={String(total)} />
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs" data-testid="widget-table">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-muted-foreground truncate">{i.label}</dt>
            <dd className="font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SeriesWidget({
  series,
  color,
  valueLabel,
  summaryLabel,
  summaryValue,
  chart,
}: {
  series: { date: string; value: number }[];
  color: { light: string; dark: string };
  valueLabel: (v: number) => string;
  summaryLabel: string;
  summaryValue: (series: { date: string; value: number }[]) => number;
  chart: "bar" | "line";
}) {
  const data = series.map((s) => ({ label: formatShortDate(s.date), value: s.value }));

  return (
    <div>
      {chart === "line" ? (
        <LineChart data={data} color={color} valueLabel={valueLabel} />
      ) : (
        <BarChart data={data} color={color} valueLabel={valueLabel} />
      )}
      <p className="text-muted-foreground mt-2 text-xs" data-testid="widget-table">
        {summaryLabel}: {valueLabel(summaryValue(series))}
      </p>
    </div>
  );
}

function BurndownWidget({ series }: { series: { date: string; remaining: number }[] }) {
  const data = series.map((s) => ({ label: formatShortDate(s.date), value: s.remaining }));
  const latest = series.at(-1)?.remaining ?? 0;

  return (
    <div>
      <LineChart data={data} color={SERIES_COLOR.burndown} valueLabel={(v) => String(v)} />
      <p className="text-muted-foreground mt-2 text-xs" data-testid="widget-table">
        Remaining now: {latest}
      </p>
    </div>
  );
}
