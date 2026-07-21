import { BrainChatPanel } from "@/components/brain-chat-panel";
import { ChannelMessages } from "@/components/channel-messages";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { createRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const chatChannelRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/chat/$channelId",
  component: ChatChannelPage,
});

function ChatChannelPage() {
  const { workspaceId, channelId } = chatChannelRoute.useParams();
  const channel = trpc.chat.channel.get.useQuery({ channelId });
  const [brainOpen, setBrainOpen] = useState(false);

  if (channel.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (!channel.data) {
    return (
      <div className="space-y-2 p-6">
        <p className="text-muted-foreground text-sm">Channel not found.</p>
        <Link to="/w/$workspaceId/chat" params={{ workspaceId }} className="text-sm underline">
          Back to Chat
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" data-testid="chat-channel-page">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            to="/w/$workspaceId/chat"
            params={{ workspaceId }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ← Chat
          </Link>
          <h1 className="text-lg font-semibold">#{channel.data.name}</h1>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="channel-ask-brain"
          aria-label="Ask Brain about this channel"
          onClick={() => setBrainOpen(true)}
        >
          Ask Brain
        </Button>
      </div>

      <ChannelMessages channelId={channelId} workspaceId={workspaceId} />

      {brainOpen && (
        <BrainChatPanel
          workspaceId={workspaceId}
          contextType="channel"
          contextId={channelId}
          onClose={() => setBrainOpen(false)}
        />
      )}
    </div>
  );
}
