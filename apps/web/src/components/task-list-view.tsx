import type { AppRouter } from "@canvas/api";
import { Input } from "@/components/ui/input";
import { useOptimisticTaskUpdate } from "@/hooks/use-task-mutations";
import { trpc } from "@/lib/trpc";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type GroupingState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { inferRouterOutputs } from "@trpc/server";
import { useMemo, useRef, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Status = RouterOutputs["status"]["list"][number];
type Task = RouterOutputs["task"]["list"][number];

const ROW_HEIGHT = 36;
const COLUMNS = "grid-cols-[1fr_160px_140px]";

const columnHelper = createColumnHelper<Task>();

export function TaskListView({ listId }: { listId: string }) {
  const statuses = trpc.status.list.useQuery({ listId });
  const tasks = trpc.task.list.useQuery({ listId });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([{ id: "title", desc: false }]);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const isGroupedByStatus = grouping.includes("statusId");
  // Groups themselves always sort in workflow order; the user's chosen sort
  // (e.g. title) becomes the secondary, within-group sort. Memoized so the
  // array reference is stable across renders — TanStack Table's row-model
  // memoization keys off it, and a fresh array every render defeats that.
  const effectiveSorting = useMemo<SortingState>(
    () =>
      isGroupedByStatus
        ? [{ id: "statusId", desc: false }, ...sorting.filter((s) => s.id !== "statusId")]
        : sorting,
    [isGroupedByStatus, sorting],
  );

  const statusList = useMemo(() => statuses.data ?? [], [statuses.data]);
  const statusById = useMemo(() => new Map(statusList.map((s) => [s.id, s])), [statusList]);
  const statusOrder = useMemo(() => new Map(statusList.map((s, i) => [s.id, i])), [statusList]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks.data ?? []).filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(t.statusId)) return false;
      return true;
    });
  }, [tasks.data, search, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => <EditableTitle listId={listId} task={info.row.original} />,
      }),
      columnHelper.accessor("statusId", {
        header: "Status",
        cell: (info) => (
          <StatusSelect listId={listId} task={info.row.original} statuses={statusList} />
        ),
        sortingFn: (a, b) =>
          (statusOrder.get(a.original.statusId) ?? 0) - (statusOrder.get(b.original.statusId) ?? 0),
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [listId, statusList, statusOrder],
  );

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting: effectiveSorting, grouping },
    initialState: { expanded: true },
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    // Keep column order fixed regardless of grouping — the grid layout below
    // assigns widths by position, and grouped columns are hidden manually
    // rather than relying on TanStack's default column-reordering behavior.
    groupedColumnMode: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (statuses.isLoading || tasks.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles…"
          className="h-8 w-56 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {statusList.map((s) => {
            const active = statusFilter.size === 0 || statusFilter.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setStatusFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.id)) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  })
                }
                className={`border-border rounded-full border px-2 py-0.5 text-xs ${active ? "" : "text-muted-foreground opacity-50"}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setGrouping(isGroupedByStatus ? [] : ["statusId"])}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Group by status: {isGroupedByStatus ? "on" : "off"}
        </button>
        <span className="text-muted-foreground text-xs">
          {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className={`border-border grid ${COLUMNS} gap-2 border-b px-2 pb-1 text-xs font-medium`}>
        {table.getFlatHeaders().map((header) =>
          isGroupedByStatus && header.column.id === "statusId" ? (
            <span key={header.id} />
          ) : (
            <button
              key={header.id}
              type="button"
              onClick={header.column.getToggleSortingHandler()}
              className="hover:text-foreground text-muted-foreground flex items-center gap-1 text-left"
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() === "asc" && " ▲"}
              {header.column.getIsSorted() === "desc" && " ▼"}
            </button>
          ),
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            const rowStyle = {
              position: "absolute" as const,
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            };

            if (row.getIsGrouped()) {
              const status = statusById.get(row.groupingValue as string);
              return (
                <div
                  key={row.id}
                  style={rowStyle}
                  className="bg-muted/40 flex items-center gap-2 px-2 text-xs font-medium"
                >
                  <button
                    type="button"
                    onClick={row.getToggleExpandedHandler()}
                    className="w-3"
                    aria-label={row.getIsExpanded() ? "Collapse group" : "Expand group"}
                  >
                    {row.getIsExpanded() ? "▾" : "▸"}
                  </button>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: status?.color }}
                    aria-hidden
                  />
                  {status?.name ?? "—"}
                  <span className="text-muted-foreground">({row.subRows.length})</span>
                </div>
              );
            }

            return (
              <div
                key={row.id}
                style={rowStyle}
                className={`border-border grid ${COLUMNS} items-center gap-2 border-b px-2 text-sm`}
              >
                {row.getVisibleCells().map((cell) =>
                  isGroupedByStatus && cell.column.id === "statusId" ? (
                    <span key={cell.id} />
                  ) : (
                    <div key={cell.id} className="truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditableTitle({ listId, task }: { listId: string; task: Task }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const update = useOptimisticTaskUpdate(listId);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(task.title);
          setEditing(true);
        }}
        className="hover:bg-muted w-full truncate rounded px-1 text-left"
        title="Click to edit"
      >
        {task.title}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== task.title) {
      update.mutate({ taskId: task.id, title: trimmed });
    }
  };

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="h-7 text-sm"
    />
  );
}

function StatusSelect({
  listId,
  task,
  statuses,
}: {
  listId: string;
  task: Task;
  statuses: Status[];
}) {
  const update = useOptimisticTaskUpdate(listId);
  return (
    <select
      value={task.statusId}
      disabled={update.isPending}
      onChange={(e) => update.mutate({ taskId: task.id, statusId: e.target.value })}
      className="border-border bg-background h-7 rounded border text-xs"
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
