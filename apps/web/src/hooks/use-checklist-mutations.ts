import { trpc } from "@/lib/trpc";

/**
 * Optimistically patches the cached checklist item on a done/text edit,
 * rolling back on error. Without this, the checkbox (bound directly to
 * server state) visibly reverts between the click and the mutation
 * resolving, which also confuses Playwright's `.check()` actionability
 * check (it expects the DOM to reflect the click immediately).
 */
export function useOptimisticChecklistItemUpdate(taskId: string) {
  const utils = trpc.useUtils();

  return trpc.checklist.items.update.useMutation({
    onMutate: async (input) => {
      await utils.checklist.list.cancel({ taskId });
      const previous = utils.checklist.list.getData({ taskId });

      utils.checklist.list.setData({ taskId }, (old) =>
        old?.map((checklist) => ({
          ...checklist,
          items: checklist.items.map((item) =>
            item.id === input.itemId
              ? {
                  ...item,
                  ...(input.text !== undefined ? { text: input.text } : {}),
                  ...(input.done !== undefined ? { done: input.done } : {}),
                }
              : item,
          ),
        })),
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) utils.checklist.list.setData({ taskId }, context.previous);
    },
    onSettled: () => utils.checklist.list.invalidate({ taskId }),
  });
}
