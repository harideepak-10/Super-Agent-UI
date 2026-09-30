import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, LineChart, Rocket, Sparkles } from "lucide-react";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui";
import { bizPrompt } from "@/components/TrackRecords";
import { BusinessWizard } from "@/components/BusinessWizard";

/**
 * First-run question for business owners:
 * "Do you have any business records to track with your dashboard?" → pick record types → upload.
 * Every step can be skipped; the choice is remembered per user.
 */
export default function BusinessSetup() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const [step, setStep] = useState<0 | 1>(0);
  const skip = () => { bizPrompt.set(user?.id, "skipped"); nav("/", { replace: true }); };
  const done = () => { bizPrompt.set(user?.id, "done"); nav("/business?tab=data", { replace: true }); };

  return (
    <div className="relative min-h-full overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)]" />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5"><img src="/logo.svg" className="size-8" alt="" /><span className="text-[15px] font-bold tracking-tight">Super<span className="text-accent">Agent</span></span></div>
        <button onClick={skip} className="rounded-full px-4 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">Skip for now</button>
      </header>

      <main className="relative mx-auto max-w-4xl px-6 pt-4 pb-16 sm:px-10">
        {step === 0 && (
          <div key="q" className="slide-in mx-auto max-w-2xl text-center">
            <div className="bg-brand mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-[0_16px_40px_-12px_var(--accent)]"><BarChart3 className="size-8" /></div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Do you have any business records to track with your dashboard?</h1>
            <p className="mx-auto mt-3 max-w-xl text-muted">Excel sheets, PDF reports, Word files — customers, sales, orders, stock, invoices or expenses. We'll build live dashboards from it and recommend the agents that fit your business.</p>
            <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-3">
              {[[LineChart, "Live dashboards", "Revenue, orders and trends"], [Sparkles, "AI reads your sheets", "No manual setup"], [Rocket, "Smart agents", "CRM, reports, reminders"]].map(([I, t, d]: any) => (
                <div key={t} className="rounded-2xl border border-border bg-surface p-3.5 shadow-card"><I className="size-5 text-accent" /><p className="mt-2 text-sm font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="primary" className="h-12 px-7 text-base" onClick={() => setStep(1)}>Yes, I have records <ArrowRight className="size-4" /></Button>
              <Button className="h-12 px-7 text-base" onClick={skip}>Not now, skip</Button>
            </div>
            <p className="mt-4 text-xs text-muted">You can always add records later from Business Hub.</p>
          </div>
        )}

        {step === 1 && <BusinessWizard onDone={done} onSkip={skip} />}
      </main>
    </div>
  );
}
