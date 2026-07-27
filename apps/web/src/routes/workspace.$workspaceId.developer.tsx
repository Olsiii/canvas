import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const developerRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/developer",
  component: DeveloperPage,
});

function DeveloperPage() {
  const { workspaceId } = developerRoute.useParams();

  return (
    <div className="max-w-2xl space-y-8 p-6" data-testid="developer-page">
      <div className="flex items-center gap-2">
        <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
          <Code2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Developer</h1>
          <p className="text-muted-foreground text-xs">
            API keys, webhooks, and data export for this workspace.
          </p>
        </div>
      </div>
      <ApiKeysSection workspaceId={workspaceId} />
      <WebhooksSection workspaceId={workspaceId} />
      <ExportSection workspaceId={workspaceId} />
    </div>
  );
}

// Phase 6: data export. Plain <a> links to REST routes (not tRPC — a file
// download needs real Content-Disposition headers), authenticated the same
// way image thumbnails already are: the browser sends the session cookie
// on same-origin navigation, no separate token needed.
function ExportSection({ workspaceId }: { workspaceId: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Export data</h2>
      <p className="text-muted-foreground text-xs">
        Download this workspace's tasks as a spreadsheet, or the full task/hierarchy graph as JSON.
      </p>
      <div className="flex gap-2">
        <a
          href={`/export/${workspaceId}/tasks.csv`}
          data-testid="export-tasks-csv"
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Download tasks (CSV)
        </a>
        <a
          href={`/export/${workspaceId}/workspace.json`}
          data-testid="export-workspace-json"
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Download workspace (JSON)
        </a>
      </div>
    </section>
  );
}

function ApiKeysSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const keys = trpc.apiKey.list.useQuery({ workspaceId });
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const create = trpc.apiKey.create.useMutation({
    onSuccess: (created) => {
      void utils.apiKey.list.invalidate({ workspaceId });
      setRevealedKey(created.key);
      setName("");
    },
  });
  const remove = trpc.apiKey.delete.useMutation({
    onSuccess: () => void utils.apiKey.list.invalidate({ workspaceId }),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({ workspaceId, name: name.trim() || "Untitled key" });
  }

  return (
    <section className="space-y-3" data-testid="api-keys-section">
      <h2 className="text-sm font-semibold">API keys</h2>
      <p className="text-muted-foreground text-xs">
        Bearer tokens for the public REST API (<code>/api/v1</code>), scoped to this workspace at
        whatever role you hold when you use them.
      </p>

      {revealedKey && (
        <div className="border-border space-y-1 rounded-md border p-3" data-testid="revealed-key">
          <p className="text-xs font-medium">Copy this now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={revealedKey} className="h-8 font-mono text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealedKey);
              }}
            >
              Copy
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. CI pipeline"
          className="h-8 max-w-xs text-sm"
          data-testid="api-key-new-name"
        />
        <Button type="submit" size="sm" disabled={create.isPending} data-testid="api-key-create">
          {create.isPending ? "Creating…" : "New key"}
        </Button>
      </form>
      {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}

      {(keys.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">No API keys yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border text-sm">
          {keys.data?.map((key) => (
            <li
              key={key.id}
              data-testid={`api-key-row-${key.id}`}
              className="flex items-center justify-between px-3 py-2"
            >
              <div>
                <span className="font-medium">{key.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {key.lastUsedAt
                    ? `last used ${new Date(key.lastUsedAt).toLocaleString()}`
                    : "never used"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate({ apiKeyId: key.id })}
                aria-label={`Delete key ${key.name}`}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WebhooksSection({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const webhooks = trpc.webhook.list.useQuery({ workspaceId });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  const create = trpc.webhook.create.useMutation({
    onSuccess: () => {
      void utils.webhook.list.invalidate({ workspaceId });
      setUrl("");
      setEvents([]);
    },
  });
  const remove = trpc.webhook.delete.useMutation({
    onSuccess: () => void utils.webhook.list.invalidate({ workspaceId }),
  });

  function toggleEvent(event: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (events.length === 0) return;
    create.mutate({ workspaceId, url: url.trim(), events });
  }

  return (
    <section className="space-y-3" data-testid="webhooks-section">
      <h2 className="text-sm font-semibold">Webhooks</h2>
      <p className="text-muted-foreground text-xs">
        Sends a notification to another tool the moment something you pick below happens here — no
        need for it to keep checking back.
      </p>
      <p className="text-muted-foreground text-xs">
        Technical detail: we POST a signed JSON payload to your URL. Verify it with the{" "}
        <code>X-Canvas-Signature</code> header (HMAC-SHA256 of the body, using the secret below).
      </p>

      <form onSubmit={handleCreate} className="space-y-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhooks/canvas"
          className="h-8 text-sm"
          data-testid="webhook-new-url"
        />
        <div className="flex flex-wrap gap-3">
          {WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={events.includes(event)}
                onChange={() => toggleEvent(event)}
                data-testid={`webhook-event-${event}`}
              />
              {event}
            </label>
          ))}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending || events.length === 0}
          data-testid="webhook-create"
        >
          {create.isPending ? "Creating…" : "New webhook"}
        </Button>
      </form>
      {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}

      {(webhooks.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">No webhooks yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border text-sm">
          {webhooks.data?.map((webhook) => (
            <li
              key={webhook.id}
              data-testid={`webhook-row-${webhook.id}`}
              className="space-y-1 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{webhook.url}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate({ webhookId: webhook.id })}
                  aria-label={`Delete webhook ${webhook.url}`}
                >
                  Delete
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{webhook.events.join(", ")}</p>
              <p className="text-muted-foreground font-mono text-xs" data-testid="webhook-secret">
                secret: {webhook.secret}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
