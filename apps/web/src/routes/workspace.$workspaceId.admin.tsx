import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createRoute, Navigate } from "@tanstack/react-router";
import { Activity, DatabaseBackup, Gauge, HeartPulse } from "lucide-react";
import { useRef } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const adminRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/admin",
  component: AdminPage,
});

function AdminPage() {
  const { workspaceId } = adminRoute.useParams();
  // Same gate as the Platform nav group — owner/admin only. Members who
  // deep-link here are bounced home; API procedures still enforce
  // workspace:manage server-side.
  const workspaces = trpc.workspace.listMine.useQuery();
  const myRole = workspaces.data?.find((w) => w.workspace.id === workspaceId)?.role;
  const allowed = myRole === "owner" || myRole === "admin";

  if (workspaces.isLoading) {
    return (
      <p className="text-muted-foreground p-6 text-sm" data-testid="admin-loading">
        Loading…
      </p>
    );
  }

  if (!allowed) {
    return <Navigate to="/w/$workspaceId" params={{ workspaceId }} replace />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6" data-testid="admin-page">
      <div className="flex items-center gap-2">
        <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
          <Gauge className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Admin</h1>
          <p className="text-muted-foreground text-xs">
            System status, audit log, backups, and your AI quota. Visible to workspace owners and
            admins only.
          </p>
        </div>
      </div>

      <StatusSection workspaceId={workspaceId} />
      <AiQuotaSection workspaceId={workspaceId} />
      <BackupSection workspaceId={workspaceId} />
      <AuditSection workspaceId={workspaceId} />
    </div>
  );
}

function StatusSection({ workspaceId }: { workspaceId: string }) {
  const status = trpc.admin.status.useQuery({ workspaceId });

  return (
    <section className="space-y-2" data-testid="admin-status">
      <div className="flex items-center gap-2">
        <HeartPulse className="text-muted-foreground h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Status</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        Same checks as <code className="text-foreground">GET /health</code> (API, Postgres, Redis).
      </p>
      {status.isLoading && <p className="text-muted-foreground text-xs">Checking…</p>}
      {status.error && <p className="text-xs text-red-500">{status.error.message}</p>}
      {status.data && (
        <div className="border-border divide-border divide-y rounded-md border text-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <span>Overall</span>
            <StatusPill ok={status.data.ok} />
          </div>
          {Object.entries(status.data.checks).map(([name, value]) => (
            <div key={name} className="flex items-center justify-between px-3 py-2">
              <span className="capitalize">{name}</span>
              <StatusPill ok={value === "ok"} />
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void status.refetch()}
        disabled={status.isFetching}
      >
        Refresh
      </Button>
    </section>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "bg-status-good/15 text-status-good rounded px-2 py-0.5 text-xs font-medium"
          : "bg-status-critical/15 text-status-critical rounded px-2 py-0.5 text-xs font-medium"
      }
    >
      {ok ? "ok" : "error"}
    </span>
  );
}

function AiQuotaSection({ workspaceId }: { workspaceId: string }) {
  const quota = trpc.admin.myAiQuota.useQuery({ workspaceId });
  if (!quota.data) return null;
  const q = quota.data;

  return (
    <section className="space-y-2" data-testid="admin-ai-quota">
      <h2 className="text-sm font-semibold">Your AI quota</h2>
      <ul className="border-border divide-border divide-y rounded-md border text-sm">
        <li className="flex justify-between px-3 py-2">
          <span>Brain messages today</span>
          <span className="font-mono text-xs">
            {q.brainMessagesUsedToday} / {q.brainMessagesPerDay}
          </span>
        </li>
        <li className="flex justify-between px-3 py-2">
          <span>Image generates today</span>
          <span className="font-mono text-xs">
            {q.imageGenerationsUsedToday} / {q.imageGenerationsPerDay}
          </span>
        </li>
        <li className="flex justify-between px-3 py-2">
          <span>Est. spend this month (Canvas-wide, all users)</span>
          <span className="font-mono text-xs">
            ${q.costUsdSpentThisMonth.toFixed(2)} / ${q.costUsdPerMonth}
          </span>
        </li>
      </ul>
    </section>
  );
}

function BackupSection({ workspaceId }: { workspaceId: string }) {
  const guidance = trpc.admin.backupGuidance.useQuery({ workspaceId });

  return (
    <section className="space-y-2" data-testid="admin-backups">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="text-muted-foreground h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Backups (VPS)</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        Hosting target is a single VPS with Docker Compose. Run these on the box (or via cron).
      </p>
      {guidance.data && (
        <>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
            {guidance.data.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="bg-muted rounded-md p-2 font-mono text-[11px]">
            {guidance.data.restoreHint}
          </p>
        </>
      )}
    </section>
  );
}

function AuditSection({ workspaceId }: { workspaceId: string }) {
  const activity = trpc.activity.listWorkspace.useQuery({
    workspaceId,
    limit: 100,
  });
  const rows = activity.data ?? [];
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  return (
    <section className="space-y-2" data-testid="admin-audit">
      <div className="flex items-center gap-2">
        <Activity className="text-muted-foreground h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold">Audit log</h2>
      </div>
      <p className="text-muted-foreground text-xs">Recent workspace activity (newest first).</p>
      {activity.isLoading && <p className="text-muted-foreground text-xs">Loading…</p>}
      {rows.length === 0 && !activity.isLoading ? (
        <p className="text-muted-foreground text-xs">No activity yet.</p>
      ) : (
        <div
          ref={parentRef}
          className="border-border h-80 overflow-auto rounded-md border"
          data-testid="admin-audit-list"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]!;
              return (
                <div
                  key={row.id}
                  className="absolute right-0 left-0 flex items-baseline gap-2 border-b px-3 py-2 text-xs"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <span className="text-foreground shrink-0 font-medium">{row.actorName}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono">
                    {row.verb} · {row.entityType}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatRelativeTime(new Date(row.createdAt))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
