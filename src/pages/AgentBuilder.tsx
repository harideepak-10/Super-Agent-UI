import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, HelpCircle, Lock, Plug, RotateCcw, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { get, post } from "@/api/client";
import { cn, errMsg } from "@/lib/utils";
import { useMe } from "@/lib/useMe";
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Textarea } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

/**
 * Agent Builder (Admin only): describe → preview (edit) → create.
 *   POST /agents/builder/draft/   {description} → preview, nothing saved
 *   GET  /agents/builder/tools/   the tools a built agent may use, in groups
 *   POST /agents/builder/create/  the edited preview → a custom agent shared with the workspace
 */
type Preview = {
  name: string; description: string; icon?: string; tools: string[]; tool_reasons?: Record<string, string>;
  instructions: string; capabilities: string[]; example_prompts: string[]; not_possible: string[]; questions: string[];
  request?: string; needs_approval?: string[]; apps?: { app: string; label: string; connected: boolean }[];
  apps_to_connect?: string[]; system_prompt?: string; llm_model?: string; source?: "ai" | "keywords";
};
type Tool = { name: string; description: string; needs_approval: boolean; app: string | null; app_connected: boolean | null };
type Group = { key: string; label: string; purpose: string; tools: Tool[] };

const EXAMPLES = [
  "Read my unpaid invoice emails when I ask and email each customer a polite payment reminder.",
  "Check my calendar every morning I ask, and tell me which meetings clash or have no agenda.",
  "Answer questions about my Business Hub sales data and make a chart report when I ask for one.",
  "Find customers who haven't heard from us in 30 days and draft a friendly check-in for each.",
];

