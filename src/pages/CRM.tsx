import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, CalendarClock, Check, Flame, Handshake, Plus, Snowflake, StickyNote, Thermometer, Trash2, TrendingUp, Trophy, UserX } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import { asList, cn, errMsg, fmtDate, money, timeAgo } from "@/lib/utils";
import { useMe } from "@/lib/useMe";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { Drawer } from "@/components/Drawer";
import { Avatar } from "@/components/Layout";
import { toast } from "@/components/toast";
import { CustomerChannels } from "@/components/CustomerChannels";

const STAGES = [
  { v: "new", l: "New", c: "bg-slate-400" },
  { v: "contacted", l: "Contacted", c: "bg-sky-500" },
  { v: "qualified", l: "Qualified", c: "bg-indigo-500" },
  { v: "proposal", l: "Proposal", c: "bg-amber-500" },
  { v: "won", l: "Won", c: "bg-emerald-500" },
  { v: "lost", l: "Lost", c: "bg-rose-500" },
];

type Deal = { id: string; customer_email: string; customer_name?: string; title: string; value: string; currency: string; stage: string; stage_label?: string; expected_close_date?: string | null; notes?: string; owner_email?: string | null; closed_at?: string | null; created_at?: string };
type FollowUp = { id: string; customer_email: string; customer_name?: string; deal?: string | null; due_date: string; note: string; status: string; outcome?: string; overdue: boolean; assigned_to_email?: string | null };

function sumByCurrency(obj?: Record<string, string>) {
  const e = Object.entries(obj ?? {});
  if (!e.length) return money(0);
  return e.map(([c, v]) => money(v, c, true)).join(" + ");
}

