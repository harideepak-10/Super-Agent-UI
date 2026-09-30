import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ShieldAlert, Bot, Wallet, ListTodo, X, Zap, BarChart3, CalendarClock } from "lucide-react";
import { KpiCard } from "@/components/Widgets";
import { bizPrompt } from "@/components/TrackRecords";
import { useMe } from "@/lib/useMe";
import { useAuth } from "@/store/auth";
import { useState } from "react";
import { get, post } from "@/api/client";
import { asList, cn, errMsg } from "@/lib/utils";
import { Card, ErrorBox, Loading } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

function Stat({ icon: Icon, label, value, sub, tone, to, chip }: { icon: any; label: string; value: string | number; sub?: string; tone?: "warn" | "err" | "ok"; to?: string; chip: string }) {
  const body = (
    <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-accent/30">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn("grid size-9 place-items-center rounded-xl", chip)}><Icon className="size-[18px]" /></span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", tone === "warn" ? "text-warn" : tone === "err" ? "text-err" : tone === "ok" ? "text-ok" : "text-muted")}>{sub}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Home() {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => get("/dashboard/"), refetchInterval: 30000 });

  const decide = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => post(`/approvals/${id}/decide/`, { approved, note: "" }),
    onSuccess: (_d, v) => { toast.ok(v.approved ? "Approved" : "Rejected"); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["approvals"] }); },
    onError: (e) => toast.err(errMsg(e)),
  });

  if (dash.isLoading) return <Loading />;
  if (dash.error) return <div className="p-6"><ErrorBox error={dash.error} /></div>;
  const d = dash.data ?? {};
  const s = d.stats ?? {};

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">{d.greeting?.day}, {d.greeting?.date && new Date(d.greeting.date).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
          <p className="mt-1 text-2xl text-muted">Good {d.greeting?.time_of_day ?? "day"},</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{d.greeting?.name ?? "there"} 👋</h1>
        </div>
        <Link to="/tasks/new" className="bg-brand hidden h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] hover:brightness-110 sm:inline-flex"><Zap className="size-4" /> New Task</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat chip="bg-accent/10 text-accent" icon={ListTodo} label="Tasks today" value={s.tasks_today?.count ?? 0} sub={s.tasks_today?.delta_label ?? "No change from yesterday"} to="/tasks" />
        <Stat chip="bg-emerald-500/10 text-emerald-500" icon={Bot} label="Agents running" value={s.agents_running?.total_active ?? 0} sub={s.agents_running?.status_label ?? "No agents yet"} tone={s.agents_running?.all_healthy === false ? "err" : "ok"} to="/agents" />
        <Stat chip="bg-orange-500/10 text-orange-500" icon={ShieldAlert} label="Need approval" value={s.need_approval?.count ?? 0} sub={(s.need_approval?.count ?? 0) > 0 ? "Tap to review" : "All caught up"} tone={s.need_approval?.has_urgent ? "warn" : undefined} to="/inbox" />
        <Stat chip="bg-violet-500/10 text-violet-500" icon={Wallet} label="Cost today" value={`€${Number(s.cost_today?.amount ?? 0).toFixed(2)}`} sub={s.cost_today?.limit ? `${s.cost_today.percentage_used ?? 0}% of €${s.cost_today.limit} ${s.cost_today.limit_period ?? ""}` : "No budget set"} tone={s.cost_today?.alert_status === "critical" ? "err" : s.cost_today?.alert_status === "warning" ? "warn" : undefined} to="/costs" />
      </div>

      <TrackRecordsBanner />
      <Snapshots />

      <div className="mt-8">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[17px] font-semibold">Waiting for you</p>
            <Link to="/inbox" className="flex items-center gap-1 text-xs text-muted hover:text-fg">Inbox <ArrowRight className="size-3" /></Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {asList(d.urgent_approvals).length === 0 && (
              <Card className="flex flex-col items-center gap-2 px-4 py-10 text-center md:col-span-2 xl:col-span-3">
                <CheckCircle2 className="size-6 text-ok" />
                <p className="text-sm text-muted">No approvals pending</p>
              </Card>
            )}
            {asList(d.urgent_approvals).map((a: any) => (
              <Card key={a.id} className={cn("p-4", a.is_urgent && "border-warn/40")}>
                <div className="flex items-start gap-3">
                  <AgentIcon type={a.agent_type} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.message}</p>
                    <p className="mt-0.5 font-mono text-xs text-warn">{a.tool_name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{a.task_prompt}</p>
                    <p className="mt-1 text-[11px] text-muted">{a.requested_ago}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide.mutate({ id: a.id, approved: true })} className="flex-1 rounded-lg bg-ok py-1.5 text-xs font-medium text-white hover:brightness-110 cursor-pointer">Approve</button>
                  <button onClick={() => decide.mutate({ id: a.id, approved: false })} className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-surface-2 cursor-pointer">Reject</button>
                  <Link to={`/inbox/${a.id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2">Review</Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Business pulse + CRM follow-ups due — only shown when that data exists. */
function Snapshots() {
  const biz = useQuery({ queryKey: ["business", "dashboard", "30d"], queryFn: () => get("/business/dashboard/", { period: "30d" }), retry: false });
  const fu = useQuery({ queryKey: ["crm", "followups", "open", "week"], queryFn: () => get("/crm/follow-ups/", { status: "open", due: "week" }), retry: false });
  const page = asList(biz.data?.pages).find((p: any) => !p.empty && asList(p.kpis).length);
  const due = asList(fu.data);
  if (!page && !due.length) return null;
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-5">
      {page && (
        <div className={due.length ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex min-w-0 items-center gap-2 text-[17px] font-semibold"><BarChart3 className="size-4 shrink-0 text-accent" /> <span className="truncate">{page.label}</span> <span className="hidden shrink-0 text-xs font-normal text-muted sm:inline">· last 30 days</span></p>
            <Link to="/business" className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline">Open <ArrowRight className="size-3" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{asList(page.kpis).map((w: any) => <KpiCard key={w.id} w={w} currency={biz.data.currency} />)}</div>
        </div>
      )}
      {due.length > 0 && (
        <div className={page ? "lg:col-span-2" : "lg:col-span-5"}>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[17px] font-semibold"><CalendarClock className="size-4 text-accent" /> Follow-ups this week</p>
            <Link to="/crm" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">CRM <ArrowRight className="size-3" /></Link>
          </div>
          <Card className="divide-y divide-border">
            {due.slice(0, 4).map((f: any) => (
              <Link key={f.id} to="/crm" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50">
                <span className={cn("size-2 shrink-0 rounded-full", f.overdue ? "bg-err" : "bg-accent")} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{f.customer_name || f.customer_email}</p><p className="truncate text-xs text-muted">{f.note}</p></div>
                <span className={cn("text-xs", f.overdue ? "text-err" : "text-muted")}>{new Date(f.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

/** Reminder for owners who skipped the business-records question. */
function TrackRecordsBanner() {
  const me = useMe();
  const user = useAuth((s) => s.user);
  const [state, setState] = useState(() => bizPrompt.get(user?.id));
  const prof = useQuery({ queryKey: ["business", "profile"], queryFn: () => get("/business/profile/"), enabled: me.canManage && state === "skipped", retry: false });
  if (!me.canManage || state !== "skipped" || !prof.isSuccess || prof.data?.id) return null;
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl bg-navy p-5 text-white shadow-card sm:p-6">
      <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-[#1a6fff]/40 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="bg-brand grid size-12 shrink-0 place-items-center rounded-xl"><BarChart3 className="size-6" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Do you have business records to track?</p>
          <p className="text-sm text-white/70">Upload your customers, sales, orders or invoices and get live dashboards in minutes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/setup/business" className="bg-brand inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:brightness-110">Upload records <ArrowRight className="size-4" /></Link>
          <button onClick={() => { bizPrompt.set(user?.id, "dismissed"); setState("dismissed"); }} className="grid size-10 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white cursor-pointer" aria-label="Don't show again" title="Don't show again"><X className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}
