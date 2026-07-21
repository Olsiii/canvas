import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const chatChannelListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/chat",
  component: ChatChannelListPage,
});

function ChatChannelListPage() {
  const { workspaceId } = chatChannelListRoute.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const channels = trpc.chat.channel.list.useQuery({ workspaceId });
  const create = trpc.chat.channel.create.useMutation({
    onSuccess: (channel) => {
      void utils.chat.channel.list.invalidate({ workspaceId });
      void navigate({
        to: "/w/$workspaceId/chat/$channelId",
        params: { workspaceId, channelId: channel.id },
      });
    },
  });
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
    <div className="space-y-4 p-6" data-testid="chat-channel-list-page">
      <h1 className="text-lg font-semibold">Chat</h1>

      <form onSubmit={handleCreate} className="flex max-w-md flex-wrap items-center gap-2">
        <Input
          data-testid="chat-new-channel-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New channel name"
          className="h-8 text-sm"
        />
        <label className="text-muted-foreground flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            data-testid="chat-new-channel-private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Private
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending}
          data-testid="chat-create-channel"
        >
          {create.isPending ? "Creating…" : "New channel"}
        </Button>
      </form>

      {channels.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (channels.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">
          No channels yet. Create one to start chatting.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {channels.data?.map((channel) => (
            <li key={channel.id}>
              <Link
                to="/w/$workspaceId/chat/$channelId"
                params={{ workspaceId, channelId: channel.id }}
                data-testid={`chat-channel-link-${channel.id}`}
                className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium">#{channel.name}</span>
                {channel.isPrivate && (
                  <span className="text-muted-foreground text-xs">private</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
