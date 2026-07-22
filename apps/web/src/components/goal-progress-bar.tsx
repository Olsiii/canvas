// Status "good" (reserved — never a categorical series color) ships with
// an icon + label per the project's dataviz skill, never color alone.
const STATUS_GOOD = "#0ca30c";
const SERIES_BLUE = { light: "#2a78d6", dark: "#3987e5" };

export function GoalProgressBar({ progress }: { progress: number }) {
  const complete = progress >= 100;

  return (
    <div className="space-y-1" data-testid="goal-progress">
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full [background:var(--bar-light)] dark:[background:var(--bar-dark)]"
          style={
            {
              width: `${Math.min(100, Math.max(0, progress))}%`,
              "--bar-light": complete ? STATUS_GOOD : SERIES_BLUE.light,
              "--bar-dark": complete ? STATUS_GOOD : SERIES_BLUE.dark,
            } as React.CSSProperties
          }
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {complete ? <span style={{ color: STATUS_GOOD }}>✓ Complete</span> : `${progress}%`}
      </p>
    </div>
  );
}
