import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/lib/trpc";
import { Users, X } from "lucide-react";
import { useState, type FormEvent } from "react";

export function ChannelMembersPanel({
  channelId,
  workspaceId,
  onClose,
}: {
  channelId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const { user } = useSession();
  const utils = trpc.useUtils();
  const members = trpc.chat.channel.members.list.useQuery({ channelId });
  const workspaceMembers = trpc.workspace.members.useQuery({ workspaceId });
  const invalidate = () => utils.chat.channel.members.list.invalidate({ channelId });
  const addMember = trpc.chat.channel.members.add.useMutation({ onSuccess: invalidate });
  const removeMember = trpc.chat.channel.members.remove.useMutation({ onSuccess: invalidate });

  const [selectedUserId, setSelectedUserId] = useState("");

  const memberIds = new Set((members.data ?? []).map((m) => m.userId));
  const addable = (workspaceMembers.data ?? []).filter((m) => !memberIds.has(m.userId));

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    addMember.mutate(
      { channelId, userId: selectedUserId },
      { onSuccess: () => setSelectedUserId("") },
    );
  }

  return (
    <div data-testid="channel-members-panel" className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Close members"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      <div className="border-border bg-background relative flex h-full w-full max-w-md flex-col border-l shadow-xl">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="bg-accent-soft text-accent flex h-8 w-8 items-center justify-center rounded-md">
              <Users className="h-4 w-4" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold">Members</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
          {members.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : (members.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-xs">No members yet.</p>
          ) : (
            members.data?.map((m) => (
              <div
                key={m.userId}
                data-testid={`channel-member-${m.userId}`}
                className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{m.name}</span>
                {m.userId !== user?.id && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => removeMember.mutate({ channelId, userId: m.userId })}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {addable.length > 0 && (
          <form onSubmit={handleAdd} className="border-border flex items-center gap-2 border-t p-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              aria-label="Add a member"
              className="border-border bg-background h-9 flex-1 rounded-md border px-2 text-sm"
            >
              <option value="">Add someone…</option>
              {addable.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedUserId || addMember.isPending}
              data-testid="channel-member-add"
            >
              Add
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
