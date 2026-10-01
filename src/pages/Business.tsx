import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BarChart3, Boxes, Briefcase, Check, ChevronDown, CircleCheck, Database, Download, FileSpreadsheet,
  FolderKanban, Package, ShoppingCart, Sparkles, Trash2, UploadCloud, Users, Wallet, Rocket,
} from "lucide-react";
import { api, del, get, patch, post } from "@/api/client";
import { asList, cn, errMsg, fmtDate, money, num, timeAgo } from "@/lib/utils";
import { useMe } from "@/lib/useMe";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { KpiCard, WidgetCard, type Widget } from "@/components/Widgets";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";
import { ENTITY_ICON, RecordTypePicker, RecordUploader } from "@/components/TrackRecords";
import { BusinessWizard } from "@/components/BusinessWizard";
import { phoneCc, useBusinessFinalize } from "@/lib/businessFlow";

const PERIODS = [
  ["all", "All time"], ["today", "Today"], ["this_week", "This week"], ["30d", "Last 30 days"], ["this_month", "This month"],
  ["last_month", "Last month"], ["3m", "Last 3 months"], ["6m", "Last 6 months"], ["12m", "Last 12 months"], ["this_year", "This year"],
] as const;

const PAGE_ICON: Record<string, any> = {
  sales_dashboard: BarChart3, customer_management: Users, order_management: ShoppingCart, product_catalog: Package,
  inventory_dashboard: Boxes, employee_management: Briefcase, project_tracking: FolderKanban, finance_overview: Wallet,
};

function useProfile() {
  return useQuery({ queryKey: ["business", "profile"], queryFn: () => get("/business/profile/") });
}
const hasProfile = (d: any) => !!d && !!d.id;

/* ═══════════════════════════ Hub ═══════════════════════════ */
export default function BusinessHub() {
  const prof = useProfile();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "dashboard" | "data" | "setup") ?? "dashboard";
  const setTab = (t: string) => setParams(t === "dashboard" ? {} : { tab: t });

  if (prof.isLoading) return <Loading />;
  if (prof.error) return <div className="p-6"><ErrorBox error={prof.error} /></div>;
  if (!hasProfile(prof.data)) return <Welcome />;
  const p = prof.data;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={p.business_type || "Business Hub"}
        subtitle={p.summary || "Your business data, dashboards and the agents that work on it."}
        actions={<Badge tone={p.status === "confirmed" ? "ok" : "warn"} className="px-2.5 py-1 text-xs">{p.status === "confirmed" ? <><CircleCheck className="size-3.5" /> Confirmed</> : "Draft — needs confirming"}</Badge>}
      />
      <Stepper p={p} onGo={setTab} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "dashboard", label: "Dashboard" }, { value: "data", label: "Data" }, { value: "setup", label: "Setup & agents" }]} />
      {tab === "dashboard" && <DashboardOverview />}
      {tab === "data" && <DataTab profile={p} />}
      {tab === "setup" && <SetupTab profile={p} />}
    </div>
  );
}

