import type { AppRouter } from "@canvas/api";
import {
  BarChart,
  CategoricalBarChart,
  formatShortDate,
  LineChart,
  SERIES_COLOR,
} from "@/components/charts";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { STATUS_KINDS } from "@canvas/shared";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Widget = RouterOutputs["dashboard"]["get"]["widgets"][number];

const WIDGET_TITLES: Record<string, string> = {
  task_counts: "Task counts",
  burndown: "Burndown",
  time_tracked: "Time tracked",
  ai_usage_cost: "AI usage cost",
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

  return (
    <div className="border-border rounded-md border p-3" data-testid={`widget-${widget.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{WIDGET_TITLES[widget.type] ?? widget.type}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate({ widgetId: widget.id })}
          aria-label="Remove widget"
        >
          ✕
        </Button>
      </div>

      {data.isLoading || !data.data ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : data.data.type === "task_counts" ? (
        <TaskCountsWidget counts={data.data.counts} />
      ) : data.data.type === "burndown" ? (
        <BurndownWidget series={data.data.series} />
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
    </div>
  );
}

function TaskCountsWidget({ counts }: { counts: Record<string, number> }) {
  const data = STATUS_KINDS.map((kind) => ({
    label: kind.charAt(0).toUpperCase() + kind.slice(1),
    value: counts[kind] ?? 0,
  }));

  return (
    <div>
      <CategoricalBarChart data={data} />
      {/* Accessible table view alongside the chart, not color-only. */}
      <dl className="mt-2 grid grid-cols-4 gap-2 text-xs" data-testid="widget-table">
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