export default function CRM() {
  const [tab, setTab] = useState<"pipeline" | "followups" | "leads" | "inactive">("pipeline");
  const [customer, setCustomer] = useState<string | null>(null);
  const pipeline = useQuery({ queryKey: ["crm", "pipeline"], queryFn: () => get("/crm/pipeline/") });
  const p = pipeline.data ?? {};
  const overdue = useQuery({ queryKey: ["crm", "followups", "overdue"], queryFn: () => get("/crm/follow-ups/", { status: "open", due: "overdue" }) });

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM" subtitle="Deals, follow-ups and lead scores — powered by your customer memory and the CRM Agent." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Handshake} label="Open deals" value={p.open_deals ?? "—"} tone="accent" />
        <Kpi icon={TrendingUp} label="Open pipeline" value={sumByCurrency(p.open_value_by_currency)} tone="info" />
        <Kpi icon={Trophy} label="Won / Lost" value={`${p.won ?? 0} / ${p.lost ?? 0}`} sub={p.win_rate_percent != null ? `${p.win_rate_percent}% win rate` : "No closed deals yet"} tone="ok" />
        <Kpi icon={AlarmClock} label="Overdue follow-ups" value={asList(overdue.data).length} tone={asList(overdue.data).length ? "err" : "muted"} onClick={() => setTab("followups")} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "pipeline", label: "Pipeline" }, { value: "followups", label: "Follow-ups" }, { value: "leads", label: "Lead scores" }, { value: "inactive", label: "Inactive contacts" }]} />
      {tab === "pipeline" && <Pipeline onCustomer={setCustomer} stats={p} />}
      {tab === "followups" && <FollowUps onCustomer={setCustomer} />}
      {tab === "leads" && <Leads onCustomer={setCustomer} />}
      {tab === "inactive" && <Inactive onCustomer={setCustomer} />}
      <CustomerOverview email={customer} onClose={() => setCustomer(null)} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, onClick }: { icon: any; label: string; value: any; sub?: string; tone: string; onClick?: () => void }) {
  const tones: Record<string, string> = { accent: "text-accent bg-accent/10", info: "text-info bg-info/10", ok: "text-ok bg-ok/10", err: "text-err bg-err/10", muted: "text-muted bg-surface-2" };
  return (
    <Card className={cn("p-4", onClick && "cursor-pointer hover:border-accent/30")} onClick={onClick}>
      <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{label}</p><span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}><Icon className="size-4" /></span></div>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/* ─────────────── Pipeline (kanban with drag & drop) ─────────────── */
function Pipeline({ onCustomer, stats }: { onCustomer: (e: string) => void; stats: any }) {
  const qc = useQueryClient();
  const me = useMe();
  const q = useQuery<Deal[]>({ queryKey: ["crm", "deals"], queryFn: async () => asList(await get("/crm/deals/")) });
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ["crm"] }); };
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => patch(`/crm/deals/${id}/`, { stage }),
    onMutate: ({ id, stage }) => qc.setQueryData<Deal[]>(["crm", "deals"], (old) => old?.map((d) => (d.id === id ? { ...d, stage } : d))),
    onSuccess: (_d, v) => { if (v.stage === "won") toast.ok("Deal won 🎉"); inv(); },
    onError: (e) => { toast.err(errMsg(e)); inv(); },
  });
  const byStage = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.v, (q.data ?? []).filter((d) => d.stage === s.v)])), [q.data]);
  const stageStats = Object.fromEntries(asList(stats.stages).map((s: any) => [s.stage, s]));

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Drag a card to move it between stages. Moving to Won or Lost closes the deal.</p>
        <Button variant="primary" onClick={() => setEditing("new")}><Plus className="size-4" /> New deal</Button>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {STAGES.map((s) => (
            <div key={s.v}
              onDragOver={(e) => { e.preventDefault(); setOver(s.v); }}
              onDragLeave={() => setOver((o) => (o === s.v ? null : o))}
              onDrop={() => { if (dragId) { const d = q.data?.find((x) => x.id === dragId); if (d && d.stage !== s.v) move.mutate({ id: dragId, stage: s.v }); } setDragId(null); setOver(null); }}
              className={cn("flex min-h-[420px] flex-col rounded-2xl border border-border bg-surface-2/60 p-2.5 transition-colors", over === s.v && "border-accent bg-accent/5")}>
              <div className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                <span className={cn("size-2 rounded-full", s.c)} />
                <p className="text-sm font-semibold">{s.l}</p>
                <span className="rounded-full bg-surface px-1.5 text-[11px] text-muted">{byStage[s.v]?.length ?? 0}</span>
              </div>
              <p className="mb-2 px-1.5 text-[11px] text-muted">{sumByCurrency(stageStats[s.v]?.value_by_currency)}</p>
              <div className="flex-1 space-y-2">
                {byStage[s.v]?.map((d) => (
                  <div key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)}
                    className={cn("group cursor-grab rounded-xl border border-border bg-surface p-3 shadow-card transition active:cursor-grabbing hover:border-accent/40", dragId === d.id && "opacity-40")}>
                    <button onClick={() => setEditing(d)} className="block w-full text-left cursor-pointer">
                      <p className="line-clamp-2 text-sm font-semibold">{d.title}</p>
                      <p className="mt-1 text-base font-bold text-accent">{money(d.value, d.currency)}</p>
                    </button>
                    <button onClick={() => onCustomer(d.customer_email)} className="mt-2 flex w-full items-center gap-2 text-left cursor-pointer">
                      <Avatar name={d.customer_name || d.customer_email} className="size-6 text-[10px]" />
                      <span className="truncate text-xs text-muted hover:text-fg">{d.customer_name || d.customer_email}</span>
                    </button>
                    {d.expected_close_date && !d.closed_at && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><CalendarClock className="size-3" /> Close by {new Date(d.expected_close_date).toLocaleDateString()}</p>}
                    {/* stage picker for touch devices (no drag & drop) */}
                    <select value={d.stage} onChange={(e) => move.mutate({ id: d.id, stage: e.target.value })} className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] lg:hidden">
                      {STAGES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
                    </select>
                  </div>
                ))}
                {!byStage[s.v]?.length && <p className="px-2 py-6 text-center text-xs text-muted/70">Drop deals here</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DealModal deal={editing} onClose={() => setEditing(null)} canDelete={me.canManage} />
    </>
  );
}

