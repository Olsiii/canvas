import { BrainChatPanel } from "@/components/brain-chat-panel";
import { ChannelMessages } from "@/components/channel-messages";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/lib/avatar";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { chatChannelListRoute } from "./workspace.$workspaceId.chat";

export const chatDmRoute = createRoute({
  getParentRoute: () => chatChannelListRoute,
  path: "/dm/$channelId",
  component: ChatDmPage,
});

function ChatDmPage() {
  const { workspaceId, channelId } = chatDmRoute.useParams();
  const dm = trpc.chat.dm.get.useQuery({ channelId });
  const [brainOpen, setBrainOpen] = useState(false);

  if (dm.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (!dm.data) {
    return <p className="text-muted-foreground p-6 text-sm">Conversation not found.</p>;
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-dm-page">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <h1 className="flex items-center gap-2 truncate text-sm font-semibold">
          <Avatar name={dm.data.otherUser.name} avatarUrl={dm.data.otherUser.avatarUrl} />
          {dm.data.otherUser.name}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="channel-ask-brain"
            aria-label="Ask Brain about this conversation"
            title="Ask Brain about this conversation"
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
    </div>
  );
}
