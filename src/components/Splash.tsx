import { useEffect, useRef, useState } from "react";
import { BarChart3, Calendar, FileText, Handshake, Mail, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const INTRO_MS = 3400;
const SEEN_KEY = "superagent-intro-seen";
const AGENTS = [
  { icon: Mail, label: "Email" }, { icon: Handshake, label: "CRM" }, { icon: Wallet, label: "Finance" },
  { icon: FileText, label: "Docs" }, { icon: Calendar, label: "Calendar" }, { icon: BarChart3, label: "Reports" },
];

/**
 * Creative intro: an "agent network" assembles around the logo — particles fly in
 * and link up, data pulses stream to the orchestrator in the middle, then agent
 * chips orbit it. Plays once per browser session, never waits on the backend
 * (that's warmed up in the background by lib/warmup.ts), and can be skipped.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const seen = (() => { try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } })();
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setLeaving(true);
    setTimeout(onDone, 550);
  };

  useEffect(() => {
    if (seen) { onDone(); return; }
    const t = setTimeout(finish, reduced ? 900 : INTRO_MS);
    const key = (e: KeyboardEvent) => ["Escape", "Enter", " "].includes(e.key) && finish();
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); window.removeEventListener("keydown", key); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // particle network
  useEffect(() => {
    if (seen || reduced) return;
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    window.addEventListener("resize", resize);

    const N = w < 640 ? 46 : 78;
    const R = () => Math.min(w * 0.42, Math.max(120, (h - 240) / 2) * 1.25, 260);
    const ps = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const far = Math.max(w, h) * (0.7 + Math.random() * 0.5);
      return {
        a, r: 0.55 + Math.random() * 0.75, spin: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.12),
        sx: Math.cos(a + 1.2) * far, sy: Math.sin(a + 1.2) * far, delay: Math.random() * 0.5, size: 1 + Math.random() * 1.8,
        hue: Math.random() < 0.18 ? "#4ecdc4" : Math.random() < 0.5 ? "#7aaaff" : "#1a6fff",
      };
    });
    const pulses: { from: number; t: number; speed: number }[] = [];
    const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const lr = logoRef.current?.getBoundingClientRect();
      const cx = lr ? lr.left + lr.width / 2 : w / 2, cy = lr ? lr.top + lr.height / 2 : h / 2, rr = R();
      ctx.clearRect(0, 0, w, h);
      const pos = ps.map((p) => {
        const k = ease((t - p.delay) / 1.25);
        const ang = p.a + p.spin * t;
        const tx = Math.cos(ang) * rr * p.r, ty = Math.sin(ang) * rr * p.r * 0.82;
        return { x: cx + p.sx + (tx - p.sx) * k, y: cy + p.sy + (ty - p.sy) * k, k, p };
      });
      // links
      for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y, d = Math.hypot(dx, dy);
        if (d < 95) {
          ctx.strokeStyle = `rgba(122,170,255,${(1 - d / 95) * 0.35 * Math.min(pos[i].k, pos[j].k)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
        }
      }
      // spokes to the orchestrator once assembled
      if (t > 1.1) {
        const a = Math.min(1, (t - 1.1) / 0.6) * 0.12;
        ctx.strokeStyle = `rgba(26,111,255,${a})`;
        pos.forEach((q, i) => { if (i % 3 === 0) { ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(cx, cy); ctx.stroke(); } });
        if (Math.random() < 0.35) pulses.push({ from: Math.floor(Math.random() * N), t: 0, speed: 1.4 + Math.random() * 1.2 });
      }
      // data pulses flowing into the center
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i]; pl.t += pl.speed / 60;
        if (pl.t >= 1) { pulses.splice(i, 1); continue; }
        const s = pos[pl.from]; const x = s.x + (cx - s.x) * pl.t, y = s.y + (cy - s.y) * pl.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, "rgba(78,205,196,.95)"); g.addColorStop(1, "rgba(78,205,196,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }
      // nodes
      pos.forEach(({ x, y, k, p }) => {
        ctx.globalAlpha = 0.25 + 0.75 * k;
        ctx.fillStyle = p.hue; ctx.shadowColor = p.hue; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (seen) return null;
  const word = "SuperAgent";

  return (
    <div onClick={finish} className={cn("intro fixed inset-0 z-[100] cursor-pointer overflow-hidden bg-[#00040f] text-white select-none", leaving && "intro-leave")}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,#0a1f4d_0%,#020a1f_45%,#00040f_75%)]" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />

      {/*
        Layout: the logo sits at --cy (a bit above the middle), agents orbit it at --r,
        and the wordmark sits just below the orbit. --r shrinks with the window
        height so the whole composition always fits, even on short laptop screens.
      */}
      <div className="absolute inset-0" style={{ ["--r" as any]: "min(29vw, 190px, calc((100vh - 240px) / 2))", ["--cy" as any]: "calc(50% - 48px)" }}>
        <div ref={logoRef} className="absolute left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ top: "var(--cy)" }}>
          {/* shockwave */}
          <span className="intro-wave absolute size-24 rounded-full border-2 border-[#7aaaff]" />
          <span className="intro-wave absolute size-24 rounded-full border border-[#4ecdc4]" style={{ animationDelay: "1.05s" }} />
          {/* orbiting agents */}
          <div className="intro-orbit absolute top-1/2 left-1/2 size-0">
            {AGENTS.map((a, i) => {
              const deg = (360 / AGENTS.length) * i - 90;
              return (
                // every wrapper is 0×0 so all rotations pivot on the orbit point itself;
                // the chip is then centred on that point with translate(-50%,-50%)
                <div key={a.label} className="absolute top-0 left-0 size-0" style={{ transform: `rotate(${deg}deg) translate(var(--r)) rotate(${-deg}deg)` }}>
                  <div className="intro-counter absolute top-0 left-0 size-0">
                    <div className="intro-chip absolute top-0 left-0 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap backdrop-blur-md sm:text-xs" style={{ animationDelay: `${1.35 + i * 0.09}s` }}>
                      <a.icon className="size-3.5 text-[#7aaaff]" /> {a.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="intro-logo relative">
            <div className="absolute -inset-6 rounded-[28px] bg-[#1a6fff]/40 blur-2xl" />
            <img src="/logo.svg" alt="" className="relative size-20 rounded-2xl sm:size-24" />
          </div>
        </div>

        <div className="absolute inset-x-0 flex flex-col items-center px-4 text-center" style={{ top: "calc(var(--cy) + var(--r) + 42px)" }}>
          <h1 className="flex text-4xl font-extrabold tracking-tight sm:text-6xl" aria-label={word}>
            {word.split("").map((ch, i) => (
              <span key={i} className={cn("intro-letter", i >= 5 && "text-[#7aaaff]")} style={{ animationDelay: `${0.95 + i * 0.045}s` }}>{ch}</span>
            ))}
          </h1>
          <p className="intro-tag mt-3 text-[11px] font-medium tracking-[0.35em] text-white/70 sm:text-xs">YOUR AI WORKFORCE, ORCHESTRATED</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/5"><div className="intro-bar h-full bg-gradient-to-r from-[#1254d4] via-[#5a9aff] to-[#4ecdc4]" /></div>
      <button onClick={(e) => { e.stopPropagation(); finish(); }} className="absolute right-5 bottom-6 rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/70 backdrop-blur hover:bg-white/10 hover:text-white cursor-pointer">Skip intro</button>
    </div>
  );
}
