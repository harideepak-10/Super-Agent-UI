import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, Clock, ArrowUp, Play, Plus, RotateCcw, Trash2, Workflow as WfIcon, X, CheckCircle2, XCircle, Circle, PauseCircle } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import { asList, cn, errMsg, fmtDate, pretty, timeAgo } from "@/lib/utils";
import { Button, Card, Code, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, StatusBadge, Tabs, Textarea, Toggle } from "@/components/ui";
import { toast } from "@/components/toast";

type Step = { tool: string; input: any; label: string };

export function WorkflowsList() {
  const q = useQuery({ queryKey: ["workflows"], queryFn: () => get("/workflows/") });
  const list = asList(q.data);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Workflows" subtitle="Chain tools into repeatable, step-by-step automations." actions={<Link to="/workflows/new"><Button variant="primary"><Plus className="size-4" /> New workflow</Button></Link>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : list.length === 0 ? (
        <Card><Empty icon={<WfIcon className="size-8" />} title="No workflows yet" text="e.g. read the latest email, then post a summary to Slack." action={<Link to="/workflows/new"><Button variant="primary">Create workflow</Button></Link>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w: any) => (
            <Link key={w.id} to={`/workflows/${w.id}`}>
              <Card className="h-full p-5 hover:border-muted/40">
                <div className="flex items-start justify-between gap-2"><p className="font-medium">{w.name}</p><StatusBadge status={w.is_active === false ? "paused" : "active"} /></div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{w.description || "—"}</p>
                <div className="mt-4 flex items-center gap-1.5 overflow-hidden">
                  {asList(w.steps).slice(0, 4).map((s: any, i: number) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted">→</span>}
                      <span className="truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{s.tool}</span>
                    </span>
                  ))}
                </div>
                {w.schedule_enabled && w.schedule_description && <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent"><Clock className="size-3.5" /> Runs {w.schedule_description}</p>}
                <p className={cn("text-xs text-muted", w.schedule_enabled && w.schedule_description ? "mt-1" : "mt-3")}>{w.step_count ?? asList(w.steps).length} steps · updated {timeAgo(w.updated_at)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StepEditor({ steps, setSteps, tools }: { steps: Step[]; setSteps: (s: Step[]) => void; tools: any[] }) {
  const [raw, setRaw] = useState<Record<number, string>>({});
  const update = (i: number, patchS: Partial<Step>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patchS } : s)));
  const move = (i: number, d: number) => { const n = [...steps]; [n[i], n[i + d]] = [n[i + d], n[i]]; setSteps(n); };
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i}>
          {i > 0 && <div className="ml-6 h-4 w-px bg-border" />}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{i + 1}</span>
              <Input value={s.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Step label" className="flex-1" />
              <div className="flex">
                <Button variant="ghost" size="icon" aria-label="Move step up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Move step down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 pl-9 sm:grid-cols-2">
              <Field label="Tool">
                <Input list="wf-tools" value={s.tool} onChange={(e) => update(i, { tool: e.target.value })} placeholder="read_email" className="font-mono text-xs" />
              </Field>
              <Field label="Input (JSON)">
                <Textarea
                  rows={2}
                  className={cn("font-mono text-xs", raw[i] !== undefined && (() => { try { JSON.parse(raw[i]); return false; } catch { return true; } })() && "border-err")}
                  value={raw[i] ?? JSON.stringify(s.input ?? {})}
                  onChange={(e) => { setRaw({ ...raw, [i]: e.target.value }); try { update(i, { input: JSON.parse(e.target.value || "{}") }); } catch { /* wait for valid json */ } }}
                />
              </Field>
            </div>
          </Card>
        </div>
      ))}
      <datalist id="wf-tools">{tools.map((t: any) => <option key={t.name} value={t.name}>{t.label}</option>)}</datalist>
      <Button onClick={() => setSteps([...steps, { tool: "", input: {}, label: "" }])}><Plus className="size-4" /> Add step</Button>
    </div>
  );
}

const StepIcon = ({ status }: { status?: string }) =>
  status === "completed" || status === "success" || status === "ok" ? <CheckCircle2 className="size-4 text-ok" /> :
  status === "failed" || status === "error" ? <XCircle className="size-4 text-err" /> :
  status === "paused" || status === "waiting_approval" ? <PauseCircle className="size-4 text-warn" /> : <Circle className="size-4 text-muted" />;

