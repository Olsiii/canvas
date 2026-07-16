import type { AppRouter } from "@canvas/api";
import { STATUS_KINDS } from "@canvas/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Status = RouterOutputs["status"]["list"][number];
type Task = RouterOutputs["task"]["list"][number];

const STATUS_PALETTE = ["#94a3b8", "#3b82f6", "#a855f7", "#f59e0b", "#22c55e", "#ef4444"];

export function TaskBoard({ listId }: { listId: string }) {
  const utils = trpc.useUtils();
  const statuses = trpc.status.list.useQuery({ listId });
  const tasks = trpc.task.list.useQuery({ listId });
  const [addingStatus, setAddingStatus] = useState(false);

  const invalidateStatuses = () => utils.status.list.invalidate({ listId });
  const invalidateTasks = () => utils.task.list.invalidate({ listId });

  const createStatus = trpc.status.create.useMutation({
    onSuccess: () => {
      invalidateStatuses();
      setAddingStatus(false);
    },
  });

  if (statuses.isLoading || tasks.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const statusList = statuses.data ?? [];
  const taskList = tasks.data ?? [];

  return (
    <div className="flex items-start gap-4 overflow-x-auto p-6">
      {statusList.map((status) => (
        <StatusColumn
          key={status.id}
          listId={listId}
          status={status}
          statuses={statusList}
          tasks={taskList.filter((t) => t.statusId === status.id)}
          onTasksChanged={invalidateTasks}
          onStatusesChanged={invalidateStatuses}
        />
      ))}

      <div className="w-64 shrink-0">
        {addingStatus ? (
          <NewStatusForm
            isPending={createStatus.isPending}
            onCancel={() => setAddingStatus(false)}
            onSubmit={(name, kind) =>
              createStatus.mutate({
                listId,
                name,
                kind,
                color: STATUS_PALETTE[statusList.length % STATUS_PALETTE.length] ?? "#94a3b8",
              })
            }
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingStatus(true)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            + Add status
          </button>
        )}
      </div>
    </div>
  );
}

function StatusColumn({
  listId,
  status,
  statuses,
  tasks,
  onTasksChanged,
  onStatusesChanged,
}: {
  listId: string;
  status: Status;
  statuses: Status[];
  tasks: Task[];
  onTasksChanged: () => void;
  onStatusesChanged: () => void;
}) {
  const [addingTask, setAddingTask] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      onTasksChanged();
      setAddingTask(false);
    },
  });
  const deleteStatus = trpc.status.delete.useMutation({
    onSuccess: onStatusesChanged,
    onError: (err) => setDeleteError(err.message),
  });

  return (
    <div className="w-64 shrink-0 space-y-2">
      <div className="group flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: status.color }}
          aria-hidden
        />
        <span className="flex-1 truncate text-sm font-medium">{status.name}</span>
        <span className="text-muted-foreground text-xs">{tasks.length}</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete status"
          title="Delete status"
          className="text-muted-foreground hover:text-foreground hidden text-xs group-hover:inline"
        >
          ✕
        </button>
      </div>

      {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
      {confirmingDelete && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Delete "{status.name}"?</span>
          <button
            type="button"
            className="text-red-500"
            disabled={deleteStatus.isPending}
            onClick={() => deleteStatus.mutate({ statusId: status.id })}
          >
            Delete
          </button>
          <button
            type="button"
            className="text-muted-foreground"
            onClick={() => {
              setConfirmingDelete(false);
              setDeleteError(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} statuses={statuses} task={task} onChanged={onTasksChanged} />
        ))}
      </div>

      {addingTask ? (
        <NewTaskForm
          isPending={createTask.isPending}
          onCancel={() => setAddingTask(false)}
          onSubmit={(title) => createTask.mutate({ listId, statusId: status.id, title })}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingTask(true)}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          + Add task
        </button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  statuses,
  onChanged,
}: {
  task: Task;
  statuses: Status[];
  onChanged: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const update = trpc.task.update.useMutation({ onSuccess: onChanged });
  const del = trpc.task.delete.useMutation({ onSuccess: onChanged });

  return (
    <div className="group border-border rounded-md border p-2">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm">{task.title}</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete task"
          title="Delete task"
          className="text-muted-foreground hover:text-foreground hidden text-xs group-hover:inline"
        >
          ✕
        </button>
      </div>
      <select
        value={task.statusId}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ taskId: task.id, statusId: e.target.value })}
        className="border-border bg-background mt-1.5 h-6 w-full rounded border text-xs"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {confirmingDelete && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Delete task?</span>
          <button
            type="button"
            className="text-red-500"
            disabled={del.isPending}
            onClick={() => del.mutate({ taskId: task.id })}
          >
            Delete
          </button>
          <button
            type="button"
            className="text-muted-foreground"
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function NewTaskForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim());
      }}
    >
      <Input
        autoFocus
        value={title}
        placeholder="Task title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (!title.trim()) onCancel();
        }}
        className="h-7 text-xs"
      />
      <Button
        type="submit"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={isPending || !title.trim()}
      >
        Add
      </Button>
    </form>
  );
}

function NewStatusForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (name: string, kind: (typeof STATUS_KINDS)[number]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof STATUS_KINDS)[number]>("open");
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), kind);
      }}
    >
      <Input
        autoFocus
        value={name}
        placeholder="Status name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className="h-7 text-xs"
      />
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as (typeof STATUS_KINDS)[number])}
        className="border-border bg-background h-7 w-full rounded border text-xs"
      >
        {STATUS_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={isPending || !name.trim()}
      >
        Add status
      </Button>
    </form>
  );
}
