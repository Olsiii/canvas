import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { rootRoute } from "./__root";

export const newWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspaces/new",
  component: () => (
    <RequireAuth>
      <NewWorkspacePage />
    </RequireAuth>
  ),
});

function NewWorkspacePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.workspace.create.useMutation({
    onSuccess: async () => {
      await utils.workspace.listMine.invalidate();
      navigate({ to: "/" });
    },
    onError: (err) => setError(err.message),
  });

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold">Create a workspace</h1>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate({ name });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </main>
  );
}
