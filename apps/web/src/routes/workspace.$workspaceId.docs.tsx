import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const docsListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/docs",
  component: DocsListPage,
});

function DocsListPage() {
  const { workspaceId } = docsListRoute.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const docs = trpc.doc.list.useQuery({ workspaceId });
  const create = trpc.doc.create.useMutation({
    onSuccess: (doc) => {
      void utils.doc.list.invalidate({ workspaceId });
      void navigate({
        to: "/w/$workspaceId/docs/$docId",
        params: { workspaceId, docId: doc.id },
      });
    },
  });
  const [title, setTitle] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      workspaceId,
      title: title.trim() || "Untitled",
    });
    setTitle("");
  }

  return (
    <div className="space-y-4 p-6" data-testid="docs-list-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Docs</h1>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-md gap-2">
        <Input
          data-testid="docs-new-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New doc title"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={create.isPending} data-testid="docs-create">
          {create.isPending ? "Creating…" : "New doc"}
        </Button>
      </form>

      {docs.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (docs.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">No docs yet. Create one to collaborate.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {docs.data?.map((doc) => (
            <li key={doc.id}>
              <Link
                to="/w/$workspaceId/docs/$docId"
                params={{ workspaceId, docId: doc.id }}
                data-testid={`docs-link-${doc.id}`}
                className="hover:bg-muted flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">{doc.title}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(doc.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
