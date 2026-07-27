import { BrainChatPanel } from "@/components/brain-chat-panel";
import { ChannelMembersPanel } from "@/components/channel-members-panel";
import { ChannelMessages } from "@/components/channel-messages";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { Hash, Lock, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { chatChannelListRoute } from "./workspace.$workspaceId.chat";

export const chatChannelRoute = createRoute({
  getParentRoute: () => chatChannelListRoute,
  path: "/$channelId",
  component: ChatChannelPage,
});

function ChatChannelPage() {
  const { workspaceId, channelId } = chatChannelRoute.useParams();
  const channel = trpc.chat.channel.get.useQuery({ channelId });
  const [brainOpen, setBrainOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  if (channel.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (!channel.data) {
    return <p className="text-muted-foreground p-6 text-sm">Channel not found.</p>;
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-channel-page">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {channel.data.isPrivate ? (
            <Lock className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Hash className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          )}
          {channel.data.name}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {channel.data.isPrivate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="channel-members"
              aria-label="Channel members"
              className="gap-1.5"
              onClick={() => setMembersOpen(true)}
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              Members
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="channel-ask-brain"
            aria-label="Ask Brain about this channel"
            className="gap-1.5"
            onClick={() => setBrainOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Ask Brain
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ChannelMessages channelId={channelId} workspaceId={workspaceId} />
      </div>

      {brainOpen && (
        <BrainChatPanel
          workspaceId={workspaceId}
          contextType="channel"
          contextId={channelId}
          onClose={() => setBrainOpen(false)}
        />
      )}

      {membersOpen && (
        <ChannelMembersPanel
          channelId={channelId}
          workspaceId={workspaceId}
          onClose={() => setMembersOpen(false)}
        />
      )}
    </div>
  );
}
