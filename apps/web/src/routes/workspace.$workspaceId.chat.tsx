import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDmSoundToggle } from "@/hooks/use-dm-sound-toggle";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { Hash, Lock, MessageSquare, Plus, UserPlus, Volume2, VolumeX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const chatChannelListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/chat",
  component: ChatShell,
});

export const chatIndexRoute = createRoute({
  getParentRoute: () => chatChannelListRoute,
  path: "/",
  component: () => (
    <p className="text-muted-foreground p-6 text-sm">
      Select a channel from the list, or create one to get started.
    </p>
  ),
});

function ChatShell() {
  const { workspaceId } = chatChannelListRoute.useParams();
  const { channelId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { user } = useSession();
  const utils = trpc.useUtils();
  const channels = trpc.chat.channel.list.useQuery({ workspaceId });
  const create = trpc.chat.channel.create.useMutation({
    onSuccess: (channel) => {
      void utils.chat.channel.list.invalidate({ workspaceId });
      setCreating(false);
      void navigate({
        to: "/w/$workspaceId/chat/$channelId",
        params: { workspaceId, channelId: channel.id },
      });
    },
  });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ workspaceId, name: trimmed, isPrivate });
    setName("");
    setIsPrivate(false);
  }

  const dms = trpc.chat.dm.list.useQuery({ workspaceId });
  const workspaceMembers = trpc.workspace.members.useQuery({ workspaceId });
  const startDm = trpc.chat.dm.startOrGet.useMutation({
    onSuccess: (result) => {
      void utils.chat.dm.list.invalidate({ workspaceId });
      setStartingDm(false);
      setOtherUserId("");
      void navigate({
        to: "/w/$workspaceId/chat/dm/$channelId",
        params: { workspaceId, channelId: result.channelId },
      });
    },
  });
  const [startingDm, setStartingDm] = useState(false);
  const [otherUserId, setOtherUserId] = useState("");

  const dmCandidates = (workspaceMembers.data ?? []).filter((m) => m.userId !== user?.id);
  const dmSound = useDmSoundToggle();

  function handleStartDm(e: FormEvent) {
    e.preventDefault();
    if (!otherUserId) return;
    startDm.mutate({ workspaceId, otherUserId });
  }

  return (
    <div className="flex h-full" data-testid="chat-channel-list-page">
      <aside className="border-border flex w-60 shrink-0 flex-col border-r">
        <div className="border-border flex items-center gap-2 border-b px-3 py-3">
          <span className="bg-accent-soft text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-sm font-semibold">Chat</h1>
          {!creating && (
            <Button
              type="button"
              size="sm"
              className="ml-auto gap-1.5"
              data-testid="chat-new-channel"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New channel
            </Button>
          )}
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="border-border space-y-2 border-b p-3">
            <Input
              data-testid="chat-new-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Channel name"
              className="h-8 text-sm"
              autoFocus
            />
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                data-testid="chat-new-channel-private"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Only invited people can see this channel
            </label>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={create.isPending || !name.trim()}
                data-testid="chat-create-channel"
              >
                {create.isPending ? "Creating…" : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setName("");
                  setIsPrivate(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {channels.isLoading ? (
            <p className="text-muted-foreground p-2 text-xs">Loading…</p>
          ) : (channels.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground p-2 text-xs">
              No channels yet — create one to start chatting.
            </p>
          ) : (
            <nav className="flex flex-col gap-0.5">
              {channels.data?.map((channel) => (
                <Link
                  key={channel.id}
                  to="/w/$workspaceId/chat/$channelId"
                  params={{ workspaceId, channelId: channel.id }}
                  data-testid={`chat-channel-link-${channel.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    channelId === channel.id
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {channel.isPrivate ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{channel.name}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="border-border border-t">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Direct messages
            </h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-6 w-6 p-0"
              data-testid="chat-dm-sound-toggle"
              aria-label={
                dmSound.enabled ? "Mute DM notification sound" : "Unmute DM notification sound"
              }
              title={
                dmSound.enabled
                  ? "DM notification sound is on — click to mute"
                  : "DM notification sound is muted — click to unmute"
              }
              aria-pressed={dmSound.enabled}
              onClick={dmSound.toggle}
            >
              {dmSound.enabled ? (
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <VolumeX className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
            {!startingDm && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-xs"
                data-testid="chat-new-dm"
                aria-label="New direct message"
                title="New direct message"
                onClick={() => setStartingDm(true)}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>

          {startingDm && (
            <form onSubmit={handleStartDm} className="border-border space-y-2 border-b p-3">
              <select
                value={otherUserId}
                onChange={(e) => setOtherUserId(e.target.value)}
                aria-label="Choose someone to message"
                data-testid="chat-new-dm-select"
                className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">Choose someone…</option>
                {dmCandidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!otherUserId || startDm.isPending}
                  data-testid="chat-start-dm"
                >
                  {startDm.isPending ? "Starting…" : "Start"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartingDm(false);
                    setOtherUserId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="max-h-60 overflow-y-auto p-2">
            {dms.isLoading ? (
              <p className="text-muted-foreground p-2 text-xs">Loading…</p>
            ) : (dms.data?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground p-2 text-xs">No direct messages yet.</p>
            ) : (
              <nav className="flex flex-col gap-0.5">
                {dms.data?.map(
                  (dm) =>
                    dm.otherUser && (
                      <Link
                        key={dm.channelId}
                        to="/w/$workspaceId/chat/dm/$channelId"
                        params={{ workspaceId, channelId: dm.channelId }}
                        data-testid={`chat-dm-link-${dm.channelId}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          channelId === dm.channelId
                            ? "bg-accent-soft text-accent font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Avatar name={dm.otherUser.name} avatarUrl={dm.otherUser.avatarUrl} />
                        <span className="truncate">{dm.otherUser.name}</span>
                      </Link>
                    ),
                )}
              </nav>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
