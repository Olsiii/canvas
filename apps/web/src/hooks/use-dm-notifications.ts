import type { RealtimeEvent } from "@canvas/shared";
import { playDmChime } from "@/lib/dm-sound";
import { pushDmToast } from "@/lib/dm-toast";
import { extractMessagePreview } from "@/lib/message-preview";
import { trpc } from "@/lib/trpc";
import { useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { useSession } from "./use-session";

/**
 * Returns a `useRealtime` `onEvent` callback that chimes and shows a
 * bottom-right toast for a new DM message from someone else. `chat.dm.get`
 * doubles as the "is this channel actually a DM I'm a member of" check (it
 * 404s for non-DM channels, 403s for DMs the caller isn't part of) — no
 * separate membership lookup needed, and no staleness window versus a
 * cached `dm.list`, since the channel/membership rows are already committed
 * by the time the first message in a brand-new DM thread triggers this.
 */
export function useDmNotifications(workspaceId: string | undefined) {
  const { user } = useSession();
  const utils = trpc.useUtils();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return useCallback(
    (event: RealtimeEvent) => {
      if (event.entity !== "message" || event.kind !== "created") return;
      if (!user || !workspaceId) return;

      // Already looking at this exact thread — no need to notify.
      if (pathname === `/w/${workspaceId}/chat/dm/${event.channelId}`) return;

      void (async () => {
        try {
          const dm = await utils.chat.dm.get.fetch({ channelId: event.channelId });
          const messages = await utils.chat.message.list.fetch({ channelId: event.channelId });
          const last = messages[messages.length - 1];
          if (!last || last.authorId === user.id) return;

          playDmChime();

          const textPreview = extractMessagePreview(last.bodyJson);
          const preview =
            textPreview ||
            (last.attachments.length > 0
              ? `Sent ${last.attachments.length} attachment${last.attachments.length > 1 ? "s" : ""}`
              : "New message");

          pushDmToast({
            workspaceId,
            channelId: event.channelId,
            otherUserName: dm.otherUser.name,
            otherUserAvatarUrl: dm.otherUser.avatarUrl,
            preview,
          });
        } catch {
          // Not a DM, not one of mine, or a transient fetch error — no notification.
        }
      })();
    },
    [user, workspaceId, pathname, utils],
  );
}