function DealModal({ deal, onClose, canDelete }: { deal: Deal | "new" | null; onClose: () => void; canDelete: boolean }) {
  const qc = useQueryClient();
  const isNew = deal === "new";
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => get("/memory/"), enabled: isNew });
  const blank = { customer_email: "", title: "", value: "", currency: "INR", stage: "new", expected_close_date: "", notes: "" };
  const [form, setForm] = useState<any>(blank);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = deal === "new" ? "new" : deal?.id ?? null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setForm(deal && deal !== "new" ? { ...blank, ...deal, expected_close_date: deal.expected_close_date ?? "", notes: deal.notes ?? "" } : blank);
  }
  const inv = () => qc.invalidateQueries({ queryKey: ["crm"] });
  const save = useMutation({
    mutationFn: () => {
      const body = { title: form.title, value: Number(form.value || 0), currency: form.currency, stage: form.stage, expected_close_date: form.expected_close_date || null, notes: form.notes };
      return isNew ? post("/crm/deals/", { ...body, customer_email: form.customer_email }) : patch(`/crm/deals/${(deal as Deal).id}/`, body);
    },
    onSuccess: () => { toast.ok(isNew ? "Deal created" : "Deal updated"); inv(); onClose(); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const remove = useMutation({ mutationFn: () => del(`/crm/deals/${(deal as Deal).id}/`), onSuccess: () => { toast.ok("Deal deleted"); inv(); onClose(); }, onError: (e) => toast.err(errMsg(e)) });

  return (
    <Modal open={!!deal} onClose={onClose} title={isNew ? "New deal" : "Edit deal"} wide>
      <div className="space-y-4">
        {isNew ? (
          <Field label="Customer" hint="Customers come from Customer memory. Add one there (or via a CRM note) first.">
            <Input list="crm-customers" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="customer@email.com" />
            <datalist id="crm-customers">{asList(customers.data).map((c: any) => <option key={c.id} value={c.email}>{c.name}</option>)}</datalist>
          </Field>
        ) : <p className="text-sm text-muted">Customer: <span className="text-fg">{(deal as Deal)?.customer_name || (deal as Deal)?.customer_email}</span></p>}
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Website redesign" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Value"><Input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
          <Field label="Currency"><Select className="w-full" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{["INR", "USD", "EUR", "GBP", "AED"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Stage"><Select className="w-full" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{STAGES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</Select></Field>
        </div>
        <Field label="Expected close date"><Input type="date" value={form.expected_close_date ?? ""} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></Field>
        <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!form.title || (isNew && !form.customer_email)} loading={save.isPending} onClick={() => save.mutate()}>{isNew ? "Create deal" : "Save changes"}</Button>
          {!isNew && canDelete && <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="size-4" /></Button>}
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────── Follow-ups ─────────────── */
function FollowUps({ onCustomer }: { onCustomer: (e: string) => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const [due, setDue] = useState<"" | "overdue" | "today" | "week">("");
  const [status, setStatus] = useState("open");
  const q = useQuery<FollowUp[]>({ queryKey: ["crm", "followups", status, due], queryFn: async () => asList(await get("/crm/follow-ups/", { status, ...(due ? { due } : {}) })) });
  const [done, setDone] = useState<FollowUp | null>(null);
  const [outcome, setOutcome] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ customer_email: "", due_date: "tomorrow", note: "" });
  const inv = () => qc.invalidateQueries({ queryKey: ["crm"] });
  const complete = useMutation({ mutationFn: () => patch(`/crm/follow-ups/${done!.id}/`, { status: "done", outcome }), onSuccess: () => { toast.ok("Follow-up done"); setDone(null); setOutcome(""); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const create = useMutation({ mutationFn: () => post("/crm/follow-ups/", form), onSuccess: () => { toast.ok("Follow-up scheduled"); setCreating(false); setForm({ customer_email: "", due_date: "tomorrow", note: "" }); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/crm/follow-ups/${id}/`), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["", "All due"], ["overdue", "Overdue"], ["today", "Today"], ["week", "This week"]].map(([v, l]) => (
          <button key={v} onClick={() => setDue(v as any)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-medium cursor-pointer", due === v ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted")}>{l}</button>
        ))}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-xs"><option value="open">Open</option><option value="done">Done</option><option value="cancelled">Cancelled</option><option value="all">All</option></Select>
        <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)}><Plus className="size-4" /> Schedule follow-up</Button>
      </div>
      <Card className="divide-y divide-border">
        {q.isLoading && <Loading />}
        {!q.isLoading && !q.data?.length && <Empty icon={<Check className="size-8 text-ok" />} title="Nothing to follow up" text="Ask the CRM Agent to schedule follow-ups, or add one here." />}
        {q.data?.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold", f.overdue ? "bg-err/10 text-err" : "bg-accent/10 text-accent")}>
              {new Date(f.due_date).toLocaleDateString(undefined, { day: "2-digit" })}<span className="-mt-1 text-[9px] font-medium uppercase">{new Date(f.due_date).toLocaleDateString(undefined, { month: "short" })}</span>
            </div>
            <div className="min-w-0 flex-1">
              <button onClick={() => onCustomer(f.customer_email)} className="text-sm font-semibold hover:text-accent cursor-pointer">{f.customer_name || f.customer_email}</button>
              <p className="text-sm text-muted">{f.note}</p>
              {f.outcome && <p className="mt-0.5 text-xs text-ok">Outcome: {f.outcome}</p>}
            </div>
            {f.overdue && <Badge tone="err">Overdue</Badge>}
            {f.status !== "open" && <Badge tone={f.status === "done" ? "ok" : "neutral"}>{f.status}</Badge>}
            {f.status === "open" && <Button size="sm" onClick={() => setDone(f)}><Check className="size-3.5" /> Done</Button>}
            {me.canManage && <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}><Trash2 className="size-4" /></Button>}
          </div>
        ))}
      </Card>
      <Modal open={!!done} onClose={() => setDone(null)} title="Complete follow-up">
        <div className="space-y-4">
          <p className="text-sm text-muted">{done?.note}</p>
          <Field label="Outcome (optional)"><Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Client agreed to a demo" /></Field>
          <Button variant="primary" className="w-full" loading={complete.isPending} onClick={() => complete.mutate()}>Mark as done</Button>
        </div>
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Schedule follow-up">
        <div className="space-y-4">
          <Field label="Customer email"><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></Field>
          <Field label="Due" hint="YYYY-MM-DD, today, tomorrow, 'in 3 days' or 'next week'">
            <div className="flex gap-2">
              <Input value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              {["today", "tomorrow", "in 3 days", "next week"].map((d) => <button key={d} onClick={() => setForm({ ...form, due_date: d })} className="hidden shrink-0 rounded-lg border border-border px-2 text-xs text-muted hover:text-fg sm:block cursor-pointer">{d}</button>)}
            </div>
          </Field>
          <Field label="Note"><Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Send the revised quote" /></Field>
          <Button variant="primary" className="w-full" disabled={!form.customer_email || !form.note} loading={create.isPending} onClick={() => create.mutate()}>Schedule</Button>
        </div>
      </Modal>
    </>
  );
}

/* ─────────────── Lead scores ─────────────── */
const LEAD = { hot: { icon: Flame, tone: "err", l: "Hot" }, warm: { icon: Thermometer, tone: "warn", l: "Warm" }, cold: { icon: Snowflake, tone: "info", l: "Cold" } } as const;

function Leads({ onCustomer }: { onCustomer: (e: string) => void }) {
  const [label, setLabel] = useState("");
  const q = useQuery({ queryKey: ["crm", "leads", label], queryFn: () => get("/crm/leads/", { limit: 50, ...(label ? { label } : {}) }) });
  const rows = asList(q.data);
  return (
    <>
      <div className="mb-4 flex gap-2">
        {[["", "All"], ["hot", "Hot"], ["warm", "Warm"], ["cold", "Cold"]].map(([v, l]) => (
          <button key={v} onClick={() => setLabel(v)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-medium cursor-pointer", label === v ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted")}>{l}</button>
        ))}
      </div>
      {q.isLoading ? <Loading /> : !rows.length ? <Card><Empty title="No customers to score yet" /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r: any) => {
            const L = LEAD[r.label as keyof typeof LEAD] ?? LEAD.cold;
            return (
              <Card key={r.email} className="p-4 hover:border-accent/30">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name || r.email} />
                  <button onClick={() => onCustomer(r.email)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <p className="truncate text-sm font-semibold hover:text-accent">{r.name || r.email}</p>
                    <p className="truncate text-xs text-muted">{r.company || r.email}</p>
                  </button>
                  <Badge tone={L.tone as any}><L.icon className="size-3" /> {L.l}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", r.label === "hot" ? "bg-err" : r.label === "warm" ? "bg-warn" : "bg-info")} style={{ width: `${r.score}%` }} /></div>
                  <span className="w-8 text-right text-sm font-bold">{r.score}</span>
                </div>
                {asList(r.reasons).length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted">{asList(r.reasons).slice(0, 3).map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─────────────── Inactive contacts ─────────────── */
function Inactive({ onCustomer }: { onCustomer: (e: string) => void }) {
  const [days, setDays] = useState(14);
  const q = useQuery({ queryKey: ["crm", "inactive", days], queryFn: () => get("/crm/inactive/", { days }) });
  const rows = asList(q.data);
  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        No interaction in
        <Select value={days} onChange={(e) => setDays(+e.target.value)} className="h-8 text-xs">{[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>
        and no open follow-up
      </div>
      <Card className="divide-y divide-border">
        {q.isLoading && <Loading />}
        {!q.isLoading && !rows.length && <Empty icon={<UserX className="size-8" />} title="Everyone's been contacted recently" />}
        {rows.map((r: any) => (
          <button key={r.email} onClick={() => onCustomer(r.email)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/50 cursor-pointer">
            <Avatar name={r.name || r.email} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.name || r.email}</p><p className="truncate text-xs text-muted">{r.company || r.email}</p></div>
            <span className="text-xs text-muted">{r.days_inactive != null ? `${r.days_inactive} days quiet` : "Never contacted"}</span>
          </button>
        ))}
      </Card>
    </>
  );
}

/* ─────────────── Customer overview drawer ─────────────── */
function CustomerOverview({ email, onClose }: { email: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["crm", "customer", email], queryFn: () => get("/crm/customers/overview/", { email }), enabled: !!email });
  const [note, setNote] = useState("");
  const add = useMutation({ mutationFn: () => post("/crm/notes/", { email, note }), onSuccess: () => { toast.ok("Note added"); setNote(""); qc.invalidateQueries({ queryKey: ["crm", "customer", email] }); }, onError: (e) => toast.err(errMsg(e)) });
  const d = q.data ?? {};
  const c = d.customer ?? {};
  const ls = d.lead_score;
  const L = ls ? LEAD[ls.label as keyof typeof LEAD] ?? LEAD.cold : null;
  return (
    <Drawer open={!!email} onClose={onClose} title={c.name || email || "Customer"}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={c.name || c.email} className="size-14 text-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{c.name || c.email}</p>
              <p className="text-sm text-muted">{c.email}{c.company && ` · ${c.company}`}</p>
              <p className="text-xs text-muted">{c.interaction_count ?? 0} interactions · last {timeAgo(c.last_interaction_at) || "never"}</p>
            </div>
            {ls && L && <div className="text-center"><p className="text-2xl font-bold">{ls.score}</p><Badge tone={L.tone as any}><L.icon className="size-3" />{L.l}</Badge></div>}
          </div>
          {c.interaction_summary && <Card className="p-4 text-sm text-muted">{c.interaction_summary}</Card>}
          {c.email && <Section title="Channels"><CustomerChannels email={c.email} compact /></Section>}
          <Section title="Deals">
            {!asList(d.deals).length && <p className="text-sm text-muted">No deals yet.</p>}
            {asList(d.deals).map((x: any) => (
              <div key={x.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <div><p className="text-sm font-medium">{x.title}</p><p className="text-xs text-muted">{x.stage_label}</p></div>
                <p className="font-semibold">{money(x.value, x.currency)}</p>
              </div>
            ))}
          </Section>
          <Section title="Open follow-ups">
            {!asList(d.open_follow_ups).length && <p className="text-sm text-muted">None.</p>}
            {asList(d.open_follow_ups).map((f: any) => (
              <div key={f.id} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <CalendarClock className={cn("mt-0.5 size-4", f.overdue ? "text-err" : "text-accent")} />
                <div className="flex-1">{f.note}<p className="text-xs text-muted">Due {new Date(f.due_date).toLocaleDateString()}</p></div>
              </div>
            ))}
          </Section>
          <Section title="Recent interactions">
            {asList(d.recent_interactions).map((i: any, k: number) => (
              <div key={k} className="flex gap-3 text-sm"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" /><div><p>{i.summary}</p><p className="text-xs text-muted">{i.type} · {fmtDate(i.at)}</p></div></div>
            ))}
          </Section>
          <Section title="Add a note">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call: interested in the premium plan" />
            <Button className="mt-2" disabled={!note.trim()} loading={add.isPending} onClick={() => add.mutate()}><StickyNote className="size-4" /> Save note</Button>
          </Section>
        </div>
      )}
    </Drawer>
  );
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div><p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{title}</p><div className="space-y-2">{children}</div></div>
);
