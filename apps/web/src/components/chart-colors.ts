// Single-series hues used by the trailing-history widgets — see
// charts.tsx's palette comment for the full dataviz-skill rationale.
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
