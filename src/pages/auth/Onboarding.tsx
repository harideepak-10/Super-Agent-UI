import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const ONBOARDING_KEY = "superagent-onboarded";
export const hasOnboarded = () => { try { return localStorage.getItem(ONBOARDING_KEY) === "1"; } catch { return true; } };

// Same slides as the Flutter OnboardingScreen
const SLIDES = [
  { img: "/images/onboarding_three.webp", title: "Your AI Workforce, Orchestrated.", text: "Automate complex financial workflows with precision. Deploy agents that learn, adapt, and report in real-time." },
  { img: "/images/onboarding_one.webp", title: "Meet Your Agents", text: "From content creation to financial analysis, our agents are ready to work for you 24/7." },
  { img: "/images/onboarding_two.webp", title: "Stay in Control", text: "Monitor progress in real-time through the Control Room and get notified when you're needed." },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const last = i === SLIDES.length - 1;
  const done = () => { try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ } nav("/login", { replace: true }); };
  const next = () => (last ? done() : setI(i + 1));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, SLIDES.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const s = SLIDES[i];
  return (
    <div className="auth-bg relative flex min-h-full flex-col overflow-hidden text-white">
      <div className="blob pointer-events-none absolute -top-32 -left-32 size-[520px] rounded-full bg-[#1a6fff]/30 blur-[110px]" />
      <div className="blob pointer-events-none absolute -right-40 bottom-0 size-[460px] rounded-full bg-[#6d28d9]/20 blur-[120px]" style={{ animationDelay: "-6s" }} />

      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5"><img src="/logo.svg" className="size-8" alt="" /><span className="text-sm font-bold tracking-[0.2em]">SUPER AGENT</span></div>
        {!last && <button onClick={done} className="rounded-full px-4 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white cursor-pointer">Skip</button>}
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 pb-10 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <div key={`img-${i}`} className="slide-in order-1 flex justify-center lg:order-2">
          <div className="relative">
            <div className="absolute inset-8 rounded-full bg-[#1a6fff]/30 blur-3xl" />
            <img src={s.img} alt="" className="float-y relative w-64 drop-shadow-2xl sm:w-80 lg:w-[420px]" />
          </div>
        </div>
        <div key={`txt-${i}`} className="slide-in order-2 text-center lg:order-1 lg:text-left">
          <p className="mb-4 text-xs font-medium tracking-[0.3em] text-[#7aaaff]">STEP {i + 1} OF {SLIDES.length}</p>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">{s.title}</h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-[#e5e7eb]/80 sm:text-lg lg:mx-0">{s.text}</p>

          <div className="mt-10 flex items-center justify-center gap-4 lg:justify-start">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="grid size-12 place-items-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 cursor-pointer" aria-label="Back">
                <ChevronLeft className="size-5" />
              </button>
            )}
            <button onClick={next} className="bg-brand inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold shadow-[0_12px_30px_-10px_#1a6fff] hover:brightness-110 cursor-pointer">
              {last ? "Get Started" : "Next"} <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="mt-8 flex justify-center gap-2 lg:justify-start">
            {SLIDES.map((_, j) => (
              <button key={j} onClick={() => setI(j)} aria-label={`Slide ${j + 1}`} className={cn("h-1.5 rounded-full transition-all cursor-pointer", j === i ? "w-8 bg-[#1a6fff]" : "w-3 bg-white/25 hover:bg-white/40")} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
