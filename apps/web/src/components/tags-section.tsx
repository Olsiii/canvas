import type { AppRouter } from "@canvas/api";
import { Section } from "@/components/detail-field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TaskTag = RouterOutputs["task"]["get"]["tags"][number];
type WorkspaceTag = RouterOutputs["tag"]["list"][number];

const TAG_PALETTE = ["#94a3b8", "#3b82f6", "#a855f7", "#f59e0b", "#22c55e", "#ef4444"];

export function TagsSection({
  taskId,
  workspaceId,
  tags,
  onChanged,
}: {
  taskId: string;
  workspaceId: string;
  tags: TaskTag[];
  onChanged: () => void;
}) {
  const utils = trpc.useUtils();
  const workspaceTags = trpc.tag.list.useQuery({ workspaceId });

  const addTag = trpc.task.tags.add.useMutation({ onSuccess: onChanged });
  const removeTag = trpc.task.tags.remove.useMutation({ onSuccess: onChanged });
  const createTag = trpc.tag.create.useMutation({
    onSuccess: (tag) => {
      utils.tag.list.invalidate({ workspaceId });
      addTag.mutate({ taskId, tagId: tag.id });
      setNewTagName("");
      setCreating(false);
    },
  });

  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0] ?? "#94a3b8");

  const unassigned = (workspaceTags.data ?? []).filter(
    (t: WorkspaceTag) => !tags.some((assigned) => assigned.id === t.id),
  );

  return (
    <Section label="Tags">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Remove tag ${tag.name}`}
              onClick={() => removeTag.mutate({ taskId, tagId: tag.id })}
              className="hover:opacity-75"
            >
              ✕
            </button>
          </span>
        ))}

        {!creating && (
          <>
            <select
              value=""
              aria-label="Add existing tag"
              onChange={(e) => {
                if (e.target.value) addTag.mutate({ taskId, tagId: e.target.value });
              }}
              className="border-border bg-background h-7 rounded border text-xs"
            >
              <option value="">+ Add tag…</option>
              {unassigned.map((t: WorkspaceTag) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              + New tag
            </button>
          </>
        )}

        {creating && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTagName.trim()) {
                createTag.mutate({ workspaceId, name: newTagName.trim(), color: newTagColor });
              }
            }}
          >
            <Input
              autoFocus
              value={newTagName}
              placeholder="Tag name"
              aria-label="New tag name"
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setCreating(false);
              }}
              className="h-7 w-24 text-xs"
            />
            {TAG_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => setNewTagColor(color)}
                className={`h-4 w-4 shrink-0 rounded-full ${
                  newTagColor === color ? "ring-foreground ring-2 ring-offset-1" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              type="submit"
              disabled={!newTagName.trim() || createTag.isPending}
              className="text-xs disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-muted-foreground text-xs"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
