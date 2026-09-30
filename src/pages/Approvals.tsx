import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import type { Approval } from "@/api/types";
import { asList, cn, errMsg, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Td, Toggle } from "@/components/ui";
import { AgentIcon } from "@/components/AgentIcon";
import { useMe } from "@/lib/useMe";
import { ApprovalCard } from "@/components/ApprovalCard";
import { toast } from "@/components/toast";

function Inbox() {
  const q = useQuery({ queryKey: ["approvals", "all"], queryFn: () => get("/approvals/"), refetchInterval: 15000 });
  const all = asList<Approval>(q.data);
  const pending = all.filter((a) => a.status === "pending");
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected && pending.some((p) => p.id === selected) ? selected : pending[0]?.id;

  if (q.isLoading) return <Loading />;
  if (!pending.length) return <Card><Empty icon={<CheckCircle2 className="size-8 text-ok" />} title="Inbox zero" text="When an agent wants to do something that needs a human, it shows up here." /></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="divide-y divide-border self-start lg:col-span-2">
        {pending.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id)} className={cn("block w-full px-4 py-3 text-left cursor-pointer", sel === a.id ? "bg-surface-2" : "hover:bg-surface-2/50")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-warn">{a.tool_name}</span>
              <span className="text-[11px] text-muted">{timeAgo(a.created_at)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm">{a.task_prompt}</p>
          </button>
        ))}
      </Card>
      <div className="space-y-3 lg:col-span-3">
        {sel && <ApprovalCard key={sel} approvalId={sel} />}
        {sel && <Link to={`/chat?task=${pending.find((p) => p.id === sel)?.task}`} className="inline-block text-xs text-muted hover:text-fg">Open task conversation →</Link>}
      </div>
    </div>
  );
}

