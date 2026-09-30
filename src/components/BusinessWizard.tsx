import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Check, Coffee, Factory, GraduationCap, HeartPulse, Laptop, ShoppingBag, Sparkles, Store, Wrench } from "lucide-react";
import { patch } from "@/api/client";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";
import { RecordTypePicker, RecordUploader } from "./TrackRecords";
import { toast } from "./toast";

const INDUSTRIES = [
  { key: "retail", label: "Retail shop", icon: Store, types: ["sales", "customers", "products", "inventory"] },
  { key: "restaurant", label: "Restaurant / café", icon: Coffee, types: ["sales", "products", "inventory", "expenses", "employees"] },
  { key: "ecommerce", label: "E-commerce", icon: ShoppingBag, types: ["orders", "customers", "products", "inventory"] },
  { key: "services", label: "Services / agency", icon: Wrench, types: ["customers", "projects", "invoices", "expenses"] },
  { key: "clinic", label: "Clinic / healthcare", icon: HeartPulse, types: ["customers", "invoices", "employees", "expenses"] },
  { key: "manufacturing", label: "Manufacturing", icon: Factory, types: ["orders", "products", "inventory", "expenses"] },
  { key: "education", label: "Education / training", icon: GraduationCap, types: ["customers", "invoices", "employees"] },
  { key: "software", label: "Software / IT", icon: Laptop, types: ["customers", "projects", "invoices", "employees"] },
  { key: "other", label: "Something else", icon: Building2, types: ["customers", "sales"] },
];
const GOALS = [
  "Grow sales", "Know my best customers", "Keep stock under control", "Track cash flow",
  "Chase unpaid invoices", "Team performance", "Hit project deadlines", "Cut costs",
];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

type Draft = { name: string; industry: string; about: string; currency: string; goals: string[]; types: string[] };
const blank: Draft = { name: "", industry: "", about: "", currency: "INR", goals: [], types: [] };
const draftKey = (uid?: string) => `superagent-biz-draft:${uid ?? "anon"}`;

/**
 * Conversational Business Hub setup:
 * 1. Tell us about your business  2. What do you want to track?  3. Upload records (any format)
 * The answers become the business profile (type, summary, currency) after the upload.
 */