function Runs({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["workflow-runs", id], queryFn: () => get("/workflows/runs/", { workflow_id: id }), refetchInterval: 5000 });
  const [open, setOpen] = useState<string | null>(null);
  const resume = useMutation({ mutationFn: (rid: string) => post(`/workflows/runs/${rid}/resume/`), onSuccess: () => { toast.ok("Run resumed"); qc.invalidateQueries({ queryKey: ["workflow-runs", id] }); }, onError: (e) => toast.err(errMsg(e)) });
  const runs = asList(q.data);
  if (q.isLoading) return <Loading />;
  if (!runs.length) return <Card><Empty title="No runs yet" text="Hit Run to execute this workflow." /></Card>;
  return (
    <Card className="divide-y divide-border">
      {runs.map((r: any) => (
        <div key={r.id}>
          <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-surface-2/40 cursor-pointer">
            <StatusBadge status={r.status} />
            <span className="flex-1 text-sm text-muted">Step {Math.min((r.current_step_index ?? 0) + 1, r.total_steps ?? 0)} of {r.total_steps}</span>
            {r.task_id && <Link onClick={(e) => e.stopPropagation()} to={`/chat?task=${r.task_id}`} className="text-xs text-muted hover:text-accent">task →</Link>}
            <span className="text-xs text-muted">{fmtDate(r.started_at ?? r.created_at)}</span>
          </button>
          {open === r.id && (
            <div className="space-y-2 px-5 pb-4">
              {r.error_message && <p className="text-sm text-err">{r.error_message}</p>}
              {asList(r.step_results).map((sr: any, i: number) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm"><StepIcon status={sr.status} /><span className="font-medium">{sr.label ?? sr.tool ?? `Step ${i + 1}`}</span><span className="font-mono text-xs text-muted">{sr.tool}</span></div>
                  {(sr.output ?? sr.result ?? sr.error) && <Code className="mt-2">{pretty(sr.output ?? sr.result ?? sr.error)}</Code>}
                </div>
              ))}
              {(r.status === "paused" || r.status === "failed" || r.status === "waiting_approval") && <Button size="sm" loading={resume.isPending} onClick={() => resume.mutate(r.id)}><RotateCcw className="size-3.5" /> Resume</Button>}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

/* ─────────────── schedule: daily / weekly / monthly at a time (IST) ─────────────── */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

function scheduleBody(wf: any) {
  const time = hhmm(wf.schedule_time);
  if (!time) return wf.schedule_enabled === false ? { schedule_enabled: false } : {};
  const freq = wf.schedule_frequency || "daily";
  return {
    schedule_time: time, schedule_enabled: wf.schedule_enabled !== false, schedule_frequency: freq,
    ...(freq === "weekly" ? { schedule_weekday: wf.schedule_weekday ?? 0 } : {}),
    ...(freq === "monthly" ? { schedule_month_day: wf.schedule_month_day ?? 1 } : {}),
  };
}

function describe(wf: any) {
  const t = hhmm(wf.schedule_time);
  if (!t) return "";
  const at = `at ${t} IST`;
  if (wf.schedule_frequency === "weekly") return `every ${WEEKDAYS[wf.schedule_weekday ?? 0]} ${at}`;
  if (wf.schedule_frequency === "monthly") {
    const d = wf.schedule_month_day ?? 1;
    if (d >= 31) return `on the last day of every month ${at}`;
    const sfx = d >= 11 && d <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as any)[d % 10] ?? "th";
    return `on the ${d}${sfx} of every month ${at}`;
  }
  return `every day ${at}`;
}

function ScheduleCard({ wf, set }: { wf: any; set: (p: any) => void }) {
  const on = !!hhmm(wf.schedule_time) && wf.schedule_enabled !== false;
  const freq = wf.schedule_frequency || "daily";
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="flex items-center gap-1.5 font-medium"><Clock className="size-4 text-accent" /> Schedule</p>
          <p className="text-xs text-muted">{on ? `Runs ${describe(wf)}` : "Runs only when you press Run"}</p></div>
        <Toggle aria-label="Run on a schedule" checked={on} onChange={(v) => set(v ? { schedule_enabled: true, schedule_time: hhmm(wf.schedule_time) || "09:00", schedule_frequency: freq } : { schedule_enabled: false })} />
      </div>
      {on && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How often">
            <Select value={freq} onChange={(e) => set({ schedule_frequency: e.target.value })}>
              <option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option>
            </Select>
          </Field>
          {freq === "weekly" && (
            <Field label="On"><Select value={wf.schedule_weekday ?? 0} onChange={(e) => set({ schedule_weekday: +e.target.value })}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>
          )}
          {freq === "monthly" && (
            <Field label="On day" hint={(wf.schedule_month_day ?? 1) > 28 && (wf.schedule_month_day ?? 1) < 31 ? "Short months use their last day" : undefined}>
              <Select value={wf.schedule_month_day ?? 1} onChange={(e) => set({ schedule_month_day: +e.target.value })}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}<option value={31}>Last day of the month</option>
              </Select>
            </Field>
          )}
          <Field label="At (IST)"><Input type="time" value={hhmm(wf.schedule_time)} onChange={(e) => set({ schedule_time: e.target.value })} /></Field>
        </div>
      )}
    </Card>
  );
}

export function WorkflowEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"build" | "runs">("build");
  const toolsQ = useQuery({ queryKey: ["agent-create-form"], queryFn: () => get("/agents/create-form/") });
  const q = useQuery({ queryKey: ["workflow", id], queryFn: () => get(`/workflows/${id}/`), enabled: !isNew });
  const [draft, setDraft] = useState<any>(null);
  const wf = draft ?? (isNew ? { name: "", description: "", steps: [{ tool: "", input: {}, label: "" }], is_active: true } : q.data);
  const set = (p: any) => setDraft({ ...wf, ...p });

  const save = useMutation({
    mutationFn: () => {
      const body: any = { name: wf.name, description: wf.description, steps: wf.steps, is_active: wf.is_active, ...scheduleBody(wf) };
      return isNew ? post("/workflows/", body) : patch(`/workflows/${id}/`, body);
    },
    onSuccess: (d: any) => { toast.ok("Workflow saved"); setDraft(null); qc.invalidateQueries({ queryKey: ["workflows"] }); qc.invalidateQueries({ queryKey: ["workflow", id] }); if (isNew && d?.id) nav(`/workflows/${d.id}`, { replace: true }); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const run = useMutation({ mutationFn: () => post(`/workflows/${id}/run/`), onSuccess: () => { toast.ok("Workflow started"); setTab("runs"); qc.invalidateQueries({ queryKey: ["workflow-runs", id] }); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: () => del(`/workflows/${id}/`), onSuccess: () => { toast.ok("Workflow deleted"); qc.invalidateQueries({ queryKey: ["workflows"] }); nav("/workflows"); }, onError: (e) => toast.err(errMsg(e)) });

  if (!isNew && q.isLoading) return <Loading />;
  if (!wf) return null;
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link to="/workflows" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Workflows</Link>
      <PageHeader title={isNew ? "New workflow" : wf.name || "Workflow"}
        actions={<>
          {!isNew && <Button variant="ghost" size="icon" loading={remove.isPending} onClick={() => { if (confirm(`Delete the workflow “${wf.name || "untitled"}”?`)) remove.mutate(); }} title="Delete" aria-label="Delete workflow"><Trash2 className="size-4" /></Button>}
          <Button loading={save.isPending} disabled={!isNew && !draft} onClick={() => save.mutate()}>Save</Button>
          {!isNew && <Button variant="primary" loading={run.isPending} disabled={!!draft} onClick={() => run.mutate()}><Play className="size-4" /> Run</Button>}
        </>} />
      {!isNew && <Tabs value={tab} onChange={setTab} tabs={[{ value: "build", label: "Steps" }, { value: "runs", label: "Runs" }]} />}
      {tab === "build" ? (
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <Field label="Name"><Input value={wf.name} onChange={(e) => set({ name: e.target.value })} placeholder="Daily inbox triage" /></Field>
            <Field label="Description"><Input value={wf.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
            <div className="flex items-center justify-between"><span className="text-sm">Active</span><Toggle aria-label="Workflow active" checked={wf.is_active !== false} onChange={(v) => set({ is_active: v })} /></div>
          </Card>
          <ScheduleCard wf={wf} set={set} />
          <StepEditor steps={asList(wf.steps)} setSteps={(steps) => set({ steps })} tools={toolsQ.data?.tools?.available ?? []} />
        </div>
      ) : <Runs id={id!} />}
    </div>
  );
}
