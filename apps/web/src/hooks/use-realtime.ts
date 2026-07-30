import { realtimeEventSchema, type RealtimeEvent } from "@canvas/shared";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

const RECONNECT_DELAY_MS = 2000;

/**
 * Live board/list/chat collaboration: the server publishes a bare
 * invalidation event per ARCHITECTURE.md's realtime protocol ({entity, id,
 * ...scoping id, kind} — no payload over the wire), and every connected
 * client just refetches whatever query the event touches via TanStack
 * Query. Reconnects on drop with a fixed short delay — without it, a
 * network hiccup would silently and permanently end live updates for the
 * rest of the tab's session, which defeats the point of "live."
 *
 * `onEvent`, if given, fires for every parsed event in addition to the
 * built-in invalidation above — e.g. the DM notification sound needs to
 * react to the same "message created" events without opening a second
 * socket. Held in a ref so passing a fresh inline callback each render
 * doesn't tear down and reconnect the socket.
 */
export function useRealtime(
  workspaceId: string | undefined,
  onEvent?: (event: RealtimeEvent) => void,
) {
  const utils = trpc.useUtils();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!workspaceId) return;

    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws?workspaceId=${workspaceId}`);

      socket.onmessage = (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.data as string);
        } catch {
          return;
        }
        const parsed = realtimeEventSchema.safeParse(json);
        if (!parsed.success) return;
        const event = parsed.data;

        if (event.entity === "task" || event.entity === "status") {
          utils.task.list.invalidate({ listId: event.listId });
          if (event.entity === "task") {
            utils.task.get.invalidate({ taskId: event.id });
            utils.task.highlights.invalidate();
            // attachment.list is a separate query from task.get/task.list
            // (attachments-section.tsx, clips-section.tsx) — a new
            // attachment publishes a plain "task updated" event (see
            // attachment.ts's confirmUpload), so without this a second
            // viewer of the same task would never see it land.
            utils.attachment.list.invalidate({ taskId: event.id });
            // A task's completion can move any goal it's linked to (goal
            // progress is derived from linked tasks' completedAt, not
            // pushed) — no per-goal id on the wire, so invalidate broadly
            // rather than tracking goal_links client-side.
            utils.goal.list.invalidate();
            utils.goal.get.invalidate();
          }
          if (event.entity === "status") utils.status.list.invalidate({ listId: event.listId });
        } else if (event.entity === "message") {
          utils.chat.message.list.invalidate({ channelId: event.channelId });
        }

        onEventRef.current?.(event);
      };

      socket.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [workspaceId, utils]);
}