function History() {
  const q = useQuery({ queryKey: ["approvals", "all"], queryFn: () => get("/approvals/") });
  const done = asList<Approval>(q.data).filter((a) => a.status !== "pending");
  if (q.isLoading) return <Loading />;
  if (!done.length) return <Card><Empty title="No decisions yet" /></Card>;
  return (
    <Card>
      <Table head={["Action", "Task", "Decision", "Reviewer", "Note", "When"]}>
        {done.map((a) => (
          <tr key={a.id} className="hover:bg-surface-2/40">
            <Td><Link to={`/inbox/${a.id}`} className="font-mono text-xs hover:text-accent">{a.tool_name}</Link></Td>
            <Td className="max-w-xs truncate text-muted">{a.task_prompt}</Td>
            <Td><StatusBadge status={a.status} /></Td>
            <Td className="text-muted">{a.reviewer_email ?? "—"}</Td>
            <Td className="max-w-[200px] truncate text-muted">{a.reviewer_note || "—"}</Td>
            <Td className="whitespace-nowrap text-muted">{timeAgo(a.reviewed_at ?? a.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function Rules() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["approvals", "rules"], queryFn: () => get("/approvals/rules/") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tool_name: "", always_require: true, always_block: false });
  const inv = () => qc.invalidateQueries({ queryKey: ["approvals", "rules"] });
  const create = useMutation({ mutationFn: () => post("/approvals/rules/", form), onSuccess: () => { inv(); setOpen(false); setForm({ tool_name: "", always_require: true, always_block: false }); toast.ok("Rule created"); }, onError: (e) => toast.err(errMsg(e)) });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: any }) => patch(`/approvals/rules/${id}/`, body), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/approvals/rules/${id}/`), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });
  const rules = asList(q.data);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Override the default risk zones for specific tools.</p>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" /> New rule</Button>
      </div>
      <Card>
        {q.isLoading ? <Loading /> : rules.length === 0 ? <Empty icon={<ShieldCheck className="size-8" />} title="No custom rules" text="e.g. always require approval for send_whatsapp, or block delete_file entirely." /> : (
          <Table head={["Tool", "Always require approval", "Always block", ""]}>
            {rules.map((r: any) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs">{r.tool_name}</Td>
                <Td><Toggle checked={r.always_require} onChange={(v) => update.mutate({ id: r.id, body: { always_require: v } })} /></Td>
                <Td><Toggle checked={r.always_block} onChange={(v) => update.mutate({ id: r.id, body: { always_block: v } })} /></Td>
                <Td className="text-right"><Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="size-4" /></Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New approval rule">
        <div className="space-y-4">
          <Field label="Tool name" hint="Exact tool id, e.g. send_email, send_whatsapp, send_slack_message"><Input value={form.tool_name} onChange={(e) => setForm({ ...form, tool_name: e.target.value })} /></Field>
          <div className="flex items-center justify-between"><span className="text-sm">Always require approval</span><Toggle checked={form.always_require} onChange={(v) => setForm({ ...form, always_require: v })} /></div>
          <div className="flex items-center justify-between"><span className="text-sm">Always block</span><Toggle checked={form.always_block} onChange={(v) => setForm({ ...form, always_block: v })} /></div>
          <Button variant="primary" className="w-full" loading={create.isPending} disabled={!form.tool_name} onClick={() => create.mutate()}>Create rule</Button>
        </div>
      </Modal>
    </>
  );
}

export default function Approvals() {
  const [tab, setTab] = useState<"inbox" | "history" | "rules" | "policies">("inbox");
  const pending = useQuery({ queryKey: ["approvals", "pending"], queryFn: () => get("/approvals/pending/") });
  const n = asList(pending.data).length;
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Inbox" subtitle={n ? `${n} action${n === 1 ? "" : "s"} awaiting approval` : "Nothing needs your approval"} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "inbox", label: "Awaiting approval" }, { value: "history", label: "History" }, { value: "rules", label: "Tool rules" }, { value: "policies", label: "Who approves" }]} />
      {tab === "inbox" && <Inbox />}
      {tab === "history" && <History />}
      {tab === "rules" && <Rules />}
      {tab === "policies" && <Policies />}
    </div>
  );
}

/* Per-agent approval policy: who may approve that agent's actions (Admin only edits). */
const POLICY_AGENTS = ["email", "communication", "finance", "document", "calendar", "crm", "workflow", "reporting", "compliance", "qa", "research", "custom"];
function Policies() {
  const qc = useQueryClient();
  const me = useMe();
  const q = useQuery({ queryKey: ["approvals", "policies"], queryFn: () => get("/approvals/policies/") });
  const byType: Record<string, any> = Object.fromEntries(asList(q.data?.policies).map((p: any) => [p.agent_type, p]));
  const inv = () => qc.invalidateQueries({ queryKey: ["approvals", "policies"] });
  const set = useMutation({
    mutationFn: ({ agent_type, approver }: { agent_type: string; approver: string }) =>
      approver === "default" ? del(`/approvals/policies/${byType[agent_type].id}/`) : post("/approvals/policies/", { agent_type, approver }),
    onSuccess: () => { toast.ok("Policy saved"); inv(); },
    onError: (e) => toast.err(errMsg(e)),
  });
  if (q.isLoading) return <Loading />;
  return (
    <>
      <p className="mb-4 text-sm text-muted">Choose who may approve each agent's actions. Agents without a policy default to <span className="font-medium text-fg">Manager or Admin</span>. A Manager only approves tasks of Members assigned to them, and nobody but the Admin approves their own task.</p>
      <Card className="divide-y divide-border">
        {POLICY_AGENTS.map((t) => {
          const p = byType[t];
          return (
            <div key={t} className="flex items-center gap-3 px-5 py-3">
              <AgentIcon type={t} size="sm" />
              <p className="flex-1 text-sm font-medium capitalize">{t} agent</p>
              {me.isAdmin ? (
                <Select value={p?.approver ?? "default"} onChange={(e) => set.mutate({ agent_type: t, approver: e.target.value })} className="h-8 text-xs">
                  <option value="default">Default (Manager or Admin)</option>
                  <option value="admin_or_manager">Manager or Admin</option>
                  <option value="admin">Admin only</option>
                </Select>
              ) : <Badge tone={p?.approver === "admin" ? "accent" : "neutral"}>{p?.approver_label ?? "Manager or Admin"}</Badge>}
            </div>
          );
        })}
      </Card>
      {!me.isAdmin && <p className="mt-3 text-xs text-muted">Only the Admin can change approval policies.</p>}
    </>
  );
}

export function ApprovalDetail() {
  const { id } = useParams();
  const q = useQuery<Approval>({ queryKey: ["approval", id], queryFn: () => get(`/approvals/${id}/`) });
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link to="/inbox" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Inbox</Link>
      {q.data?.task_prompt && <p className="mb-4 text-sm text-muted">Task: <span className="text-fg">{q.data.task_prompt}</span></p>}
      {id && <ApprovalCard approvalId={id} />}
      {q.data?.task && <Link to={`/chat?task=${q.data.task}`} className="mt-3 inline-block text-xs text-muted hover:text-fg">Open task conversation →</Link>}
    </div>
  );
}
