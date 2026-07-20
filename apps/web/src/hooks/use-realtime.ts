import { realtimeEventSchema } from "@canvas/shared";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

const RECONNECT_DELAY_MS = 2000;

/**
 * Live board/list collaboration: the server publishes a bare invalidation
 * event per ARCHITECTURE.md's realtime protocol ({entity, id, listId,
 * kind} — no payload over the wire), and every connected client just
 * refetches whatever query the event touches via TanStack Query. Reconnects
 * on drop with a fixed short delay — without it, a network hiccup would
 * silently and permanently end live updates for the rest of the tab's
 * session, which defeats the point of "live."
 */
export function useRealtime(workspaceId: string | undefined) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!workspaceId) return;

    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws?workspaceId=${workspaceId}`,
      );

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

        utils.task.list.invalidate({ listId: event.listId });
        if (event.entity === "task") utils.task.get.invalidate({ taskId: event.id });
        if (event.entity === "status") utils.status.list.invalidate({ listId: event.listId });
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
