import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CSV_IMPORT_TOOLS, type CsvImportTool, type ImportStatus } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
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
    <div className="max-w-2xl space-y-8 p-6" data-testid="import-page">
      <h1 className="text-lg font-semibold">Import</h1>
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
    <section className="space-y-3" data-testid="clickup-import-section">
      <h2 className="text-sm font-semibold">Import from ClickUp</h2>
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
        >
          {start.isPending ? "Starting…" : "Import"}
        </Button>
      </form>
      {start.error && <p className="text-xs text-red-500">{start.error.message}</p>}
    </section>
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
    <section className="space-y-3" data-testid="csv-import-section">
      <h2 className="text-sm font-semibold">Import from a Trello/Asana CSV export</h2>
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
        >
          {isUploading ? "Uploading…" : "Import"}
        </Button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </section>
  );
}

const STATUS_COLOR: Record<ImportStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-blue-600",
  done: "text-green-600",
  failed: "text-red-500",
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
    <section className="space-y-3" data-testid="import-history-section">
      <h2 className="text-sm font-semibold">Import history</h2>
      {(imports.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">No imports yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border text-sm">
          {imports.data?.map((row) => {
            const summary = row.summaryJson as {
              spacesCreated: number;
              listsCreated: number;
              tasksCreated: number;
            } | null;
            return (
              <li key={row.id} data-testid={`import-row-${row.id}`} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>
                    {row.source === "clickup_api" ? "ClickUp" : `CSV (${row.sourceDetail})`}
                  </span>
                  <span
                    className={STATUS_COLOR[row.status as ImportStatus]}
                    data-testid={`import-status-${row.id}`}
                  >
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
