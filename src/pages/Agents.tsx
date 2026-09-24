import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Check, MessageSquare, Plus, RefreshCw, Trash2, Radio } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import type { Agent, Task } from "@/api/types";
import { asList, cn, errMsg, eur, timeAgo } from "@/lib/utils";
import { useLiveSocket } from "@/lib/useLiveSocket";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Toggle } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

const RISK_TONE: Record<string, any> = { safe: "ok", low: "ok", medium: "warn", high: "err" };

/* ─────────────── Library ─────────────── */
export function AgentLibrary() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["agent-templates"], queryFn: () => get("/agents/templates/") });
  const [preview, setPreview] = useState<any>(null);
  const activate = useMutation({
    mutationFn: (id: number) => post(`/agents/templates/${id}/activate/`),
    onSuccess: (d: any) => {
      toast.ok("Agent activated"); setPreview(null);
      qc.invalidateQueries({ queryKey: ["agent-templates"] }); qc.invalidateQueries({ queryKey: ["agents"] });
      const id = d?.id ?? d?.agent?.id ?? d?.agent_id; if (id) nav(`/agents/${id}`);
    },
    onError: (e) => toast.err(errMsg(e)),
  });
  const syncAll = useMutation({ mutationFn: () => post("/agents/sync-all-templates/"), onSuccess: () => { toast.ok("Templates synced"); qc.invalidateQueries({ queryKey: ["agents"] }); }, onError: (e) => toast.err(errMsg(e)) });
  const templates = asList(q.data);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Agent library" subtitle="Ready-made agents. Activate one and it's available in chat immediately."
        actions={<Button onClick={() => syncAll.mutate()} loading={syncAll.isPending}><RefreshCw className="size-4" /> Sync all</Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t: any) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <AgentIcon type={t.agent_type} size="lg" />
                {t.badge && <Badge tone="accent">{t.badge}</Badge>}
              </div>
              <p className="mt-4 font-semibold">{t.name}</p>
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{t.description}</p>
              <div className="mt-4 flex flex-wrap gap-1">
                {(t.tools ?? []).slice(0, 5).map((tool: any) => <Badge key={tool.name ?? tool}>{tool.label ?? tool}</Badge>)}
                {(t.tools?.length ?? 0) > 5 && <Badge>+{t.tools.length - 5}</Badge>}
              </div>
              <div className="mt-5 flex gap-2">
                {t.already_added ? (
                  <Link to={`/agents/${t.agent_id}`} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ok/30 bg-ok/10 text-sm font-medium text-ok"><Check className="size-4" /> Added</Link>
                ) : (
                  <Button variant="primary" className="flex-1" loading={activate.isPending && activate.variables === t.id} onClick={() => activate.mutate(t.id)}>Activate</Button>
                )}
                <Button onClick={() => setPreview(t)}>Details</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ""} wide>
        {preview && (
          <div className="space-y-5">
            <div className="flex gap-3"><AgentIcon type={preview.agent_type} size="lg" /><p className="text-sm text-muted">{preview.description}</p></div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Tools</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(preview.tools ?? []).map((tool: any) => (
                  <div key={tool.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{tool.label} <span className="font-mono text-xs text-muted">{tool.name}</span></span>
                    <Badge tone={RISK_TONE[tool.risk] ?? "neutral"}>{tool.needs_approval ? "needs approval" : tool.risk}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted">Model: <span className="font-mono">{preview.llm_model}</span></p>
            {!preview.already_added && <Button variant="primary" className="w-full" loading={activate.isPending} onClick={() => activate.mutate(preview.id)}>Activate {preview.name}</Button>}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─────────────── My agents ─────────────── */
export function AgentsList() {
  const q = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: async () => asList(await get("/agents/")) });
  const [creating, setCreating] = useState(false);
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="My agents" subtitle="Agents active in your workspace."
        actions={<>
          <Link to="/agents/library"><Button>Browse library</Button></Link>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus className="size-4" /> Custom agent</Button>
        </>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !q.data?.length ? (
        <Card><Empty icon={<Bot className="size-8" />} title="No agents yet" text="Activate a ready-made agent from the library, or build your own." action={<Link to="/agents/library"><Button variant="primary">Open library</Button></Link>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((a) => (
            <Link key={a.id} to={`/agents/${a.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-muted/40">
                <div className="flex items-start gap-3">
                  <AgentIcon type={a.agent_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-xs text-muted capitalize">{a.agent_type} agent</p>
                  </div>
                  <StatusBadge status={a.is_active === false ? "paused" : "active"} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{a.description || "No description"}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                  <span>{a.tools?.length ?? 0} tools</span><span>·</span><span className="truncate font-mono">{a.llm_model}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <CreateAgentModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateAgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const formQ = useQuery({ queryKey: ["agent-create-form"], queryFn: () => get("/agents/create-form/"), enabled: open });
  const f = formQ.data;
  const [form, setForm] = useState<any>({ name: "", agent_type: "custom", description: "", system_prompt: "", llm_model: "", tools: [] as string[], max_steps: 19, max_cost_usd: 1 });
  const create = useMutation({
    mutationFn: () => post("/agents/create/", { ...form, llm_model: form.llm_model || f?.model?.default }),
    onSuccess: (a: any) => { toast.ok("Agent created"); qc.invalidateQueries({ queryKey: ["agents"] }); onClose(); nav(`/agents/${a.id}`); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const toggleTool = (n: string) => setForm((s: any) => ({ ...s, tools: s.tools.includes(n) ? s.tools.filter((t: string) => t !== n) : [...s.tools, n] }));

  return (
    <Modal open={open} onClose={onClose} title="Create custom agent" wide>
      {formQ.isLoading ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={form.name} placeholder={f?.identity?.name_placeholder} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Type">
              <Select className="w-full" value={form.agent_type} onChange={(e) => setForm({ ...form, agent_type: e.target.value })}>
                {(f?.identity?.agent_types ?? [{ value: "custom", label: "Custom" }]).map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description"><Input value={form.description} placeholder={f?.behaviour?.description_placeholder} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="System prompt"><Textarea rows={4} value={form.system_prompt} placeholder={f?.behaviour?.system_prompt_placeholder} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} /></Field>
          <Field label="Model">
            <Select className="w-full" value={form.llm_model || f?.model?.default || ""} onChange={(e) => setForm({ ...form, llm_model: e.target.value })}>
              {(f?.model?.options ?? []).map((o: any, i: number) => <option key={i} value={o.value}>{o.label}{o.badge ? ` — ${o.badge}` : ""}</option>)}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Tools <span className="font-normal">· {f?.tools?.risk_note}</span></p>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {(f?.tools?.available ?? []).map((t: any) => (
                <button key={t.name} onClick={() => toggleTool(t.name)} className={cn("rounded-lg border px-2.5 py-1 text-xs cursor-pointer", form.tools.includes(t.name) ? "border-accent bg-accent/15 text-accent" : "border-border text-muted hover:text-fg", t.risk === "high" && !form.tools.includes(t.name) && "border-err/30")}>
                  {t.label}{t.risk === "high" && " ⚠"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Max steps per run"><Input type="number" min={1} max={50} value={form.max_steps} onChange={(e) => setForm({ ...form, max_steps: +e.target.value })} /></Field>
            <Field label="Max cost per run (USD)"><Input type="number" step={0.1} min={0.1} value={form.max_cost_usd} onChange={(e) => setForm({ ...form, max_cost_usd: +e.target.value })} /></Field>
          </div>
          <Button variant="primary" className="w-full" loading={create.isPending} disabled={!form.name} onClick={() => create.mutate()}>Create agent</Button>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────── Agent detail ─────────────── */
type Tab = "overview" | "tasks" | "live" | "audit" | "settings";

export function AgentDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState<Tab>("overview");
  const ov = useQuery({ queryKey: ["agent", id, "overview"], queryFn: () => get(`/agents/${id}/overview/`) });
  if (ov.isLoading) return <Loading />;
  if (ov.error) return <div className="p-6"><ErrorBox error={ov.error} /></div>;
  const a = ov.data;
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <Link to="/agents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> My agents</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AgentIcon type={a.agent_type} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{a.name}</h1>
          <p className="text-sm text-muted">{a.description}</p>
        </div>
        <StatusBadge status={a.is_active ? "active" : "paused"} />
        <Link to="/chat"><Button variant="primary"><MessageSquare className="size-4" /> Give it a task</Button></Link>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview" }, { value: "tasks", label: "Tasks" },
        { value: "live", label: <span className="flex items-center gap-1.5"><Radio className="size-3.5" /> Live</span> },
        { value: "audit", label: "Audit log" }, { value: "settings", label: "Settings" },
      ]} />
      {tab === "overview" && <Overview a={a} />}
      {tab === "tasks" && <AgentTasks id={id!} />}
      {tab === "live" && <AgentLive id={id!} />}
      {tab === "audit" && <AgentAudit id={id!} />}
      {tab === "settings" && <AgentSettings id={id!} />}
    </div>
  );
}

function Overview({ a }: { a: any }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Tasks today</p><p className="mt-2 text-2xl font-semibold">{a.stats?.tasks_today ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Success rate</p><p className="mt-2 text-2xl font-semibold">{a.stats?.success_label ?? "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Total cost</p><p className="mt-2 text-2xl font-semibold">{a.stats?.cost_label ?? "—"}</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium">What it does</p>
          <ul className="space-y-2 text-sm text-muted">{asList(a.what_it_does).map((c: any, i: number) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" />{typeof c === "string" ? c : c.label ?? c.title}</li>)}</ul>
          <p className="mt-5 mb-3 text-sm font-medium">Tools</p>
          <div className="flex flex-wrap gap-1.5">{asList(a.tools).map((t: any) => <Badge key={t.name} tone={RISK_TONE[t.risk] ?? "neutral"}>{t.label}</Badge>)}</div>
        </Card>
        <Card>
          <p className="border-b border-border px-5 py-3 text-sm font-medium">Recent runs</p>
          <div className="divide-y divide-border">
            {asList(a.recent_runs).length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No runs yet</p>}
            {asList(a.recent_runs).map((r: any) => (
              <Link key={r.task_id} to={`/chat?task=${r.task_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/40">
                <p className="flex-1 truncate text-sm">{r.prompt}</p>
                <StatusBadge status={r.status} />
                <span className="w-12 text-right text-xs text-muted">{r.time_ago}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AgentTasks({ id }: { id: string }) {
  const q = useQuery<Task[]>({ queryKey: ["agent", id, "tasks"], queryFn: async () => asList(await get(`/agents/${id}/tasks/`)) });
  if (q.isLoading) return <Loading />;
  if (!q.data?.length) return <Card><Empty title="No tasks yet" /></Card>;
  return (
    <Card>
      <Table head={["Prompt", "Status", "Steps", "Cost", "Created"]}>
        {q.data.map((t) => (
          <tr key={t.id} className="hover:bg-surface-2/40">
            <Td className="max-w-md"><Link to={`/chat?task=${t.id}`} className="line-clamp-1 hover:text-accent">{t.prompt}</Link></Td>
            <Td><StatusBadge status={t.status} /></Td>
            <Td className="text-muted">{t.steps_taken ?? 0}</Td>
            <Td className="text-muted">{eur(t.cost_eur)}</Td>
            <Td className="whitespace-nowrap text-muted">{timeAgo(t.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function AgentLive({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agent", id, "live"], queryFn: () => get(`/agents/${id}/live/`), refetchInterval: 8000 });
  const connected = useLiveSocket(`/ws/agents/${id}/live/`, () => qc.invalidateQueries({ queryKey: ["agent", id, "live"] }));
  if (q.isLoading) return <Loading />;
  const d = q.data ?? {};
  const run = d.running_now;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("size-2 rounded-full", d.is_live ? "bg-ok pulse-dot" : "bg-muted")} />
        <span className="font-medium">{d.is_live ? "Running now" : "Idle"}</span>
        <span className="ml-auto text-xs text-muted">{connected ? "Live stream connected" : "Polling"}</span>
      </div>
      {run && (
        <Card className="p-5">
          <Link to={`/chat?task=${run.task_id}`} className="text-sm font-medium hover:text-accent">{run.prompt}</Link>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${run.progress_pct ?? 0}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs text-muted"><span>{run.progress_label}</span><span>{run.cost_label}</span></div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="border-b border-border px-5 py-3 text-sm font-medium">Live log</p>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto font-mono text-xs">
            {asList(d.live_log).length === 0 && <p className="px-5 py-8 text-center font-sans text-sm text-muted">Nothing yet</p>}
            {asList(d.live_log).map((l: any) => (
              <div key={l.step_id} className="flex gap-3 px-5 py-2">
                <span className="text-muted">{l.timestamp}</span>
                <span className="w-24 shrink-0" style={{ color: l.tag_color }}>{l.tag}</span>
                <span className="min-w-0 break-words">{l.content}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="border-b border-border px-5 py-3 text-sm font-medium">Queue</p>
          <div className="divide-y divide-border">
            {asList(d.queue).length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Queue is empty</p>}
            {asList(d.queue).map((t: any) => <div key={t.task_id} className="flex gap-3 px-5 py-2.5 text-sm"><span className="text-xs text-muted">{t.position_label}</span><span className="truncate">{t.prompt}</span></div>)}
          </div>
          {d.footer && <div className="grid grid-cols-3 border-t border-border text-center text-xs"><div className="p-3"><p className="text-muted">Steps</p><p className="font-medium">{d.footer.steps_done}</p></div><div className="p-3"><p className="text-muted">Queued</p><p className="font-medium">{d.footer.in_queue}</p></div><div className="p-3"><p className="text-muted">Cost</p><p className="font-medium">{d.footer.cost_label}</p></div></div>}
        </Card>
      </div>
    </div>
  );
}

function AgentAudit({ id }: { id: string }) {
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["agent", id, "audit", filter], queryFn: () => get(`/agents/${id}/audit-log/`, { filter }) });
  const d = q.data ?? {};
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(d.filters ?? [{ key: "all", label: "All" }]).map((f: any) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={cn("rounded-full border px-3 py-1 text-xs cursor-pointer", filter === f.key ? "border-accent bg-accent/15 text-accent" : "border-border text-muted")}>{f.label}</button>
        ))}
      </div>
      {q.isLoading ? <Loading /> : (
        <Card className="divide-y divide-border">
          {asList(d.events).length === 0 && <Empty title="No events" />}
          {asList(d.events).map((e: any) => (
            <div key={e.event_id} className="flex gap-3 px-5 py-3" style={{ boxShadow: `inset 3px 0 0 ${e.border_color ?? "transparent"}` }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-[11px]" style={{ color: e.tag_color }}>{e.tag}</span><span className="text-sm">{e.title}</span></div>
                {e.subtitle && <p className="text-xs text-muted">{e.subtitle}</p>}
                {e.detail && <p className="mt-1 text-xs text-muted italic">{e.detail}</p>}
              </div>
              <div className="shrink-0 text-right text-xs text-muted"><p>{e.timestamp}</p>{e.cost_label && <p>{e.cost_label}</p>}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function AgentSettings({ id }: { id: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery<Agent>({ queryKey: ["agent", id], queryFn: () => get(`/agents/${id}/`) });
  const [form, setForm] = useState<Partial<Agent> | null>(null);
  const a = form ?? q.data;
  const save = useMutation({ mutationFn: () => patch(`/agents/${id}/update/`, form), onSuccess: () => { toast.ok("Saved"); setForm(null); qc.invalidateQueries({ queryKey: ["agent", id] }); qc.invalidateQueries({ queryKey: ["agents"] }); }, onError: (e) => toast.err(errMsg(e)) });
  const sync = useMutation({ mutationFn: () => post(`/agents/templates/${q.data?.template_id}/sync/`), onSuccess: () => { toast.ok("Synced with template"); qc.invalidateQueries({ queryKey: ["agent", id] }); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: () => del(`/agents/${id}/delete/`), onSuccess: () => { toast.ok("Agent deleted"); qc.invalidateQueries({ queryKey: ["agents"] }); nav("/agents"); }, onError: (e) => toast.err(errMsg(e)) });
  const [confirmDel, setConfirmDel] = useState(false);
  if (q.isLoading || !a) return <Loading />;
  const set = (k: keyof Agent, v: any) => setForm({ ...(form ?? {}), ...(form ? {} : { name: a.name }), [k]: v } as any);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="space-y-4 p-5 lg:col-span-2">
        <Field label="Name"><Input value={a.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Description"><Input value={a.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="System prompt"><Textarea rows={8} value={a.system_prompt ?? ""} onChange={(e) => set("system_prompt", e.target.value)} className="font-mono text-xs" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Model"><Input value={a.llm_model ?? ""} onChange={(e) => set("llm_model", e.target.value)} className="font-mono text-xs" /></Field>
          <Field label="Max steps"><Input type="number" value={a.max_steps ?? ""} onChange={(e) => set("max_steps", +e.target.value)} /></Field>
          <Field label="Max cost (USD)"><Input type="number" step={0.1} value={a.max_cost_usd ?? ""} onChange={(e) => set("max_cost_usd", +e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"><span className="text-sm">Active</span><Toggle checked={a.is_active !== false} onChange={(v) => set("is_active", v)} /></div>
        <div className="flex gap-2">
          <Button variant="primary" disabled={!form} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
          {form && <Button variant="ghost" onClick={() => setForm(null)}>Discard</Button>}
        </div>
      </Card>
      <div className="space-y-4">
        {q.data?.template_id && (
          <Card className="p-5">
            <p className="text-sm font-medium">Template</p>
            <p className="mt-1 text-sm text-muted">Pull the latest prompt and tools from the template.</p>
            <Button className="mt-3" loading={sync.isPending} onClick={() => sync.mutate()}><RefreshCw className="size-4" /> Sync from template</Button>
          </Card>
        )}
        <Card className="border-err/30 p-5">
          <p className="text-sm font-medium text-err">Danger zone</p>
          <p className="mt-1 text-sm text-muted">Deleting an agent keeps its task history.</p>
          {confirmDel ? (
            <div className="mt-3 flex gap-2"><Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Confirm delete</Button><Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</Button></div>
          ) : <Button variant="danger" className="mt-3" onClick={() => setConfirmDel(true)}><Trash2 className="size-4" /> Delete agent</Button>}
        </Card>
      </div>
    </div>
  );
}
