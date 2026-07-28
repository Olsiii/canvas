import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { type ImportStatus } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  History,
  Info,
  Loader2,
  Sheet,
  Upload,
  UploadCloud,
  XCircle,
} from "lucide-react";
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
            Bring in work from a file on your computer, or a Google Sheet.
          </p>
        </div>
      </div>
      <CsvImportSection workspaceId={workspaceId} />
      <GoogleSheetImportSection workspaceId={workspaceId} />
      <SeriImportNotice />
      <ImportHistorySection workspaceId={workspaceId} />
    </div>
  );
}

function CsvImportSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
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
        <CardTitle>Import from your computer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Upload a CSV export (from any tool) — creates one new space containing one new list, with
          a status per distinct section/list column value in the file.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
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

function GoogleSheetImportSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const [spaceName, setSpaceName] = useState("");
  const [listName, setListName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");

  const start = trpc.import.startGoogleSheet.useMutation({
    onSuccess: () => {
      void utils.import.list.invalidate({ workspaceId });
      setSpaceName("");
      setListName("");
      setSheetUrl("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sheetUrl.trim() || !spaceName.trim() || !listName.trim()) return;
    start.mutate({
      workspaceId,
      spaceName: spaceName.trim(),
      listName: listName.trim(),
      sheetUrl: sheetUrl.trim(),
    });
  }

  return (
    <Card data-testid="google-sheet-import-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Sheet className="h-4 w-4" aria-hidden />
          Import from Google Sheets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Paste a sheet published to the web as CSV (File → Share → Publish to web → CSV). Same
          result as the computer upload above — one new space with one new list.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
            className="h-8 text-sm"
            data-testid="sheet-url"
          />
          <Input
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            placeholder="New space name"
            className="h-8 text-sm"
            data-testid="sheet-space-name"
          />
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="New list name"
            className="h-8 text-sm"
            data-testid="sheet-list-name"
          />
          <Button
            type="submit"
            size="sm"
            disabled={start.isPending || !sheetUrl.trim() || !spaceName.trim() || !listName.trim()}
            data-testid="sheet-import-start"
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

// Seri (trekuartista's internal task tool) isn't wired up yet — building a
// real importer needs to know what Seri can actually expose (a REST API to
// call, or a file it can export), which wasn't available when this page
// was built. Left as a visible placeholder rather than a silent gap.
function SeriImportNotice() {
  return (
    <Card className="border-dashed" data-testid="seri-import-notice">
      <CardContent className="flex items-start gap-2 p-4">
        <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">Importing from Seri isn't built yet.</span>{" "}
          To wire this up we need to know what Seri can expose — either a REST API (endpoint + auth)
          we can call directly, or a file it can export that we can parse. Once that's known, this
          becomes a third import option here.
        </p>
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
                      {row.sourceDetail === "google_sheets" ? "Google Sheets" : "Computer upload"}
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