/** Onboarding progress with a one-click action for the step you're on. */
function Stepper({ p, onGo }: { p: any; onGo: (t: string) => void }) {
  const me = useMe();
  const flow = useBusinessFinalize();
  const [busy, setBusy] = useState(false);
  const summary = useQuery({ queryKey: ["business", "summary"], queryFn: () => get("/business/records/summary/") });
  const imported = (summary.data?.total_records ?? 0) > 0;
  const confirmed = p.status === "confirmed";
  const allHired = asList(p.recommended_agents).length > 0 && asList(p.recommended_agents).every((a: any) => a.active);
  const steps = [
    { l: "Upload data", done: true, tab: "data" },
    { l: "Review sheets", done: asList(p.entities).length > 0, tab: "data" },
    { l: "Confirm profile", done: confirmed, tab: "setup" },
    { l: "Records live", done: confirmed && imported, tab: "dashboard" },
    { l: "Hire agents", done: allHired || asList(p.recommended_agents).length === 0, tab: "setup" },
  ];
  if (steps.every((s) => s.done)) return null;
  const current = steps.findIndex((s) => !s.done);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  let action: React.ReactNode = null;
  if (current === 2) action = me.isAdmin ? (
    <><p className="text-sm text-muted">Your business profile is a draft. Confirm it to put your records live on the dashboards.</p>
      <Button variant="ghost" onClick={() => onGo("setup")}>Review details</Button>
      <Button variant="primary" loading={busy} onClick={() => run(() => flow.confirmAndImport())}><CircleCheck className="size-4" /> Confirm & import</Button></>
  ) : <p className="text-sm text-muted">Waiting for the Admin to confirm the business profile — then your records go live.</p>;
  else if (current === 3) action = me.canManage ? (
    <><p className="text-sm text-muted">Your profile is confirmed — bring your uploaded sheets onto the dashboards.</p>
      <Button variant="primary" loading={busy} onClick={() => run(() => flow.importSheets())}><Database className="size-4" /> Import records</Button></>
  ) : null;
  else if (current === 4) action = (
    <><p className="text-sm text-muted">Agents that fit your data are ready to hire.</p>
      <Button variant="primary" onClick={() => onGo("setup")}><Rocket className="size-4" /> See recommended agents</Button></>
  );
  else if (current === 1) action = <><p className="text-sm text-muted">Tell us what each sheet contains so we can build your dashboards.</p><Button variant="primary" onClick={() => onGo("data")}>Review sheets</Button></>;

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 p-4">
        {steps.map((s, i) => (
          <button key={s.l} onClick={() => onGo(s.tab)} className="flex items-center gap-2 cursor-pointer">
            <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", s.done ? "bg-ok text-white" : i === current ? "bg-brand text-white" : "bg-surface-2 text-muted")}>
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("text-sm", i === current ? "font-semibold" : "text-muted")}>{s.l}</span>
            {i < steps.length - 1 && <span className="mx-1 hidden h-px w-8 bg-border sm:block" />}
          </button>
        ))}
      </div>
      {action && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-accent/5 px-4 py-3 [&>p]:mr-auto">{action}</div>}
    </Card>
  );
}

/* ─────────────── First run: ask about the business, what to track, then upload ─────────────── */
function Welcome() {
  const me = useMe();
  const [, setParams] = useSearchParams();
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-navy p-7 text-white sm:p-9">
        <div className="blob pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-[#1a6fff]/40 blur-3xl" />
        <p className="relative text-xs font-semibold tracking-[0.25em] text-[#7aaaff]">BUSINESS HUB</p>
        <h1 className="relative mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Let's set up your business dashboard.</h1>
        <p className="relative mt-2 max-w-xl text-white/70">Tell us about your business and the records you keep — Excel, PDF reports, Word files, anything. We'll build live dashboards and recommend the agents that fit.</p>
        <div className="relative mt-5 flex flex-wrap gap-4 text-sm text-white/80">
          <span className="flex items-center gap-1.5"><Sparkles className="size-4 text-[#7aaaff]" /> AI reads your files</span>
          <span className="flex items-center gap-1.5"><BarChart3 className="size-4 text-[#7aaaff]" /> Instant dashboards</span>
          <span className="flex items-center gap-1.5"><Rocket className="size-4 text-[#7aaaff]" /> Recommended agents</span>
        </div>
      </div>
      {me.isLoading ? <Loading /> : !me.isMember
        ? <BusinessWizard framed onDone={() => setParams({})} />
        : (
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-warn/10 text-warn"><UploadCloud className="size-6" /></div>
              <p className="text-lg font-semibold">Only the Admin or a Manager can upload business records</p>
              <p className="max-w-xl text-sm text-muted">
                You're signed in as <span className="font-semibold text-fg">{me.header?.email ?? "this account"}</span> with the <span className="font-semibold text-fg">Member</span> role in your current workspace.
                If this is your own business, you're probably working inside a workspace you were invited to — an accepted invite takes priority over your own workspace.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Link to="/settings/team"><Button variant="primary">Check your team & role</Button></Link>
              </div>
              <p className="text-xs text-muted">Ask the Admin to make you a Manager, or sign in with the account that owns the workspace.</p>
            </div>
          </Card>
        )}
    </div>
  );
}

