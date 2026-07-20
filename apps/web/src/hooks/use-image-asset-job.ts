import { imageAssetJobEventSchema, type ImageAssetJobEvent } from "@canvas/shared";
import { useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;

/**
 * Live queued/generating/done for an image_asset job (generate or edit).
 * Mirrors useBrainStream but scoped to `/ws/image-asset?assetId=…`.
 */
export function useImageAssetJob(
  assetId: string | undefined,
  onEvent?: (event: ImageAssetJobEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [status, setStatus] = useState<ImageAssetJobEvent["status"] | "idle">("idle");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setConnected(false);
      setStatus("idle");
      return;
    }

    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/image-asset?assetId=${assetId}`,
      );

      socket.onopen = () => setConnected(true);

      socket.onmessage = (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.data as string);
        } catch {
          return;
        }
        const parsed = imageAssetJobEventSchema.safeParse(json);
        if (!parsed.success) return;
        setStatus(parsed.data.status);
        onEventRef.current?.(parsed.data);
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
  }, [assetId]);

  return { status, connected, setStatus };
}
