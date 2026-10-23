import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Scale, CheckCircle2 } from "lucide-react";
import { get, patch, post } from "@/api/client";
import { asList, errMsg, fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Toggle } from "@/components/ui";
import { toast } from "@/components/toast";
import { useMe } from "@/lib/useMe";

const SEV: Record<string, any> = { low: "info", medium: "warn", high: "err", critical: "err" };
const RULE_TYPES: [string, string][] = [["required_document", "Required document"], ["deadline", "Deadline"], ["both", "Document + deadline"]];
const FREQUENCIES: [string, string][] = [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["annual", "Annual"], ["one_time", "One-time"]];
/** Enough to save: a name, the documents a document rule needs, the deadline a deadline rule needs. */
const ruleOk = (f: any) =>
  !!f.name.trim()
  && (f.rule_type === "deadline" || String(f.required_document_types).split(",").some((s: string) => s.trim()))
  && (f.rule_type === "required_document" || (f.frequency === "one_time" ? !!f.deadline_date : f.deadline_day >= 1 && f.deadline_day <= 31));

export default function Compliance() {
  const qc = useQueryClient();
  const me = useMe(); // compliance rules are workspace policy: Admin or Manager
  const [tab, setTab] = useState<"alerts" | "rules">("alerts");
  const alerts = useQuery({ queryKey: ["compliance", "alerts"], queryFn: () => get("/compliance/alerts/") });
  const rules = useQuery({ queryKey: ["compliance", "rules"], queryFn: () => get("/compliance/policy-rules/") });
  const [open, setOpen] = useState(false);
  // values match the backend's choices (PolicyRule.RuleType / Frequency) — anything else is a 400
  const blank = { name: "", description: "", rule_type: "required_document", required_document_types: "invoice", frequency: "monthly", deadline_day: 5, deadline_date: "", grace_period_days: 3, is_active: true };
  const [form, setForm] = useState<any>(blank);
  const inv = () => qc.invalidateQueries({ queryKey: ["compliance"] });

  const resolve = useMutation({ mutationFn: (id: string) => post(`/compliance/alerts/${id}/resolve/`), onSuccess: () => { toast.ok("Alert resolved"); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const toggle = useMutation({ mutationFn: ({ id, v }: { id: string; v: boolean }) => patch(`/compliance/policy-rules/${id}/`, { is_active: v }), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });
  const create = useMutation({
    mutationFn: () => {
      const docs = form.rule_type !== "deadline";
      const dated = form.rule_type !== "required_document";
      const once = form.frequency === "one_time";
      return post("/compliance/policy-rules/", {
        ...form,
        required_document_types: docs ? String(form.required_document_types).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        deadline_day: dated && !once ? form.deadline_day : null,
        deadline_date: dated && once ? form.deadline_date || null : null,
      });
    },
    onSuccess: () => { toast.ok("Policy rule created"); setOpen(false); setForm(blank); inv(); },
    onError: (e) => toast.err(errMsg(e)),
  });

  const al = asList(alerts.data);
  const open_ = al.filter((a: any) => a.status !== "resolved");

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Compliance" subtitle="Policy rules the Compliance Agent monitors, and the alerts it raises." actions={me.canManage ? <Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" /> New rule</Button> : undefined} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "alerts", label: `Alerts${open_.length ? ` (${open_.length})` : ""}` }, { value: "rules", label: "Policy rules" }]} />
      {tab === "alerts" && (
        alerts.isLoading ? <Loading /> : al.length === 0 ? <Card><Empty icon={<CheckCircle2 className="size-8 text-ok" />} title="No compliance alerts" /></Card> : (
          <div className="space-y-3">
            {al.map((a: any) => (
              <Card key={a.id} className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={SEV[a.severity] ?? "neutral"}>{a.severity}</Badge><span className="font-medium">{a.title}</span></div>
                  <p className="mt-1 text-sm text-muted">{a.detail}</p>
                  <p className="mt-2 text-xs text-muted">{a.policy_rule_name} · {a.period} · due {a.due_date ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.status !== "resolved" && <Button size="sm" loading={resolve.isPending && resolve.variables === a.id} onClick={() => resolve.mutate(a.id)}>Resolve</Button>}
                </div>
              </Card>
            ))}
          </div>
        )
      )}
      {tab === "rules" && (
        <Card>
          {rules.isLoading ? <Loading /> : asList(rules.data).length === 0 ? <Empty icon={<Scale className="size-8" />} title="No policy rules" /> : (
            <Table head={["Rule", "Type", "Frequency", "Deadline", "Active"]}>
              {asList(rules.data).map((r: any) => (
                <tr key={r.id}>
                  <Td><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.description}</p></Td>
                  <Td className="text-muted">{r.rule_type?.replace(/_/g, " ")}</Td>
                  <Td className="text-muted capitalize">{r.frequency}</Td>
                  <Td className="text-muted">{r.deadline_date ? fmtDate(r.deadline_date) : r.deadline_day ? `Day ${r.deadline_day} (+${r.grace_period_days ?? 0}d grace)` : "—"}</Td>
                  <Td><Toggle aria-label={`Rule ${r.name} active`} checked={r.is_active} disabled={!me.canManage} onChange={(v) => toggle.mutate({ id: r.id, v })} /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New policy rule" wide>
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly invoice review" /></Field>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rule type">
              <Select className="w-full" value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
                {RULE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Frequency">
              <Select className="w-full" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            {form.rule_type !== "deadline" && (
              <Field label="Required document types" hint="Comma separated, e.g. invoice, bank statement"><Input value={form.required_document_types} onChange={(e) => setForm({ ...form, required_document_types: e.target.value })} /></Field>
            )}
            {form.rule_type !== "required_document" && (
              <div className="grid grid-cols-2 gap-3">
                {form.frequency === "one_time"
                  ? <Field label="Deadline date"><Input type="date" value={form.deadline_date} onChange={(e) => setForm({ ...form, deadline_date: e.target.value })} /></Field>
                  : <Field label="Deadline day" hint="Day of the month"><Input type="number" min={1} max={31} value={form.deadline_day} onChange={(e) => setForm({ ...form, deadline_day: +e.target.value })} /></Field>}
                <Field label="Grace days"><Input type="number" min={0} value={form.grace_period_days} onChange={(e) => setForm({ ...form, grace_period_days: +e.target.value })} /></Field>
              </div>
            )}
          </div>
          <Button variant="primary" className="w-full" disabled={!ruleOk(form)} loading={create.isPending} onClick={() => create.mutate()}>Create rule</Button>
        </div>
      </Modal>
    </div>
  );
}
