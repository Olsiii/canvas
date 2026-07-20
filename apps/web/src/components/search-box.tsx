import type { AppRouter } from "@canvas/api";
import { trpc } from "@/lib/trpc";
import { useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SearchResult = RouterOutputs["task"]["search"][number];

const DEBOUNCE_MS = 250;

// Workspace-wide task search (DATA_MODEL.md's Postgres FTS tsvector on
// title + description). Debounced inline with a plain useEffect/setTimeout
// rather than a new dependency — small enough not to warrant one, same
// judgment call the codebase already made for other small utilities.
export function SearchBox({ workspaceId }: { workspaceId: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const results = trpc.task.search.useQuery(
    { workspaceId, query },
    { enabled: query.length > 0 },
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openResult(result: SearchResult) {
    setOpen(false);
    setInput("");
    navigate({
      to: "/w/$workspaceId/l/$listId",
      params: { workspaceId, listId: result.listId },
      search: { openTask: result.id },
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={input}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="border-border bg-background h-7 w-full rounded border px-2 text-xs"
      />

      {open && query.length > 0 && (
        <div
          data-testid="search-results"
          className="border-border bg-background absolute top-full left-0 z-50 mt-1 w-72 rounded-md border shadow-lg"
        >
          {results.isLoading && <p className="text-muted-foreground p-2 text-xs">Searching…</p>}
          {!results.isLoading && (results.data ?? []).length === 0 && (
            <p className="text-muted-foreground p-2 text-xs">No matching tasks.</p>
          )}
          {(results.data ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openResult(r)}
              className="border-border hover:bg-muted block w-full border-b px-2 py-1.5 text-left text-xs last:border-b-0"
            >
              <div className="truncate font-medium">{r.title}</div>
              <div className="text-muted-foreground truncate">
                {r.spaceName} / {r.listName}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
