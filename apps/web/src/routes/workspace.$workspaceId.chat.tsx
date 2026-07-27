import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { Hash, Lock, MessageSquare, Plus } from "lucide-react";
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
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
