import type { AppRouter } from "@canvas/api";
import { Section } from "@/components/detail-field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PrLink = RouterOutputs["prLink"]["list"][number];

const STATE_LABEL: Record<PrLink["state"], string> = {
  open: "Open",
  closed: "Closed",
  merged: "Merged",
  unknown: "Unknown",
};

const STATE_CLASS: Record<PrLink["state"], string> = {
  open: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  merged: "border-violet-500/50 text-violet-600 dark:text-violet-400",
  closed: "border-border text-muted-foreground",
  unknown: "border-border text-muted-foreground",
};

/** M5.6 integrations: paste a GitHub PR URL, see its live title/status, refresh or remove it. */
export function PrLinksSection({ taskId }: { taskId: string }) {
  const utils = trpc.useUtils();
  const links = trpc.prLink.list.useQuery({ taskId });
  const invalidate = () => utils.prLink.list.invalidate({ taskId });

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = trpc.prLink.create.useMutation({
    onSuccess: () => {
      invalidate();
      setUrl("");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });
  const refresh = trpc.prLink.refresh.useMutation({ onSuccess: invalidate });
  const remove = trpc.prLink.delete.useMutation({ onSuccess: invalidate });

  return (
    <Section label="Linked pull requests">
      <div className="space-y-2">
        {(links.data ?? []).length === 0 && (
          <p className="text-muted-foreground text-xs">No pull requests linked yet.</p>
        )}
        {(links.data ?? []).map((link) => (
          <div
            key={link.id}
            data-testid={`pr-link-row-${link.id}`}
            className="group border-border flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
          >
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate hover:underline"
            >
              {link.title ?? `${link.owner}/${link.repo}#${link.number}`}
            </a>
            <span
              data-testid={`pr-link-state-${link.id}`}
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATE_CLASS[link.state]}`}
            >
              {STATE_LABEL[link.state]}
            </span>
            <button
              type="button"
              aria-label={`Refresh status for ${link.owner}/${link.repo}#${link.number}`}
              onClick={() => refresh.mutate({ prLinkId: link.id })}
              className="text-muted-foreground hover:text-foreground hidden shrink-0 group-hover:inline"
            >
              ↻
            </button>
            <button
              type="button"
              aria-label={`Remove PR link ${link.owner}/${link.repo}#${link.number}`}
              onClick={() => remove.mutate({ prLinkId: link.id })}
              className="text-muted-foreground hover:text-foreground hidden shrink-0 group-hover:inline"
            >
              ✕
            </button>
          </div>
        ))}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) create.mutate({ taskId, url: url.trim() });
          }}
        >
          <Input
            value={url}
            placeholder="Paste a GitHub PR URL…"
            aria-label="GitHub PR URL"
            data-testid="pr-link-url-input"
            onChange={(e) => setUrl(e.target.value)}
            className="h-7 text-xs"
          />
          <button
            type="submit"
            disabled={!url.trim() || create.isPending}
            data-testid="pr-link-add"
            className="bg-primary text-primary-foreground h-7 shrink-0 rounded px-2 text-xs disabled:opacity-50"
          >
            Link PR
          </button>
        </form>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </Section>
  );
}
