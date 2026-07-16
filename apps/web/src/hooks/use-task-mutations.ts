import { trpc } from "@/lib/trpc";

/**
 * Optimistically patches the cached task list on title/status edits, rolling
 * back on error. Used by both the board and list views so inline edits feel
 * instant even with thousands of tasks in a list.
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
