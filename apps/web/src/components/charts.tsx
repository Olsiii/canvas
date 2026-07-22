// Minimal, dependency-free SVG charts for dashboard widgets (M5.2). Follows
// the project's dataviz skill: thin marks, rounded bar tops, a hairline
// baseline/gridline, native <title> tooltips as the hover layer, and the
// validated reference palette (categorical slots fixed-order, single hue
// for one-series charts) — see references/palette.md. Each chart is
// deliberately small; a real charting library would be overkill for four
// fixed widget shapes.

const CHART_HEIGHT = 140;
const CHART_WIDTH = 480;
const PADDING = 24;

// Categorical slots 1-4 (fixed order — never reassigned by value), plus the
// two single-series hues used by the trailing-history widgets.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;
const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500"] as const;
const SERIES_BLUE = { light: "#2a78d6", dark: "#3987e5" };
const SERIES_AQUA = { light: "#1baf7a", dark: "#199e70" };
const SERIES_ORANGE = { light: "#eb6834", dark: "#d95926" };

export const SERIES_COLOR = {
  burndown: SERIES_BLUE,
  timeTracked: SERIES_AQUA,
  aiUsageCost: SERIES_ORANGE,
};

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function BarChart({
  data,
  color,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  color: { light: string; dark: string };
  valueLabel: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;
  const barWidth = data.length > 0 ? innerWidth / data.length : innerWidth;
  const gap = Math.min(6, barWidth * 0.25);

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
    >
      <line
        x1={PADDING}
        y1={CHART_HEIGHT - PADDING}
        x2={CHART_WIDTH - PADDING}
        y2={CHART_HEIGHT - PADDING}
        className="stroke-border"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * innerHeight);
        const x = PADDING + i * barWidth + gap / 2;
        const y = CHART_HEIGHT - PADDING - h;
        const w = Math.max(1, barWidth - gap);
        return (
          <rect
            key={d.label}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(4, w / 2)}
            className="[fill:var(--bar-color-light)] dark:[fill:var(--bar-color-dark)]"
            style={
              {
                "--bar-color-light": color.light,
                "--bar-color-dark": color.dark,
              } as React.CSSProperties
            }
          >
            <title>{`${d.label}: ${valueLabel(d.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function CategoricalBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;
  const barWidth = innerWidth / Math.max(1, data.length);
  const gap = Math.min(16, barWidth * 0.3);

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Bar chart of task counts by status"
    >
      <line
        x1={PADDING}
        y1={CHART_HEIGHT - PADDING}
        x2={CHART_WIDTH - PADDING}
        y2={CHART_HEIGHT - PADDING}
        className="stroke-border"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * innerHeight);
        const x = PADDING + i * barWidth + gap / 2;
        const y = CHART_HEIGHT - PADDING - h;
        const w = Math.max(1, barWidth - gap);
        const light = CATEGORICAL[i % CATEGORICAL.length];
        const dark = CATEGORICAL_DARK[i % CATEGORICAL_DARK.length];
        return (
          <rect
            key={d.label}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(4, w / 2)}
            style={{ "--bar-color-light": light, "--bar-color-dark": dark } as React.CSSProperties}
            className="[fill:var(--bar-color-light)] dark:[fill:var(--bar-color-dark)]"
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function LineChart({
  data,
  color,
  valueLabel,
}: {
  data: { label: string; value: number }[];
  color: { light: string; dark: string };
  valueLabel: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PADDING + i * stepX,
    y: CHART_HEIGHT - PADDING - (d.value / max) * innerHeight,
    d,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Line chart"
      style={
        {
          "--line-color-light": color.light,
          "--line-color-dark": color.dark,
        } as React.CSSProperties
      }
    >
      <line
        x1={PADDING}
        y1={CHART_HEIGHT - PADDING}
        x2={CHART_WIDTH - PADDING}
        y2={CHART_HEIGHT - PADDING}
        className="stroke-border"
        strokeWidth={1}
      />
      <path
        d={path}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke:var(--line-color-light)] dark:[stroke:var(--line-color-dark)]"
      />
      {points.map((p) => (
        <circle
          key={p.d.label}
          cx={p.x}
          cy={p.y}
          r={3}
          className="[fill:var(--line-color-light)] dark:[fill:var(--line-color-dark)]"
        >
          <title>{`${p.d.label}: ${valueLabel(p.d.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
