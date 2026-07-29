import { copyGenerationJobEventSchema, type CopyGenerationJobEvent } from "@canvas/shared";
import { useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;

/**
 * Live queued/generating/done for a copy_generations job (generate or
 * refine). Mirrors useImageAssetJob but scoped to
 * `/ws/copy-generation?generationId=…`.
 */
export function useCopyGenerationJob(
  generationId: string | undefined,
  onEvent?: (event: CopyGenerationJobEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [status, setStatus] = useState<CopyGenerationJobEvent["status"] | "idle">("idle");

  useEffect(() => {
    if (!generationId) {
      setStatus("idle");
      return;
    }

    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/copy-generation?generationId=${generationId}`,
      );

      socket.onmessage = (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.data as string);
        } catch {
          return;
        }
        const parsed = copyGenerationJobEventSchema.safeParse(json);
        if (!parsed.success) return;
        setStatus(parsed.data.status);
        onEventRef.current?.(parsed.data);
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
  }, [generationId]);

  return { status, setStatus };
}
