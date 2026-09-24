import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ShieldAlert, Bot, Wallet, ListTodo, X, Zap } from "lucide-react";
import { get, post } from "@/api/client";
import { asList, cn, errMsg } from "@/lib/utils";
import { Card, ErrorBox, Loading, StatusBadge } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

function Stat({ icon: Icon, label, value, sub, tone, to }: { icon: any; label: string; value: string | number; sub?: string; tone?: "warn" | "err" | "ok"; to?: string }) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:border-muted/40">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs font-medium">{label}</span>
        <Icon className={cn("size-4", tone === "warn" && "text-warn", tone === "err" && "text-err", tone === "ok" && "text-ok")} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", tone ? `text-${tone}` : "text-muted")}>{sub}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Home() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => get("/dashboard/"), refetchInterval: 30000 });
  const quick = useQuery({ queryKey: ["quick-tasks"], queryFn: () => get("/quick-tasks/") });

  const decide = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => post(`/approvals/${id}/decide/`, { approved, note: "" }),
    onSuccess: (_d, v) => { toast.ok(v.approved ? "Approved" : "Rejected"); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["approvals"] }); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const removeQuick = useMutation({
    mutationFn: (prompt: string) => post("/quick-tasks/remove/", { prompt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-tasks"] }),
  });

  if (dash.isLoading) return <Loading />;
  if (dash.error) return <div className="p-6"><ErrorBox error={dash.error} /></div>;
  const d = dash.data ?? {};
  const s = d.stats ?? {};
  const quickTasks = asList(quick.data);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <p className="text-sm text-muted">{d.greeting?.day}, {d.greeting?.date && new Date(d.greeting.date).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{d.greeting?.full_greeting ?? "Welcome"}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListTodo} label="Tasks today" value={s.tasks_today?.count ?? 0} sub={s.tasks_today?.delta_label} to="/chat" />
        <Stat icon={ShieldAlert} label="Need approval" value={s.need_approval?.count ?? 0} sub={s.need_approval?.has_urgent ? "Waiting on you" : "Nothing pending"} tone={s.need_approval?.has_urgent ? "warn" : undefined} to="/approvals" />
        <Stat icon={Bot} label="Agents active" value={s.agents_running?.total_active ?? 0} sub={s.agents_running?.status_label} tone={s.agents_running?.all_healthy === false ? "err" : "ok"} to="/agents" />
        <Stat icon={Wallet} label="Cost today" value={`€${Number(s.cost_today?.amount ?? 0).toFixed(2)}`} sub={s.cost_today?.limit ? `${s.cost_today.percentage_used ?? 0}% of €${s.cost_today.limit} ${s.cost_today.limit_period ?? ""}` : "No budget set"} tone={s.cost_today?.alert_status === "critical" ? "err" : s.cost_today?.alert_status === "warning" ? "warn" : undefined} to="/costs" />
      </div>

      {quickTasks.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium">Quick tasks</p>
          <div className="flex flex-wrap gap-2">
            {quickTasks.map((q: any) => (
              <div key={q.id ?? q.prompt} className="group flex items-center rounded-full border border-border bg-surface text-sm hover:border-accent/50">
                <button onClick={() => nav("/chat", { state: { prompt: q.prompt ?? q.title } })} className="flex items-center gap-1.5 py-1.5 pr-1 pl-3 cursor-pointer">
                  <Zap className="size-3.5 text-accent" /> {q.title ?? q.label ?? q.prompt}
                </button>
                {q.prompt && <button title="Hide" onClick={() => removeQuick.mutate(q.prompt)} className="px-2 text-muted opacity-0 group-hover:opacity-100 cursor-pointer"><X className="size-3" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Recent activity</p>
            <Link to="/chat" className="flex items-center gap-1 text-xs text-muted hover:text-fg">All chats <ArrowRight className="size-3" /></Link>
          </div>
          <Card className="divide-y divide-border">
            {asList(d.recent_activity).length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No activity yet — start a chat to give your agents work.</p>}
            {asList(d.recent_activity).map((a: any) => (
              <Link key={a.task_id} to={`/chat?task=${a.task_id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-2/50">
                <AgentIcon type={a.agent_type} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><span className="font-medium">{a.agent_name}</span> <span className="text-muted">{a.verb}</span></p>
                  <p className="truncate text-xs text-muted">{a.summary}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  <span className="text-[11px] text-muted">{a.time_ago}</span>
                </div>
              </Link>
            ))}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Waiting for you</p>
            <Link to="/approvals" className="flex items-center gap-1 text-xs text-muted hover:text-fg">Inbox <ArrowRight className="size-3" /></Link>
          </div>
          <div className="space-y-3">
            {asList(d.urgent_approvals).length === 0 && (
              <Card className="flex flex-col items-center gap-2 px-4 py-10 text-center">
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
                  <Link to={`/approvals/${a.id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2">Review</Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
