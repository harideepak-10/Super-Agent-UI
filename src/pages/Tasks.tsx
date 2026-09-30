import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, FileSpreadsheet, FileText, Cloud, Inbox, Mail, Plus, Rocket, Search, Send, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { get, post } from "@/api/client";
import type { Task } from "@/api/types";
import { asList, cn, errMsg, eur, timeAgo, uuid } from "@/lib/utils";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

const FILTERS = [
  { v: "", l: "All" }, { v: "running", l: "Running" }, { v: "queued", l: "Queued" }, { v: "waiting_approval", l: "Needs approval" },
  { v: "completed", l: "Completed" }, { v: "failed", l: "Failed" }, { v: "cancelled", l: "Cancelled" },
];

export function guessType(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  for (const t of ["email", "calendar", "document", "finance", "compliance", "qa", "research", "workflow", "communication", "crm", "reporting"]) if (n.includes(t)) return t;
  return n ? "custom" : "orchestrator";
}

/* ─────────────── Tasks list (Flutter TasksScreen) ─────────────── */
export function TasksList() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const list = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: async () => asList(await get("/tasks/")), refetchInterval: 10000 });
  const search = useQuery({ queryKey: ["search-tasks", dq], queryFn: () => get("/search/tasks/", { q: dq }), enabled: dq.length > 1 });
  const all = dq.length > 1 ? asList<Task>(search.data) : list.data ?? [];
  const tasks = status ? all.filter((t) => t.status === status) : all;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of list.data ?? []) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [list.data]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Tasks" subtitle="Manage your autonomous agent activities." actions={<Link to="/tasks/new"><Button variant="primary"><Plus className="size-4" /> New Task</Button></Link>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3.5 size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-10 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm outline-none focus:border-accent" />
        </div>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setStatus(f.v)}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              status === f.v ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:text-fg")}>
            {f.l}
            {f.v && counts[f.v] ? <span className={cn("rounded-full px-1.5 text-[10px]", status === f.v ? "bg-white/25" : "bg-surface-2")}>{counts[f.v]}</span> : null}
          </button>
        ))}
      </div>

      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : tasks.length === 0 ? (
        <Card><Empty icon={<ListIcon />} title="No tasks found" text={status || dq ? "Try another filter or search." : "Give your agents their first task."} action={<Link to="/tasks/new"><Button variant="primary"><Plus className="size-4" /> New Task</Button></Link>} /></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => <TaskRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
const ListIcon = () => <Rocket className="size-8" />;

function TaskRow({ t }: { t: Task }) {
  const running = t.status === "running" || t.status === "queued";
  const pct = Math.round(t.progress_percent ?? (t.total_steps_estimate ? ((t.steps_taken ?? 0) / t.total_steps_estimate) * 100 : 0));
  return (
    <Link to={`/chat?task=${t.id}`} className="block">
      <Card className={cn("p-4 transition hover:-translate-y-px hover:border-accent/30", t.status === "waiting_approval" && "border-warn/40")}>
        <div className="flex items-start gap-3">
          <AgentIcon type={guessType(t.agent_name)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-muted">{t.agent_name || "Orchestrator"}</p>
              {t.priority === "urgent" && <span className="rounded-md bg-err/10 px-1.5 text-[10px] font-bold text-err uppercase">Urgent</span>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm font-medium">{t.prompt}</p>
            {running && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="bg-brand h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 6)}%` }} /></div>
                <span className="text-[11px] text-muted">{t.steps_taken ?? 0}{t.total_steps_estimate ? `/${t.total_steps_estimate}` : ""} steps</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={t.status} />
            <span className="text-[11px] text-muted">{timeAgo(t.created_at)}</span>
            {!running && (t.cost_eur ?? 0) > 0 && <span className="text-[11px] text-muted">{eur(t.cost_eur)}</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ─────────────── New Task (Flutter NewTaskScreen) ─────────────── */
const QS_ICON: Record<string, any> = { "file-text": FileText, "file-spreadsheet": FileSpreadsheet, cloud: Cloud, mail: Mail, shield: ShieldCheck, inbox: Inbox };

export function NewTask() {
  const nav = useNavigate();
  const form = useQuery({ queryKey: ["new-task-form"], queryFn: () => get("/tasks/new-task-form/") });
  const [prompt, setPrompt] = useState("");
  const [agent, setAgent] = useState("auto");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");
  const [notice, setNotice] = useState<string | null>(null);
  const f = form.data ?? {};
  const meta = f.form_meta ?? {};
  const agents = asList(f.agents);
  const max = meta.prompt_max_length ?? 500;

  const run = useMutation({
    mutationFn: () => post<Task>("/tasks/create/", { prompt: prompt.trim(), priority, conversation_id: uuid(), ...(agent !== "auto" ? { agent_id: agent } : {}) }),
    onSuccess: (t) => { toast.ok("Task started"); nav(`/chat?task=${t.id}`); },
    onError: (e: any) => {
      const d = e?.response?.data;
      if (d?.detail === "needs_clarification" || d?.detail === "needs_file_selection") setNotice(d.message);
      else toast.err(errMsg(e));
    },
  });

  if (form.isLoading) return <Loading />;
  const onlyAuto = agents.length <= 1;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Tasks</Link>
      <PageHeader title={meta.title ?? "New Task"} subtitle={meta.subtitle ?? "Tell your agents exactly what to do"} />

      <div className="space-y-7">
        <section>
          <Label>{meta.prompt_label ?? "WHAT SHOULD THE AI DO?"}</Label>
          <Card className="p-1 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
            <textarea
              autoFocus rows={5} maxLength={max} value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setNotice(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) run.mutate(); }}
              placeholder={meta.prompt_placeholder ?? "e.g. Send a follow-up email to all leads who haven't replied in 3 days..."}
              className="block w-full resize-none rounded-xl bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-muted"
            />
            <div className="flex justify-between px-4 pb-2 text-[11px] text-muted"><span>Ctrl + Enter to run</span><span>{prompt.length}/{max}</span></div>
          </Card>
          {notice && <div className="mt-3 flex gap-2 rounded-xl border border-info/30 bg-info/8 px-4 py-3 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0 text-info" />{notice}</div>}
        </section>

        {asList(f.quick_start).length > 0 && (
          <section>
            <Label>{meta.quick_start_label ?? "QUICK START"}</Label>
            <div className="flex flex-wrap gap-2">
              {asList(f.quick_start).map((qs: any) => {
                const I = QS_ICON[qs.icon] ?? Zap;
                return (
                  <button key={qs.id} onClick={() => { setPrompt(qs.prompt); if (qs.agent_id) setAgent(qs.agent_id); }}
                    className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm shadow-card transition hover:border-accent/50 hover:text-accent cursor-pointer">
                    <I className="size-4 text-accent" /> {qs.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <Label>{meta.assign_label ?? "ASSIGN TO"}</Label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {agents.map((a: any) => {
              const sel = agent === a.value;
              return (
                <button key={a.value} onClick={() => setAgent(a.value)}
                  className={cn("flex items-start gap-3 rounded-2xl border bg-surface p-3.5 text-left shadow-card transition cursor-pointer", sel ? "border-accent ring-4 ring-accent/10" : "border-border hover:border-accent/40")}>
                  <AgentIcon type={a.value === "auto" ? "orchestrator" : a.agent_type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.label}</p>
                    {a.description && <p className="line-clamp-2 text-xs text-muted">{a.description}</p>}
                  </div>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", sel ? "border-accent bg-accent text-white" : "border-border")}>{sel && <Check className="size-3" />}</span>
                </button>
              );
            })}
          </div>
          {onlyAuto && (
            <Card className="mt-3 flex flex-wrap items-center gap-3 p-4">
              <Rocket className="size-5 text-accent" />
              <div className="flex-1"><p className="text-sm font-semibold">No agents hired yet</p><p className="text-xs text-muted">Hire an agent from the marketplace to assign and run this task.</p></div>
              <Link to="/agents/library"><Button size="sm">Hire an Agent</Button></Link>
            </Card>
          )}
        </section>

        <section>
          <Label>{meta.priority_label ?? "PRIORITY"}</Label>
          <div className="grid grid-cols-2 gap-2.5 sm:max-w-md">
            {(asList(f.priority_options).length ? asList(f.priority_options) : [{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent", description: "Urgent tasks bypass the queue for immediate execution." }]).map((p: any) => {
              const sel = priority === p.value;
              const Icon = p.value === "urgent" ? Zap : Clock;
              return (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className={cn("flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition cursor-pointer",
                    sel ? (p.value === "urgent" ? "border-err bg-err/10 text-err" : "border-accent bg-accent/10 text-accent") : "border-border bg-surface text-muted hover:text-fg")}>
                  <Icon className="size-4" /> {p.label}
                </button>
              );
            })}
          </div>
          {priority === "urgent" && <p className="mt-2 text-xs text-muted">Urgent tasks bypass the queue for immediate execution.</p>}
        </section>

        <Button variant="primary" className="h-12 w-full text-base" disabled={!prompt.trim()} loading={run.isPending} onClick={() => run.mutate()}>
          <Send className="size-4" /> {meta.submit_label ?? "Run Task"}
        </Button>
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-muted">{children}</p>;
