import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { get, patch } from "@/api/client";
import { asList, cn, errMsg } from "@/lib/utils";
import { Button, Card, ErrorBox, Field, Input, Loading, Modal, PageHeader, Table, Td } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { toast } from "@/components/toast";

export default function Costs() {
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["costs", "summary"], queryFn: () => get("/costs/summary/") });
  const creators = useQuery({ queryKey: ["costs", "creators"], queryFn: () => get("/costs/by-creator/") });
  const budget = useQuery({ queryKey: ["costs", "budget"], queryFn: () => get("/costs/budget/") });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ limit_eur: 50, alert_threshold_pct: 80 });
  const save = useMutation({
    mutationFn: () => patch("/costs/budget/update/", form),
    onSuccess: () => { toast.ok("Budget updated"); setEdit(false); qc.invalidateQueries({ queryKey: ["costs"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e) => toast.err(errMsg(e)),
  });

  if (s.isLoading) return <Loading />;
  if (s.error) return <div className="p-6"><ErrorBox error={s.error} /></div>;
  const d = s.data ?? {};
  const h = d.header ?? {};
  const mb = d.monthly_budget ?? {};
  const days = asList(d.this_week?.days);
  const pct = Math.min(100, Number(mb.pct_used ?? 0));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Costs" subtitle="LLM spend across agents and people."
        actions={<Button onClick={() => { setForm({ limit_eur: Number(budget.data?.limit_eur ?? 50), alert_threshold_pct: Number(budget.data?.alert_threshold_pct ?? 80) }); setEdit(true); }}>Set budget</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Today</p><p className="mt-2 text-2xl font-semibold">{h.today?.cost_label ?? "€0.00"}</p><p className="mt-1 text-xs text-muted">{h.today?.tasks_label}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">This month</p><p className="mt-2 text-2xl font-semibold">{h.this_month?.cost_label ?? "€0.00"}</p><p className="mt-1 text-xs text-muted">{h.this_month?.tasks_label}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Avg per task</p><p className="mt-2 text-2xl font-semibold">{h.avg_per_task?.cost_label ?? "—"}</p><p className={cn("mt-1 text-xs", h.avg_per_task?.change_direction === "up" ? "text-err" : "text-ok")}>{h.avg_per_task?.change_label}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Budget</p><p className="mt-2 text-2xl font-semibold">{h.budget?.limit_label ?? "None"}</p><p className="mt-1 text-xs text-muted">{h.budget?.remaining_label ?? "Set a monthly limit"}</p></Card>
      </div>

      {mb.limit_eur ? (
        <Card className="mt-4 p-5">
          <div className="flex justify-between text-sm"><span>{mb.spent_label}</span><span className="text-muted">{mb.pct_used_label}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", pct >= 95 ? "bg-err" : pct >= 80 ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">{mb.remaining_label}</p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex justify-between"><p className="text-sm font-medium">This week</p><p className="text-sm text-muted">{d.this_week?.total_label}</p></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day_label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `€${v}`} width={48} />
                <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`€${Number(v).toFixed(2)}`, "Cost"]} />
                <Bar dataKey="cost_eur" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <p className="border-b border-border px-5 py-3 text-sm font-medium">By agent</p>
          <div className="divide-y divide-border">
            {asList(d.by_agent).length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No spend yet</p>}
            {asList(d.by_agent).map((a: any) => (
              <div key={a.agent_id ?? a.name} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <AgentIcon type={a.agent_type} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{a.name}</p><p className="text-xs text-muted">{a.task_label}</p></div>
                  <p className="text-sm font-medium">{a.cost_label}</p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent" style={{ width: `${a.pct_of_total ?? 0}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <p className="border-b border-border px-5 py-3 text-sm font-medium">By person (last 30 days)</p>
        <Table head={["Person", "Tasks", "Tokens", "Cost"]}>
          {asList(creators.data?.breakdown).map((c: any) => (
            <tr key={c.user_id}>
              <Td>{c.name} {c.is_me && <span className="ml-1 text-xs text-accent">(you)</span>}<p className="text-xs text-muted">{c.email}</p></Td>
              <Td className="text-muted">{c.task_count}</Td>
              <Td className="text-muted">{Number(c.total_tokens).toLocaleString()}</Td>
              <Td>€{Number(c.total_cost_eur).toFixed(2)}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={edit} onClose={() => setEdit(false)} title="Monthly budget">
        <div className="space-y-4">
          <Field label="Limit (EUR)"><Input type="number" min={1} value={form.limit_eur} onChange={(e) => setForm({ ...form, limit_eur: +e.target.value })} /></Field>
          <Field label="Alert at (% used)"><Input type="number" min={1} max={100} value={form.alert_threshold_pct} onChange={(e) => setForm({ ...form, alert_threshold_pct: +e.target.value })} /></Field>
          <Button variant="primary" className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save budget</Button>
        </div>
      </Modal>
    </div>
  );
}