/* ─────────────── Dashboard overview ─────────────── */
function DashboardOverview() {
  const [period, setPeriod] = useState("3m");
  const q = useQuery({ queryKey: ["business", "dashboard", period], queryFn: () => get("/business/dashboard/", { period }) });
  const d = q.data ?? {};
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{d.date_from && d.date_to ? `${new Date(d.date_from).toLocaleDateString()} – ${new Date(d.date_to).toLocaleDateString()}` : " "}</p>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !d.has_data ? (
        <Card><Empty icon={<Database className="size-8" />} title="No imported data yet" text="Confirm your business profile, then import your sheets from the Data tab." action={<Link to="/business?tab=data"><Button variant="primary">Go to Data</Button></Link>} /></Card>
      ) : (
        <div className="space-y-6">
          {asList(d.pages).map((pg: any) => {
            const Icon = PAGE_ICON[pg.key] ?? BarChart3;
            return (
              <div key={pg.key}>
                <Link to={`/business/${pg.key}?period=${period}`} className="group mb-3 flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="size-4" /></span>
                  <p className="font-semibold group-hover:text-accent">{pg.label}</p>
                  <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
                {pg.empty || !asList(pg.kpis).length ? <p className="text-sm text-muted">No data for this period.</p> : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {asList<Extract<Widget, { type: "kpi" }>>(pg.kpis).map((w) => <KpiCard key={w.id} w={w} currency={d.currency} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select value={value} onChange={(e) => onChange(e.target.value)}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>;
}

/* ─────────────── One dashboard page ─────────────── */
export function BusinessPage() {
  const { page } = useParams();
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? "12m";
  const interval = params.get("interval") ?? "month";
  const q = useQuery({ queryKey: ["business", "page", page, period, interval], queryFn: () => get(`/business/dashboard/${page}/`, { period, interval }) });
  const d = q.data ?? {};
  const widgets = asList<Widget>(d.widgets);
  const kpis = widgets.filter((w) => w.type === "kpi");
  const rest = widgets.filter((w) => w.type !== "kpi");
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n); };
  const Icon = PAGE_ICON[page ?? ""] ?? BarChart3;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <Link to="/business" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Business Hub</Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="bg-brand grid size-11 place-items-center rounded-xl text-white"><Icon className="size-5" /></span>
        <div className="flex-1"><h1 className="text-2xl font-bold tracking-tight">{d.label ?? "Dashboard"}</h1>{d.date_from && <p className="text-sm text-muted">{new Date(d.date_from).toLocaleDateString()} – {new Date(d.date_to).toLocaleDateString()}</p>}</div>
        <Select value={interval} onChange={(e) => set("interval", e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></Select>
        <PeriodSelect value={period} onChange={(v) => set("period", v)} />
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : d.empty ? <Card><Empty title="No data for this page yet" /></Card> : (
        <div className="space-y-4">
          {kpis.length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis.map((w) => <WidgetCard key={w.id} w={w} currency={d.currency} />)}</div>}
          <div className="grid gap-4 lg:grid-cols-2">{rest.map((w) => <WidgetCard key={w.id} w={w} currency={d.currency} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ Data tab ═══════════════════════════ */
function DataTab({ profile }: { profile: any }) {
  const me = useMe();
  const summary = useQuery({ queryKey: ["business", "summary"], queryFn: () => get("/business/records/summary/") });
  const uploads = useQuery({ queryKey: ["business", "uploads"], queryFn: () => get("/business/uploads/") });
  const [entity, setEntity] = useState<string>("");

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="Imported records" sub={summary.data?.last_imported_at ? `Last import ${timeAgo(summary.data.last_imported_at)}` : "Nothing imported yet"} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {asList(summary.data?.entities).map((e: any) => {
            const Icon = ENTITY_ICON[e.entity] ?? Database;
            return (
              <button key={e.entity} onClick={() => setEntity(e.entity)} className="text-left cursor-pointer">
                <Card className={cn("p-4 transition hover:border-accent/40", entity === e.entity && "border-accent ring-4 ring-accent/10")}>
                  <div className="flex items-center gap-2 text-muted"><Icon className="size-4" /><span className="text-xs font-medium">{e.label}</span></div>
                  <p className="mt-2 text-2xl font-bold">{num(e.count)}</p>
                  <p className="text-xs text-muted">{e.amount_total ? money(e.amount_total, profile.currency, true) : e.quantity_total ? `${num(e.quantity_total, true)} units` : "records"}</p>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      {entity && <RecordsBrowser entity={entity} onClose={() => setEntity("")} currency={profile.currency} />}

      <section>
        <SectionTitle title="Uploads" sub="Review what we detected in each sheet and fix the mapping if needed." />
        {me.canManage && <AddRecords />}
        {uploads.isLoading ? <Loading /> : !asList(uploads.data).length ? <Card><Empty title="No uploads" /></Card> : (
          <div className="space-y-3">{asList(uploads.data).map((u: any) => <UploadRow key={u.id} u={u} canManage={me.canManage} />)}</div>
        )}
      </section>
    </div>
  );
}

function AddRecords() {
  const addFlow = useBusinessFinalize();
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  if (!open) return (
    <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><UploadCloud className="size-5" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Track more records</p><p className="text-xs text-muted">Add more files — Excel, CSV, PDF reports or Word — e.g. invoices, expenses or inventory, to get more dashboards.</p></div>
      <Button variant="primary" onClick={() => setOpen(true)}>Add records</Button>
    </Card>
  );
  return (
    <Card className="mb-4 space-y-4 p-5">
      <div className="flex items-center justify-between"><p className="font-semibold">Which records do you want to add?</p><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
      <RecordTypePicker value={types} onChange={setTypes} dense />
      <RecordUploader selected={types} compact onUploaded={async (res) => { await addFlow.finalize(res); setOpen(false); }} />
    </Card>
  );
}

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-3"><p className="font-semibold">{title}</p>{sub && <p className="text-sm text-muted">{sub}</p>}</div>
);

function UploadRow({ u, canManage }: { u: any; canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const detail = useQuery({ queryKey: ["business", "upload", u.id], queryFn: () => get(`/business/uploads/${u.id}/`), enabled: open });
  const remove = useMutation({ mutationFn: () => del(`/business/uploads/${u.id}/`), onSuccess: () => { toast.ok("Upload deleted"); qc.invalidateQueries({ queryKey: ["business"] }); }, onError: (e) => toast.err(errMsg(e)) });
  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-5 py-4 text-left cursor-pointer">
        <FileSpreadsheet className="size-5 shrink-0 text-ok" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{u.file_name}</p>
          <p className="text-xs text-muted">{u.sheet_count} sheet{u.sheet_count === 1 ? "" : "s"} · {(u.size_bytes / 1024).toFixed(0)} KB · {u.uploaded_by_email} · {timeAgo(u.created_at)}</p>
        </div>
        <div className="hidden flex-wrap gap-1 sm:flex">{asList(u.entities).map((e: string) => <Badge key={e} tone="accent">{e}</Badge>)}</div>
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-5">
          {detail.isLoading ? <Loading /> : asList(detail.data?.sheets).map((s: any) => <SheetEditor key={s.id} sheet={s} canManage={canManage} />)}
          {canManage && <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="size-3.5" /> Delete upload</Button>}
        </div>
      )}
    </Card>
  );
}

function SheetEditor({ sheet, canManage }: { sheet: any; canManage: boolean }) {
  const qc = useQueryClient();
  const flow = useBusinessFinalize();
  const catalog = useQuery({ queryKey: ["business", "catalog"], queryFn: () => get("/business/catalog/") });
  const entities = asList(catalog.data?.entities);
  const [entity, setEntity] = useState<string>(sheet.entity ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>(sheet.column_mapping ?? {});
  const fields: string[] = entities.find((e: any) => e.key === entity)?.fields ?? [];
  const dirty = entity !== (sheet.entity ?? "") || JSON.stringify(mapping) !== JSON.stringify(sheet.column_mapping ?? {});
  const save = useMutation({
    mutationFn: () => patch(`/business/sheets/${sheet.id}/`, entity !== (sheet.entity ?? "") && JSON.stringify(mapping) === JSON.stringify(sheet.column_mapping ?? {}) ? { entity } : { entity, column_mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) }),
    onSuccess: async (d: any) => {
      toast.ok("Sheet updated");
      if (d?.sheet) { setEntity(d.sheet.entity ?? ""); setMapping(d.sheet.column_mapping ?? {}); }
      if (d?.profile?.status === "confirmed" && d?.sheet?.entity) await flow.importSheets([sheet.id]);
      qc.invalidateQueries({ queryKey: ["business"] });
    },
    onError: (e) => toast.err(errMsg(e)),
  });
  const conf = Math.round((sheet.confidence ?? 0) * (sheet.confidence <= 1 ? 100 : 1));
  const cols = asList(sheet.columns);
  const preview = asList(sheet.preview_rows);

  return (
    <div className="rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <p className="text-sm font-semibold">{sheet.name}</p>
        <span className="text-xs text-muted">{num(sheet.row_count)} rows{sheet.rows_truncated ? " (truncated)" : ""}</span>
        {sheet.imported_at ? <Badge tone="ok"><Check className="size-3" /> {sheet.imported_count} imported</Badge> : <Badge>Not imported</Badge>}
        <div className="ml-auto flex items-center gap-2">
          {sheet.entity && <span className="text-xs text-muted">{conf}% confident</span>}
          <Select value={entity} disabled={!canManage} onChange={(e) => setEntity(e.target.value)} className="h-8 text-xs">
            <option value="">Not business data</option>
            {entities.map((e: any) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              {cols.map((c: any) => (
                <th key={c.name} className="min-w-36 px-3 py-2 align-top font-medium">
                  <p className="truncate">{c.name}</p>
                  <p className="font-normal text-muted">{c.type}{c.empty_ratio ? ` · ${Math.round(c.empty_ratio * 100)}% empty` : ""}</p>
                  <select disabled={!canManage || !entity} value={mapping[c.name] ?? ""} onChange={(e) => setMapping({ ...mapping, [c.name]: e.target.value })}
                    className={cn("mt-1.5 w-full rounded-md border px-1.5 py-1 font-normal", mapping[c.name] ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-surface text-muted")}>
                    <option value="">— ignore —</option>
                    {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.slice(0, 5).map((r: any, i: number) => (
              <tr key={i}>{cols.map((c: any) => <td key={c.name} className="max-w-48 truncate px-3 py-1.5 text-muted">{String(Array.isArray(r) ? r[cols.indexOf(c)] ?? "" : r?.[c.name] ?? "")}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && dirty && (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="ghost" onClick={() => { setEntity(sheet.entity ?? ""); setMapping(sheet.column_mapping ?? {}); }}>Discard</Button>
          <Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save mapping</Button>
        </div>
      )}
    </div>
  );
}

function RecordsBrowser({ entity, onClose, currency }: { entity: string; onClose: () => void; currency: string }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const params = { entity, offset, limit, ...(q ? { q } : {}), ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}) };
  const rq = useQuery({ queryKey: ["business", "records", params], queryFn: () => get("/business/records/", params) });
  const rows = asList(rq.data);
  const total = rq.data?.count ?? 0;
  const dataKeys = useMemo(() => {
    const s = new Set<string>();
    rows.slice(0, 20).forEach((r: any) => Object.keys(r.data ?? {}).forEach((k) => s.add(k)));
    return [...s].slice(0, 6);
  }, [rows]);
  const exportCsv = async () => {
    try {
      const res = await api.get("/business/records/export/", { params: { entity, ...(q ? { q } : {}), ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}) }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `${entity}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.err(errMsg(e)); }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <p className="mr-auto font-semibold capitalize">{entity} <span className="text-sm font-normal text-muted">· {num(total)}</span></p>
        <Input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Search…" className="h-9 w-40" />
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} className="h-9 w-36" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} className="h-9 w-36" />
        <Button size="sm" onClick={exportCsv}><Download className="size-3.5" /> CSV</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {rq.isLoading ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Record</th><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Amount</th><th className="px-4 py-2 font-medium">Status</th>
              {dataKeys.map((k) => <th key={k} className="px-4 py-2 font-medium whitespace-nowrap">{k}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{r.label || "—"}{r.customer_email && <p className="text-xs font-normal text-muted">{r.customer_email}</p>}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{r.record_date ? new Date(r.record_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.amount != null ? money(r.amount, currency) : r.quantity != null ? num(r.quantity) : "—"}</td>
                  <td className="px-4 py-2">{r.status ? <Badge>{r.status}</Badge> : "—"}</td>
                  {dataKeys.map((k) => <td key={k} className="max-w-48 truncate px-4 py-2 text-muted">{String(r.data?.[k] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty title="No records match" />}
        </div>
      )}
      {total > limit && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
          <span>{offset + 1}–{Math.min(offset + limit, total)} of {num(total)}</span>
          <div className="flex gap-2">
            <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
            <Button size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Next</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════ Setup tab ═══════════════════════════ */
function SetupTab({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const me = useMe();
  const catalog = useQuery({ queryKey: ["business", "catalog"], queryFn: () => get("/business/catalog/") });
  const [form, setForm] = useState<any>(null);
  const f = form ?? { business_type: profile.business_type ?? "", summary: profile.summary ?? "", currency: profile.currency ?? "INR", pages: profile.pages ?? [] };
  const inv = () => { qc.invalidateQueries({ queryKey: ["business"] }); };
  const flow = useBusinessFinalize();
  const save = useMutation({
    mutationFn: async (confirm: boolean) => {
      if (confirm) return flow.confirmAndImport(form ?? {});
      return patch("/business/profile/", form ?? {});
    },
    onSuccess: (_d, c) => { if (!c) toast.ok(me.isAdmin ? "Saved — confirm to put it live" : "Saved — the Admin needs to confirm it"); setForm(null); inv(); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const hire = useMutation({
    mutationFn: (types?: string[]) => post("/business/profile/activate-agents/", types ? { agent_types: types } : {}),
    onSuccess: (d: any) => { const n = asList(d?.created).length; toast.ok(n ? `Hired ${n} agent${n === 1 ? "" : "s"}` : "Already hired"); inv(); qc.invalidateQueries({ queryKey: ["agents"] }); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const [contact, setContact] = useState<{ contact_phone: string; default_country_code: string } | null>(null);
  const ct = contact ?? { contact_phone: profile.contact_phone ?? "", default_country_code: profile.default_country_code || phoneCc(f.currency) };
  const saveContact = useMutation({
    // contact fields don't change the profile status, so they get their own PATCH
    mutationFn: () => patch("/business/profile/", { contact_phone: ct.contact_phone.trim(), default_country_code: ct.default_country_code.trim() }),
    onSuccess: () => { toast.ok("Contact details saved"); setContact(null); inv(); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const togglePage = (k: string) => setForm({ ...f, pages: f.pages.includes(k) ? f.pages.filter((x: string) => x !== k) : [...f.pages, k] });
  const recs = asList(profile.recommended_agents);
  const pendingRecs = recs.filter((a: any) => !a.active);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="space-y-5 p-5 lg:col-span-3">
        <div className="flex items-center justify-between"><p className="font-semibold">Business profile</p><span className="text-xs text-muted">Detected by {profile.analysis_method === "ai" ? "AI" : "rules"}</span></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><Field label="Business type"><Input disabled={!me.canManage} value={f.business_type} onChange={(e) => setForm({ ...f, business_type: e.target.value })} /></Field></div>
          <Field label="Currency" hint={`Phone numbers in your records use ${profile.default_country_code || phoneCc(f.currency)}`}><Input disabled={!me.canManage} maxLength={3} value={f.currency} onChange={(e) => setForm({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
        </div>
        <Field label="Summary"><Textarea disabled={!me.canManage} rows={3} value={f.summary} onChange={(e) => setForm({ ...f, summary: e.target.value })} /></Field>
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Dashboard pages</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {asList(catalog.data?.pages).map((pg: any) => {
              const on = f.pages.includes(pg.key);
              const possible = pg.needs.some((n: string) => asList(profile.entities).includes(n));
              const Icon = PAGE_ICON[pg.key] ?? BarChart3;
              return (
                <button key={pg.key} disabled={!me.canManage} onClick={() => togglePage(pg.key)}
                  className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition cursor-pointer disabled:cursor-default", on ? "border-accent bg-accent/5" : "border-border", !possible && !on && "opacity-50")}>
                  <Icon className={cn("size-4", on ? "text-accent" : "text-muted")} />
                  <span className="flex-1">{pg.label}<span className="block text-[11px] text-muted">needs {pg.needs.join(" / ")}</span></span>
                  <span className={cn("grid size-5 place-items-center rounded-md border", on ? "border-accent bg-accent text-white" : "border-border")}>{on && <Check className="size-3" />}</span>
                </button>
              );
            })}
          </div>
        </div>
        {me.canManage && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {form && <Button loading={save.isPending && !save.variables} onClick={() => save.mutate(false)}>Save draft</Button>}
            {me.isAdmin ? (
              <Button variant="primary" loading={save.isPending && !!save.variables} disabled={profile.status === "confirmed" && !form} onClick={() => save.mutate(true)}><CircleCheck className="size-4" /> {profile.status === "confirmed" && !form ? "Confirmed" : "Confirm & import"}</Button>
            ) : <p className="self-center text-xs text-muted">Only the Admin can confirm the profile.</p>}
          </div>
        )}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold">Contact</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><Field label="Business contact number" hint="Your business phone, shown to customers"><Input type="tel" disabled={!me.canManage} placeholder="+91 98765 43210" value={ct.contact_phone} onChange={(e) => setContact({ ...ct, contact_phone: e.target.value })} /></Field></div>
            <Field label="Country code for imports" hint="Added to numbers without one"><Input disabled={!me.canManage} maxLength={5} placeholder="+91" value={ct.default_country_code} onChange={(e) => setContact({ ...ct, default_country_code: e.target.value.replace(/[^\d+]/g, "") })} /></Field>
          </div>
          {me.canManage && contact && <Button size="sm" loading={saveContact.isPending} onClick={() => saveContact.mutate()}>Save contact</Button>}
        </div>
        {profile.confirmed_by_email && <p className="text-xs text-muted">Confirmed by {profile.confirmed_by_email} · {fmtDate(profile.confirmed_at)}</p>}
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Recommended agents</p>
            {me.isAdmin && pendingRecs.length > 1 && <Button size="sm" variant="primary" loading={hire.isPending && !hire.variables} onClick={() => hire.mutate(undefined)}>Hire all</Button>}
          </div>
          {!recs.length && <p className="text-sm text-muted">Upload more data to get recommendations.</p>}
          <div className="space-y-2.5">
            {recs.map((a: any) => (
              <div key={a.agent_type} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <AgentIcon type={a.agent_type} />
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold capitalize">{a.agent_type} agent</p><p className="text-xs text-muted">{a.reason}</p></div>
                {a.active ? <Badge tone="ok"><Check className="size-3" /> Hired</Badge> : me.isAdmin ? <Button size="sm" loading={hire.isPending && hire.variables?.[0] === a.agent_type} onClick={() => hire.mutate([a.agent_type])}>Hire</Button> : <Badge>Admin hires</Badge>}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 font-semibold">Detected data</p>
          <div className="flex flex-wrap gap-1.5">{Object.entries(profile.entity_labels ?? {}).map(([k, v]) => { const I = ENTITY_ICON[k] ?? Database; return <Badge key={k} tone="accent" className="px-2 py-1 text-xs"><I className="size-3" /> {String(v)}</Badge>; })}</div>
        </Card>
      </div>
    </div>
  );
}
