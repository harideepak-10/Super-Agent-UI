import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./config";
import { useAuth } from "@/store/auth";

/**
 * Connects to a Django Channels endpoint (JWT via ?token=), keeps it alive
 * with pings, and reconnects with backoff. `path` like "/ws/notifications/".
 */
export function useLiveSocket(path: string | null, onMessage: (msg: any) => void) {
  const token = useAuth((s) => s.access);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!path || !token) return;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let closed = false;

    const open = () => {
      ws = new WebSocket(`${WS_URL}${path}?token=${encodeURIComponent(token)}`);
      ws.onopen = () => {
        attempts = 0;
        setConnected(true);
        ping = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "ping" })), 25000);
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "pong") return;
          handler.current(m);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setConnected(false);
        clearInterval(ping);
        if (!closed && attempts < 8) retry = setTimeout(open, Math.min(1000 * 2 ** attempts++, 15000));
      };
    };
    open();
    return () => {
      closed = true;
      clearInterval(ping);
      clearTimeout(retry);
      ws?.close();
    };
  }, [path, token]);

  return connected;
}
