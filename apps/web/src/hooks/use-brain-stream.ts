import { brainStreamEventSchema } from "@canvas/shared";
import { useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;

export type BrainStreamHandlers = {
  onDelta: (text: string) => void;
  onDone: (messageId: string) => void;
  onError: (message: string) => void;
};

/**
 * Opens `/ws/brain?conversationId=…` while a Brain chat panel is mounted.
 * Unlike the board invalidation channel (payload-free, whole-session), this
 * carries streamed message text and lives only for the open panel.
 */
export function useBrainStream(conversationId: string | undefined, handlers: BrainStreamHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setConnected(false);
      return;
    }

    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/brain?conversationId=${conversationId}`,
      );

      socket.onopen = () => setConnected(true);

      socket.onmessage = (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.data as string);
        } catch {
          return;
        }
        const parsed = brainStreamEventSchema.safeParse(json);
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === "delta") handlersRef.current.onDelta(event.text);
        else if (event.type === "done") handlersRef.current.onDone(event.messageId);
        else if (event.type === "error") handlersRef.current.onError(event.message);
      };

      socket.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socket?.close();
      setConnected(false);
    };
  }, [conversationId]);

  return { connected };
}