export function BusinessWizard({ onDone, onSkip, framed }: { onDone: () => void; onSkip?: () => void; framed?: boolean }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => { try { return { ...blank, ...JSON.parse(localStorage.getItem(draftKey(user?.id)) || "{}") }; } catch { return blank; } });
  useEffect(() => { try { localStorage.setItem(draftKey(user?.id), JSON.stringify(d)); } catch { /* ignore */ } }, [d, user?.id]);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const industry = INDUSTRIES.find((i) => i.key === d.industry);

  const toStep1 = () => {
    if (!d.types.length && industry) set({ types: industry.types });
    setStep(1);
  };

  const businessType = [industry && industry.key !== "other" ? industry.label : "", d.name].filter(Boolean).join(" — ") || d.name;
  const summary = [d.about.trim(), d.goals.length ? `Goals: ${d.goals.join(", ")}.` : ""].filter(Boolean).join(" ");

  const afterUpload = async () => {
    try {
      const body: any = { currency: d.currency };
      if (businessType) body.business_type = businessType;
      if (summary) body.summary = summary;
      await patch("/business/profile/", body);
      qc.invalidateQueries({ queryKey: ["business"] });
    } catch { toast.info("Uploaded — you can edit your business details in Setup & agents."); }
    try { localStorage.removeItem(draftKey(user?.id)); } catch { /* ignore */ }
    onDone();
  };

  const Steps = (
    <div className="mb-8 flex items-center justify-center gap-2 text-xs">
      {["Your business", "What to track", "Upload records"].map((l, i) => (
        <button key={l} onClick={() => i < step && setStep(i)} className={cn("flex items-center gap-2", i < step && "cursor-pointer")}>
          <span className={cn("grid size-6 place-items-center rounded-full font-bold transition", i < step ? "bg-ok text-white" : i === step ? "bg-brand text-white" : "bg-surface-2 text-muted")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
          <span className={cn("hidden sm:inline", i === step ? "font-semibold" : "text-muted")}>{l}</span>
          {i < 2 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
        </button>
      ))}
    </div>
  );

  const body = (
    <>
      {Steps}
      {step === 0 && (
        <div key="s0" className="slide-in">
          <Head title="Tell us about your business" sub="A few details so your dashboards, reports and agents speak your business's language." />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><Field label="Business name"><Input autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sri Silks" /></Field></div>
            <Field label="Currency"><Select className="w-full" value={d.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          </div>
          <p className="mt-6 mb-2.5 text-xs font-medium text-muted">What kind of business is it?</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {INDUSTRIES.map((i) => {
              const on = d.industry === i.key;
              return (
                <button key={i.key} onClick={() => set({ industry: i.key, types: [] })}
                  className={cn("flex items-center gap-2.5 rounded-2xl border bg-surface p-3 text-left text-sm font-medium shadow-card transition cursor-pointer", on ? "border-accent ring-4 ring-accent/10" : "border-border hover:border-accent/40")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", on ? "bg-brand text-white" : "bg-accent/10 text-accent")}><i.icon className="size-[18px]" /></span>{i.label}
                </button>
              );
            })}
          </div>
          <div className="mt-6"><Field label="What does your business do? (optional)"><Textarea rows={3} value={d.about} onChange={(e) => set({ about: e.target.value })} placeholder="e.g. We sell silk sarees and festive wear from two stores in Chennai and on Instagram." /></Field></div>
          <Nav onSkip={onSkip} next={<Button variant="primary" disabled={!d.name.trim() || !d.industry} onClick={toStep1}>Next <ArrowRight className="size-4" /></Button>} />
        </div>
      )}

      {step === 1 && (
        <div key="s1" className="slide-in">
          <Head title={`What do you want ${d.name ? `${d.name} ` : ""}to track?`} sub={industry ? `We've picked the usual records for a ${industry.label.toLowerCase()} — change them freely.` : "Pick the records you keep."} />
          <p className="mb-2.5 text-xs font-medium text-muted">Your goals</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const on = d.goals.includes(g);
              return <button key={g} onClick={() => set({ goals: on ? d.goals.filter((x) => x !== g) : [...d.goals, g] })} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition cursor-pointer", on ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:text-fg")}>{on && <Check className="mr-1 inline size-3.5" />}{g}</button>;
            })}
          </div>
          <p className="mb-2.5 text-xs font-medium text-muted">Records you have</p>
          <RecordTypePicker value={d.types} onChange={(types) => set({ types })} />
          <Nav onBack={() => setStep(0)} onSkip={onSkip} next={<Button variant="primary" onClick={() => setStep(2)}>Next <ArrowRight className="size-4" /></Button>} />
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="slide-in mx-auto max-w-3xl">
          <Head title="Upload your records" sub="Excel, CSV, PDF reports, Word documents, JSON — drop them all. We read the tables, show you a preview, then build your dashboards." />
          <RecordUploader selected={d.types} workbookName={d.name ? `${d.name} records` : undefined} onUploaded={afterUpload} />
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted"><Sparkles className="size-3.5 text-accent" /> Files are read in your browser; only the tables you confirm are uploaded.</p>
          <Nav onBack={() => setStep(1)} onSkip={onSkip} />
        </div>
      )}
    </>
  );

  return framed ? <Card className="p-5 sm:p-8">{body}</Card> : body;
}

const Head = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-6 text-center"><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-muted sm:text-base">{sub}</p></div>
);
const Nav = ({ onBack, onSkip, next }: { onBack?: () => void; onSkip?: () => void; next?: React.ReactNode }) => (
  <div className="mt-8 flex items-center justify-between gap-3">
    <div>{onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Back</Button>}</div>
    <div className="flex items-center gap-2">{onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}{next}</div>
  </div>
);
