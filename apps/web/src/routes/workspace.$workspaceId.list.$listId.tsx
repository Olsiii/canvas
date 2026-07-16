import { TaskBoard } from "@/components/task-board";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const listRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/l/$listId",
  component: ListPage,
});

function ListPage() {
  const { workspaceId, listId } = listRoute.useParams();
  const tree = trpc.hierarchy.tree.useQuery({ workspaceId });

  const list = tree.data?.lists.find((l) => l.id === listId);
  const space = list ? tree.data?.spaces.find((s) => s.id === list.spaceId) : undefined;
  const folder = list?.folderId
    ? tree.data?.folders.find((f) => f.id === list.folderId)
    : undefined;

  if (tree.isLoading) {
    return <p className="text-muted-foreground p-8 text-sm">Loading…</p>;
  }

  if (!list) {
    return (
      <p className="text-muted-foreground p-8 text-sm">This list doesn't exist (or was deleted).</p>
    );
  }

  return (
    <div>
      <div className="px-6 pt-6">
        <p className="text-muted-foreground text-xs">
          {space?.name}
          {folder ? ` / ${folder.name}` : ""}
        </p>
        <h1 className="text-lg font-semibold"># {list.name}</h1>
      </div>
      <TaskBoard listId={listId} />
    </div>
  );
}
