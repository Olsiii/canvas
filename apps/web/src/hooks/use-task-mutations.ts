import { trpc } from "@/lib/trpc";

/**
 * Optimistically patches the cached task list on title/status/order edits,
 * rolling back on error. Used by the board and list views (inline edits,
 * status dropdowns) and the board's drag-and-drop so both feel instant even
 * with thousands of tasks in a list.
 */
export function useOptimisticTaskUpdate(listId: string) {
  const utils = trpc.useUtils();

  return trpc.task.update.useMutation({
    onMutate: async (input) => {
      await utils.task.list.cancel({ listId });
      const previous = utils.task.list.getData({ listId });

      utils.task.list.setData({ listId }, (old) =>
        old?.map((task) =>
          task.id === input.taskId
            ? {
                ...task,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
                ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
                ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
                ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
                ...(input.priority !== undefined ? { priority: input.priority } : {}),
              }
            : task,
        ),
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) utils.task.list.setData({ listId }, context.previous);
    },
    onSettled: () => utils.task.list.invalidate({ listId }),
  });
}

/**
 * The Home page's and login panel's quick-complete checkbox — marks a task
 * done via its list's default done status and drops it from the cached
 * `task.highlights` result immediately (rather than waiting on a refetch),
 * rolling back on error. Both surfaces read the same `task.highlights`
 * query, so one hook covers both.
 */
export function useCompleteHighlightTask(workspaceId: string) {
  const utils = trpc.useUtils();

  return trpc.task.complete.useMutation({
    onMutate: async (input) => {
      await utils.task.highlights.cancel({ workspaceId });
      const previous = utils.task.highlights.getData({ workspaceId });

      utils.task.highlights.setData({ workspaceId }, (old) =>
        old
          ? {
              priority: old.priority.filter((t) => t.id !== input.taskId),
              recent: old.recent.filter((t) => t.id !== input.taskId),
            }
          : old,
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) utils.task.highlights.setData({ workspaceId }, context.previous);
    },
    onSettled: () => utils.task.highlights.invalidate({ workspaceId }),
  });
}
