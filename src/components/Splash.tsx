import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { useServer } from "@/store/server";
import { cn } from "@/lib/utils";

const MIN_MS = 1800;   // matches the Flutter splash progress animation
const MAX_MS = 60000;  // Render free instances can take ~50s to wake up

/**
 * Port of the Flutter SplashScreen: black grid backdrop, "SuperAgent" wordmark,
 * "AUTONOMOUS ORCHESTRATION", progress bar and "SYSTEM INITIALIZING...".
 * While it shows, it pings /auth/health/ (and wakes a sleeping Render dyno).
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const setServer = useServer((s) => s.set);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [label, setLabel] = useState("SYSTEM INITIALIZING...");

  useEffect(() => {
    const start = Date.now();
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      setServer(ok ? "up" : "down");
      setLabel(ok ? "SYSTEMS ONLINE" : "OFFLINE MODE");
      const wait = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(() => { setLeaving(true); setTimeout(onDone, 400); }, wait + 250);
    };
    const slowTimer = setTimeout(() => { setSlow(true); setLabel("WAKING UP THE SERVER..."); }, 3500);
    axios.get(`${API_URL}/api/v1/auth/health/`, { timeout: MAX_MS })
      .then(() => finish(true))
      .catch((e) => finish(!!e?.response)); // any HTTP response = reachable
    return () => clearTimeout(slowTimer);
  }, [onDone, setServer]);

  return (
    <div className={cn("splash-grid fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-white transition-opacity duration-400", leaving && "opacity-0")}>
      {/* vignette + blue glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_70%)]" />
      <div className="splash-glow pointer-events-none absolute size-[420px] rounded-full bg-[#1a6fff]/25 blur-3xl" />

      <div className="relative grid place-items-center">
        <svg className="splash-orbit absolute size-40" viewBox="0 0 160 160" aria-hidden>
          <circle cx="80" cy="80" r="74" fill="none" stroke="#1a6fff" strokeOpacity=".35" strokeDasharray="4 10" />
          <circle cx="80" cy="6" r="4" fill="#7aaaff" />
        </svg>
        <img src="/logo.svg" alt="" className="splash-logo relative size-20 rounded-2xl shadow-[0_0_70px_-8px_#1a6fff]" />
      </div>

      <h1 className="splash-fade relative mt-10 text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ animationDelay: ".2s" }}>
        Super<span className="text-[#7aaaff]">Agent</span>
      </h1>
      <p className="splash-fade relative mt-3 text-[11px] font-medium tracking-[0.3em] text-[#e5e7eb]" style={{ animationDelay: ".35s" }}>
        AUTONOMOUS ORCHESTRATION
      </p>

      <div className="relative mt-12 h-[3px] w-56 overflow-hidden rounded-full bg-[#1e2a3a]">
        <div className="splash-fill h-full rounded-full bg-[#1a6fff] shadow-[0_0_12px_#1a6fff]" />
      </div>
      <p className="relative mt-4 text-[10px] font-medium tracking-[0.25em] text-[#4a5568]">{label}</p>
      <p className={cn("relative mt-2 h-4 text-xs text-[#4a5568] transition-opacity", slow ? "opacity-100" : "opacity-0")}>
        First load can take up to a minute.
      </p>
    </div>
  );
}
