import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import type { Approval } from "@/api/types";
import { asList, cn, errMsg, timeAgo } from "@/lib/utils";
import { Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, StatusBadge, Table, Tabs, Td, Toggle } from "@/components/ui";
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
            <Td><Link to={`/approvals/${a.id}`} className="font-mono text-xs hover:text-accent">{a.tool_name}</Link></Td>
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
  const [tab, setTab] = useState<"inbox" | "history" | "rules">("inbox");
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Approvals" subtitle="Review actions your agents want to take before they happen." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "inbox", label: "Inbox" }, { value: "history", label: "History" }, { value: "rules", label: "Rules" }]} />
      {tab === "inbox" && <Inbox />}
      {tab === "history" && <History />}
      {tab === "rules" && <Rules />}
    </div>
  );
}

export function ApprovalDetail() {
  const { id } = useParams();
  const q = useQuery<Approval>({ queryKey: ["approval", id], queryFn: () => get(`/approvals/${id}/`) });
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <Link to="/approvals" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Approvals</Link>
      {q.data?.task_prompt && <p className="mb-4 text-sm text-muted">Task: <span className="text-fg">{q.data.task_prompt}</span></p>}
      {id && <ApprovalCard approvalId={id} />}
      {q.data?.task && <Link to={`/chat?task=${q.data.task}`} className="mt-3 inline-block text-xs text-muted hover:text-fg">Open task conversation →</Link>}
    </div>
  );
}
