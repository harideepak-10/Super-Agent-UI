import { useEffect, useState } from "react";
import { CloudOff, Loader2, RotateCw } from "lucide-react";
import { useServer } from "@/store/server";
import { API_URL } from "@/lib/config";

/** Small, non-blocking notice while a sleeping backend wakes up (or if it can't be reached). */
export function ServerPill() {
  const { status, set } = useServer();
  const [show, setShow] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (status !== "checking") return;
    const t = setTimeout(() => setShow(true), 2500);           // don't flash for fast responses
    const i = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [status]);
  if (status === "up" || (status === "checking" && !show)) return null;

  return (
    <div className="slide-in fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border bg-surface/95 py-2 pr-2 pl-4 text-xs shadow-2xl backdrop-blur lg:bottom-6">
      {status === "checking" ? (
        <>
          <Loader2 className="size-4 animate-spin text-accent" />
          <span><span className="font-semibold">Waking up the server…</span> <span className="text-muted">free hosting sleeps when idle · {secs}s</span></span>
        </>
      ) : (
        <>
          <CloudOff className="size-4 text-err" />
          <span><span className="font-semibold">Can't reach the server</span> <span className="text-muted">{API_URL.replace(/^https?:\/\//, "")}</span></span>
          <button onClick={() => { set("checking"); setSecs(0); import("@/lib/warmup").then(() => location.reload()); }} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 font-semibold text-white cursor-pointer"><RotateCw className="size-3" /> Retry</button>
        </>
      )}
    </div>
  );
}
