import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { useServer } from "@/store/server";
import { cn } from "@/lib/utils";

const MIN_MS = 1400;     // always show the brand for a moment
const MAX_MS = 60000;    // Render free instances can take ~50s to wake up

/**
 * Full-screen splash shown on app start. It pings /auth/health/ so the app
 * knows whether the backend is reachable (and wakes a sleeping Render dyno).
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const setServer = useServer((s) => s.set);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = Date.now();
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      setServer(ok ? "up" : "down");
      const wait = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(() => { setLeaving(true); setTimeout(onDone, 350); }, wait);
    };
    const slowTimer = setTimeout(() => setSlow(true), 3500);
    axios.get(`${API_URL}/api/v1/auth/health/`, { timeout: MAX_MS })
      .then(() => finish(true))
      .catch((e) => finish(!!e?.response)); // any HTTP response means the server is reachable
    return () => clearTimeout(slowTimer);
  }, [onDone, setServer]);

  return (
    <div className={cn("fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg transition-opacity duration-300", leaving && "opacity-0")}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_20%,transparent),transparent_55%)]" />
      <div className="relative grid place-items-center">
        <span className="splash-ring absolute size-24 rounded-3xl border-2 border-accent/60" />
        <span className="splash-ring absolute size-24 rounded-3xl border-2 border-accent/40 [animation-delay:0.6s]" />
        <img src="/logo.svg" alt="" className="splash-logo relative size-20 rounded-2xl shadow-[0_0_60px_-10px_var(--accent)]" />
      </div>
      <h1 className="splash-fade relative mt-8 text-2xl font-semibold tracking-tight">Super Agent</h1>
      <p className="splash-fade relative mt-1.5 text-sm text-muted [animation-delay:0.15s]">Your AI workforce, on call.</p>
      <div className="relative mt-8 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="splash-bar h-full w-1/3 rounded-full bg-accent" />
      </div>
      <p className={cn("relative mt-4 h-4 text-xs text-muted transition-opacity", slow ? "opacity-100" : "opacity-0")}>
        Waking up the server… this can take up to a minute on first load.
      </p>
    </div>
  );
}
