import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CSV_IMPORT_TOOLS, type CsvImportTool, type ImportStatus } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, History, Loader2, Upload, UploadCloud, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const importRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/import",
  component: ImportPage,
});

function ImportPage() {
  const { workspaceId } = importRoute.useParams();

  return (
    <div className="max-w-2xl space-y-6 p-6" data-testid="import-page">
      <div className="flex items-center gap-2">
        <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
          <Upload className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Import</h1>
          <p className="text-muted-foreground text-xs">
            Bring in work from ClickUp, or a Trello/Asana CSV export.
          </p>
        </div>
      </div>
      <ClickUpImportSection workspaceId={workspaceId} />
      <CsvImportSection workspaceId={workspaceId} />
      <ImportHistorySection workspaceId={workspaceId} />
    </div>
  );
}

function ClickUpImportSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const [apiToken, setApiToken] = useState("");

  const start = trpc.import.startClickUp.useMutation({
    onSuccess: () => {
      void utils.import.list.invalidate({ workspaceId });
      setApiToken("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiToken.trim()) return;
    start.mutate({ workspaceId, apiToken: apiToken.trim() });
  }

  return (
    <Card data-testid="clickup-import-section">
      <CardHeader>
        <CardTitle>Import from ClickUp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Brings in every space, folder, list, and task your ClickUp API token can see (first
          authorized workspace) as new spaces/lists/tasks here.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="ClickUp personal API token"
            className="h-8 max-w-xs text-sm"
            data-testid="clickup-token-input"
          />
          <Button
            type="submit"
            size="sm"
            disabled={start.isPending || !apiToken.trim()}
            data-testid="clickup-import-start"
            className="gap-1.5"
          >
            {start.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            )}
            {start.isPending ? "Starting…" : "Import"}
          </Button>
        </form>
        {start.error && <p className="text-xs text-red-500">{start.error.message}</p>}
      </CardContent>
    </Card>
  );
}

function CsvImportSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const [tool, setTool] = useState<CsvImportTool>("trello");
  const [spaceName, setSpaceName] = useState("");
  const [listName, setListName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !spaceName.trim() || !listName.trim()) return;
    setError(null);
    setIsUploading(true);

    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("tool", tool);
    form.set("spaceName", spaceName.trim());
    form.set("listName", listName.trim());
    form.set("file", file);

    try {
      const response = await fetch("/imports/csv", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Import failed");
      setSpaceName("");
      setListName("");
      setFile(null);
      void utils.import.list.invalidate({ workspaceId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card data-testid="csv-import-section">
      <CardHeader>
        <CardTitle>Import from a Trello/Asana CSV export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Creates one new space containing one new list, with a status per distinct section/list
          column value in the file.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-3">
            {CSV_IMPORT_TOOLS.map((t) => (
              <label key={t} className="flex items-center gap-1 text-xs capitalize">
                <input
                  type="radio"
                  name="csv-tool"
                  checked={tool === t}
                  onChange={() => setTool(t)}
                  data-testid={`csv-tool-${t}`}
                />
                {t}
              </label>
            ))}
          </div>
          <Input
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder="New space name"
            className="h-8 text-sm"
            data-testid="csv-space-name"
          />
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="New list name"
            className="h-8 text-sm"
            data-testid="csv-list-name"
          />
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="csv-file-input"
            className="text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isUploading || !file || !spaceName.trim() || !listName.trim()}
            data-testid="csv-import-start"
            className="gap-1.5"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            )}
            {isUploading ? "Uploading…" : "Import"}
          </Button>
        </form>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}

const STATUS_COLOR: Record<ImportStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-accent",
  done: "text-status-good",
  failed: "text-status-critical",
};

const STATUS_ICON: Record<ImportStatus, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  done: CheckCircle2,
  failed: XCircle,
};

function ImportHistorySection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const previouslyRunning = useRef(new Set<string>());

  const imports = trpc.import.list.useQuery(
    { workspaceId },
    {
      refetchInterval: (query) => {
        const rows = query.state.data;
        const stillRunning = rows?.some((r) => r.status === "pending" || r.status === "running");
        return stillRunning ? 1500 : false;
      },
    },
  );

  // The hierarchy sidebar's own query has no other reason to refetch once
  // an import finishes — imported spaces/lists/tasks are created by a
  // background worker, not the mutation the sidebar's cache is normally
  // invalidated alongside (see hierarchy.ts's own create mutations, which
  // invalidate synchronously from the request that made the change).
  useEffect(() => {
    const stillRunningIds = new Set(
      (imports.data ?? [])
        .filter((r) => r.status === "pending" || r.status === "running")
        .map((r) => r.id),
    );
    const justFinished = [...previouslyRunning.current].some((id) => !stillRunningIds.has(id));
    if (justFinished) {
      void utils.hierarchy.tree.invalidate({ workspaceId });
    }
    previouslyRunning.current = stillRunningIds;
  }, [imports.data, utils, workspaceId]);

  return (
    <Card data-testid="import-history-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" aria-hidden />
          Import history
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(imports.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-xs">No imports yet.</p>
        ) : (
          <div className="divide-border divide-y rounded-md border text-sm">
            {imports.data?.map((row) => {
              const summary = row.summaryJson as {
                spacesCreated: number;
                listsCreated: number;
                tasksCreated: number;
              } | null;
              const status = row.status as ImportStatus;
              const StatusIcon = STATUS_ICON[status];
              return (
                <div key={row.id} data-testid={`import-row-${row.id}`} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>
                      {row.source === "clickup_api" ? "ClickUp" : `CSV (${row.sourceDetail})`}
                    </span>
                    <span
                      className={`flex items-center gap-1 ${STATUS_COLOR[status]}`}
                      data-testid={`import-status-${row.id}`}
                    >
                      <StatusIcon
                        className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`}
                        aria-hidden
                      />
                      {row.status}
                    </span>
                  </div>
                  {summary && (
                    <p className="text-muted-foreground text-xs">
                      {summary.spacesCreated} space{summary.spacesCreated === 1 ? "" : "s"},{" "}
                      {summary.listsCreated} list{summary.listsCreated === 1 ? "" : "s"},{" "}
                      {summary.tasksCreated} task{summary.tasksCreated === 1 ? "" : "s"}
                    </p>
                  )}
                  {row.error && <p className="text-xs text-red-500">{row.error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
