import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, Users } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import { asList, errMsg, fmtDate, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Table, Td, Textarea } from "@/components/ui";
import { Avatar } from "@/components/Layout";
import { toast } from "@/components/toast";

export function CustomersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", company: "" });
  const q = useQuery({ queryKey: ["customers"], queryFn: () => get("/memory/") });
  const create = useMutation({ mutationFn: () => post("/memory/create/", form), onSuccess: () => { toast.ok("Customer added"); setOpen(false); setForm({ email: "", name: "", company: "" }); qc.invalidateQueries({ queryKey: ["customers"] }); }, onError: (e) => toast.err(errMsg(e)) });
  const list = asList(q.data).filter((c: any) => !search || `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Customers" subtitle="What your agents remember about the people they talk to." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" /> Add customer</Button>} />
      <div className="relative mb-4 max-w-sm"><Search className="absolute top-2.5 left-3 size-4 text-muted" /><Input className="pl-9" placeholder="Filter by name, email, company" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Card>
        {q.isLoading ? <Loading /> : list.length === 0 ? <Empty icon={<Users className="size-8" />} title="No customers yet" text="Profiles are created automatically as agents interact with people, or add one manually." /> : (
          <Table head={["Customer", "Company", "Style", "Interactions", "Last seen"]}>
            {list.map((c: any) => (
              <tr key={c.id} className="hover:bg-surface-2/40">
                <Td><Link to={`/customers/${c.id}`} className="flex items-center gap-3"><Avatar name={c.name || c.email} /><div><p className="font-medium">{c.name || "—"}</p><p className="text-xs text-muted">{c.email}</p></div></Link></Td>
                <Td className="text-muted">{c.company || "—"}</Td>
                <Td>{c.communication_style ? <Badge>{c.communication_style}</Badge> : <span className="text-muted">—</span>}</Td>
                <Td className="text-muted">{c.interaction_count ?? 0}</Td>
                <Td className="text-muted">{timeAgo(c.last_interaction_at) || "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add customer">
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <Button variant="primary" className="w-full" disabled={!form.email} loading={create.isPending} onClick={() => create.mutate()}>Add customer</Button>
        </div>
      </Modal>
    </div>
  );
}

const FIELDS: [string, string, "input" | "textarea"][] = [
  ["name", "Name", "input"], ["company", "Company", "input"], ["role", "Role", "input"], ["preferred_language", "Preferred language", "input"],
  ["communication_style", "Communication style", "input"], ["urgency_preference", "Urgency preference", "input"],
  ["custom_instructions", "Custom instructions for agents", "textarea"], ["agent_notes", "Agent notes", "textarea"],
];

export function CustomerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customer", id], queryFn: () => get(`/memory/${id}/`) });
  const hist = useQuery({ queryKey: ["customer", id, "interactions"], queryFn: () => get(`/memory/${id}/interactions/`) });
  const [form, setForm] = useState<any>(null);
  const save = useMutation({ mutationFn: () => patch(`/memory/${id}/`, form), onSuccess: () => { toast.ok("Saved"); setForm(null); qc.invalidateQueries({ queryKey: ["customer", id] }); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: () => del(`/memory/${id}/`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); history.back(); } });
  if (q.isLoading) return <Loading />;
  const c = { ...q.data, ...(form ?? {}) };
  const topics = asList(c.common_topics);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Customers</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={c.name || c.email} className="size-12 text-base" />
        <div className="flex-1"><h1 className="text-xl font-semibold">{c.name || c.email}</h1><p className="text-sm text-muted">{c.email}{c.company && ` · ${c.company}`}</p></div>
        <Button variant="danger" size="sm" onClick={() => remove.mutate()}>Delete</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 p-5 lg:col-span-2">
          {FIELDS.map(([k, label, type]) => (
            <Field key={k} label={label}>
              {type === "input" ? <Input value={c[k] ?? ""} onChange={(e) => setForm({ ...(form ?? {}), [k]: e.target.value })} /> : <Textarea rows={3} value={c[k] ?? ""} onChange={(e) => setForm({ ...(form ?? {}), [k]: e.target.value })} />}
            </Field>
          ))}
          <Button variant="primary" disabled={!form} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </Card>
        <div className="space-y-6 lg:col-span-3">
          {(c.interaction_summary || topics.length > 0) && (
            <Card className="p-5">
              <p className="mb-2 text-sm font-medium">What agents know</p>
              {c.interaction_summary && <p className="text-sm text-muted">{c.interaction_summary}</p>}
              {topics.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{topics.map((t: any, i: number) => <Badge key={i} tone="accent">{typeof t === "string" ? t : t.topic ?? JSON.stringify(t)}</Badge>)}</div>}
            </Card>
          )}
          <Card>
            <p className="border-b border-border px-5 py-3 text-sm font-medium">Interaction history</p>
            <div className="relative space-y-5 px-5 py-4">
              {asList(hist.data).length === 0 && <p className="py-6 text-center text-sm text-muted">No interactions yet</p>}
              {asList(hist.data).map((i: any) => (
                <div key={i.id} className="flex gap-3">
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Badge>{i.interaction_type}</Badge><span className="text-xs text-muted">{fmtDate(i.created_at)}</span></div>
                    <p className="mt-1 text-sm">{i.summary}</p>
                    {i.task && <Link to={`/chat?task=${i.task}`} className="text-xs text-muted hover:text-accent">View task →</Link>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
