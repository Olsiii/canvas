import { TaskBoard } from "@/components/task-board";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { TaskListView } from "@/components/task-list-view";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const listRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/l/$listId",
  component: ListPage,
});

function ListPage() {
  const { workspaceId, listId } = listRoute.useParams();
  const tree = trpc.hierarchy.tree.useQuery({ workspaceId });
  const [view, setView] = useState<"list" | "board">("list");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

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
      <div className="flex items-end justify-between px-6 pt-6">
        <div>
          <p className="text-muted-foreground text-xs">
            {space?.name}
            {folder ? ` / ${folder.name}` : ""}
          </p>
          <h1 className="text-lg font-semibold"># {list.name}</h1>
        </div>
        <div className="flex gap-1 text-sm">
          <button
            type="button"
            onClick={() => setView("list")}
            className={
              view === "list" ? "font-medium" : "text-muted-foreground hover:text-foreground"
            }
          >
            List
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => setView("board")}
            className={
              view === "board" ? "font-medium" : "text-muted-foreground hover:text-foreground"
            }
          >
            Board
          </button>
        </div>
      </div>
      {view === "list" ? (
        <TaskListView listId={listId} onOpenTask={setOpenTaskId} />
      ) : (
        <TaskBoard listId={listId} onOpenTask={setOpenTaskId} />
      )}

      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          workspaceId={workspaceId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