const lines = (v: string) => v.split("\n").map((x) => x.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

export default function AgentBuilder() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [p, setP] = useState<Preview | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const catalog = useQuery<{ groups: Group[]; always_included: string[] }>({ queryKey: ["agent-builder", "tools"], queryFn: () => get("/agents/builder/tools/"), enabled: !!p, staleTime: 300_000 });

  const draft = useMutation({
    mutationFn: () => post<Preview>("/agents/builder/draft/", { description: description.trim() }),
    onSuccess: (d) => { setP(d); setShowPrompt(false); window.scrollTo({ top: 0, behavior: "smooth" }); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const create = useMutation({
    mutationFn: () => post("/agents/builder/create/", {
      name: p!.name, description: p!.description, icon: p!.icon, tools: p!.tools, tool_reasons: p!.tool_reasons ?? {},
      instructions: p!.instructions, capabilities: p!.capabilities, example_prompts: p!.example_prompts, request: p!.request ?? description,
    }),
    onSuccess: (a: any) => { toast.ok(`${a.name} is ready — the whole workspace can use it`); qc.invalidateQueries({ queryKey: ["agents"] }); nav(`/agents/${a.id}`); },
    onError: (e) => toast.err(errMsg(e)),
  });

  const always = new Set(catalog.data?.always_included ?? ["current_time"]);
  const toolInfo = useMemo(() => {
    const m: Record<string, Tool & { group: string }> = {};
    for (const g of catalog.data?.groups ?? []) for (const t of g.tools) m[t.name] = { ...t, group: g.label };
    return m;
  }, [catalog.data]);

  if (!me.roleKnown) return <Loading />;
  if (!me.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-6 lg:p-8">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="size-8 text-muted" />
          <p className="text-lg font-semibold">Only the workspace Admin can build agents</p>
          <p className="text-sm text-muted">Agents the Admin builds are shared with everyone — you'll find them on the Agents page.</p>
          <Link to="/agents"><Button>Back to agents</Button></Link>
        </Card>
      </div>
    );
  }

  const set = (patch: Partial<Preview>) => setP((x) => (x ? { ...x, ...patch } : x));
  const toggleTool = (name: string) => p && set({ tools: p.tools.includes(name) ? p.tools.filter((t) => t !== name) : [...p.tools, name] });
  const picked = (p?.tools ?? []).filter((t) => !always.has(t));
  const approvals = (p?.tools ?? []).filter((t) => toolInfo[t]?.needs_approval || p?.needs_approval?.includes(t));
  const missingApps = [...new Set((p?.tools ?? []).map((t) => toolInfo[t]).filter((t) => t?.app && t.app_connected === false).map((t) => t!.app!))];
  const nameOk = !!p?.name.trim() && p.name.trim().length <= 60;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link to="/agents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Agents</Link>
      <PageHeader title="Agent Builder" subtitle="Describe what you need — we'll draft the agent, you check it, then create it for your whole team." />

      {/* 1 · describe */}
      <Card className={cn("p-5", p && "mb-6")}>
        <div className="mb-3 flex items-center gap-2"><Step n={1} done={!!p} /><p className="font-semibold">What should the agent do?</p></div>
        <Textarea rows={p ? 2 : 4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000}
          placeholder="e.g. Read my unpaid invoice emails when I ask and email each customer a polite payment reminder." />
        {!p && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((x) => <button key={x} onClick={() => setDescription(x)} className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted hover:border-accent/50 hover:text-fg cursor-pointer">{x}</button>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" loading={draft.isPending} disabled={description.trim().split(/\s+/).length < 4} onClick={() => draft.mutate()}>
            {p ? <><RotateCcw className="size-4" /> Draft again</> : <><Wand2 className="size-4" /> Draft my agent</>}
          </Button>
          <span className="text-xs text-muted">Nothing is saved until you press Create. Agents run on request — for schedules use a Workflow.</span>
        </div>
      </Card>

      {/* 2 · preview */}
      {p && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Step n={2} /><p className="font-semibold">Check the preview</p></div>
                <Badge tone={p.source === "ai" ? "accent" : "neutral"}>{p.source === "ai" ? <><Sparkles className="size-3" /> Drafted by AI</> : "Keyword draft"}</Badge>
              </div>
              {p.questions.length > 0 && (
                <div className="rounded-xl border border-info/30 bg-info/8 p-3 text-sm">
                  <p className="mb-1 flex items-center gap-1.5 font-medium"><HelpCircle className="size-4 text-info" /> To make it better</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-muted">{p.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                  <p className="mt-1.5 text-xs text-muted">Add the answers to the description above and draft again.</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2"><Field label="Name" hint={!nameOk ? "Up to 60 characters" : undefined}><Input value={p.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field></div>
                <Field label="Model"><Input value={p.llm_model ?? "Claude"} disabled /></Field>
              </div>
              <Field label="Description"><Textarea rows={2} maxLength={300} value={p.description} onChange={(e) => set({ description: e.target.value })} /></Field>
              <Field label="Instructions" hint="How it should work, one rule per line"><Textarea rows={7} value={p.instructions} onChange={(e) => set({ instructions: e.target.value })} className="font-mono text-xs" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What it can do" hint="One per line"><Textarea rows={4} value={p.capabilities.join("\n")} onChange={(e) => set({ capabilities: lines(e.target.value) })} /></Field>
                <Field label="Example requests" hint="Shown to your team"><Textarea rows={4} value={p.example_prompts.join("\n")} onChange={(e) => set({ example_prompts: lines(e.target.value) })} /></Field>
              </div>
              {p.system_prompt && (
                <div>
                  <button onClick={() => setShowPrompt(!showPrompt)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-fg cursor-pointer">
                    <ChevronDown className={cn("size-3.5 transition", showPrompt && "rotate-180")} /> Full system prompt (as drafted)
                  </button>
                  {showPrompt && <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">{p.system_prompt}</pre>}
                  {showPrompt && <p className="mt-1 text-[11px] text-muted">It's rebuilt from your edits when you create the agent.</p>}
                </div>
              )}
            </Card>

            {/* tools */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Tools</p><span className="text-xs text-muted">{picked.length} picked</span></div>
              {catalog.isLoading ? <Loading /> : (
                <div className="space-y-4">
                  {(catalog.data?.groups ?? []).map((g) => (
                    <div key={g.key}>
                      <p className="text-xs font-semibold">{g.label} <span className="font-normal text-muted">— {g.purpose}</span></p>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {g.tools.map((t) => {
                          const on = p.tools.includes(t.name);
                          return (
                            <button key={t.name} onClick={() => toggleTool(t.name)} title={p.tool_reasons?.[t.name] || t.description}
                              className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition cursor-pointer", on ? "border-accent bg-accent/5" : "border-border hover:border-accent/40")}>
                              <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-white" : "border-border")}>{on && <Check className="size-3" />}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1 font-mono font-medium">{t.name}
                                  {t.needs_approval && <ShieldCheck className="size-3 text-warn" />}
                                  {t.app && t.app_connected === false && <Plug className="size-3 text-err" />}
                                </span>
                                <span className="line-clamp-2 text-muted">{(on && p.tool_reasons?.[t.name]) || t.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted">Always included: {[...always].join(", ")}. <ShieldCheck className="inline size-3 text-warn" /> needs approval · <Plug className="inline size-3 text-err" /> app not connected.</p>
                </div>
              )}
            </Card>
          </div>

          {/* summary + create */}
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-4 p-5 lg:sticky lg:top-4">
              <div className="flex items-center gap-3">
                <AgentIcon type="custom" size="lg" />
                <div className="min-w-0"><p className="truncate font-semibold">{p.name || "Unnamed agent"}</p><p className="line-clamp-2 text-xs text-muted">{p.description}</p></div>
              </div>
              {approvals.length > 0 && (
                <Info icon={<ShieldCheck className="size-4 text-warn" />} title="Asks you before it acts">
                  {approvals.map((t) => <code key={t} className="mr-1 rounded bg-surface-2 px-1 py-0.5 text-[11px]">{t}</code>)}
                </Info>
              )}
              {missingApps.length > 0 && (
                <Info icon={<Plug className="size-4 text-err" />} title="Connect first">
                  {missingApps.join(", ")} — <Link to="/settings/integrations" className="text-accent hover:underline">Connected apps</Link>
                </Info>
              )}
              {p.not_possible.length > 0 && (
                <Info icon={<AlertTriangle className="size-4 text-warn" />} title="It can't do">
                  <ul className="list-disc space-y-0.5 pl-4">{p.not_possible.map((x) => <li key={x}>{x}</li>)}</ul>
                </Info>
              )}
              <div className="border-t border-border pt-4">
                <Button variant="primary" className="w-full" loading={create.isPending} disabled={!nameOk || !p.description.trim() || !picked.length} onClick={() => create.mutate()}>
                  <Check className="size-4" /> Create agent
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted">{!picked.length ? "Pick at least one tool." : "Shared with your whole workspace. Only you (Admin) can edit or delete it."}</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const Step = ({ n, done }: { n: number; done?: boolean }) => (
  <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", done ? "bg-ok text-white" : "bg-accent text-white")}>{done ? <Check className="size-3.5" /> : n}</span>
);
const Info = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="flex gap-2.5 text-sm"><span className="mt-0.5">{icon}</span><div className="min-w-0"><p className="font-medium">{title}</p><div className="mt-0.5 text-xs text-muted">{children}</div></div></div>
);
