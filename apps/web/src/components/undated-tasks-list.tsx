import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

const ROW_HEIGHT = 28;
// Enough rows visible before scrolling kicks in that a handful of undated
// tasks still reads as a plain list, not a cramped scroll box.
const MAX_HEIGHT = 8 * ROW_HEIGHT;

/**
 * Shared by Gantt (M3.3) and Calendar (M3.1) for their "No date" bucket —
 * the one genuinely unbounded list in either view (every dated task has a
 * bounded home: a Gantt row or a calendar cell; an undated one has neither).
 * Virtualized single-column list rather than the previous flex-wrap chips —
 * TanStack Virtual has no wrap-layout mode, and a scrollable one-per-row
 * list is the simplest way to keep this bounded at 5k+ tasks.
 */
export function UndatedTasksList({
  tasks,
  onOpenTask,
  itemTestId,
  draggable = false,
}: {
  tasks: { id: string; title: string }[];
  onOpenTask: (taskId: string) => void;
  itemTestId?: (taskId: string) => string;
  draggable?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div
      ref={scrollRef}
      style={{ maxHeight: MAX_HEIGHT }}
      className="border-border overflow-y-auto rounded-md border"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const task = tasks[virtualItem.index];
          if (!task) return null;
          return (
            <button
              key={task.id}
              type="button"
              draggable={draggable}
              data-testid={itemTestId?.(task.id)}
              onDragStart={
                draggable
                  ? (e) => {
                      e.dataTransfer.setData("text/task-id", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  : undefined
              }
              onClick={() => onOpenTask(task.id)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ROW_HEIGHT,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="hover:bg-muted flex items-center truncate px-2 text-left text-xs"
            >
              {task.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
