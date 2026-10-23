import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, Users } from "lucide-react";
import { del, get, patch, post } from "@/api/client";
import { asList, errMsg, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select, Table, Td, Textarea } from "@/components/ui";
import { Avatar } from "@/components/Layout";
import { useMe } from "@/lib/useMe";
import { toast } from "@/components/toast";
import { CustomerChannels } from "@/components/CustomerChannels";
import { InteractionRow } from "@/components/Interaction";

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

const FIELDS: [string, string, "input" | "email" | "textarea" | "select"][] = [
  ["name", "Name", "input"], ["email", "Email", "email"], ["company", "Company", "input"], ["role", "Role", "input"], ["preferred_language", "Preferred language", "select"],
  ["communication_style", "Communication style", "select"], ["urgency_preference", "Urgency preference", "select"],
  ["custom_instructions", "Custom instructions for agents", "textarea"], ["agent_notes", "Agent notes", "textarea"],
];

// Same codes as the backend (apps/crm/preferences.py LANGUAGES / STYLES / URGENCY)
const LANGUAGES: [string, string][] = [
  ["en", "English"], ["ta", "Tamil"], ["hi", "Hindi"], ["te", "Telugu"], ["ml", "Malayalam"], ["kn", "Kannada"], ["bn", "Bengali"],
  ["mr", "Marathi"], ["gu", "Gujarati"], ["pa", "Punjabi"], ["ur", "Urdu"], ["si", "Sinhala"], ["ar", "Arabic"], ["fr", "French"],
  ["es", "Spanish"], ["de", "German"], ["pt", "Portuguese"], ["it", "Italian"], ["nl", "Dutch"], ["tr", "Turkish"], ["ru", "Russian"],
  ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"], ["th", "Thai"], ["id", "Indonesian"], ["ms", "Malay"],
];
const CHOICES: Record<string, [string, string][]> = {
  preferred_language: LANGUAGES,
  communication_style: [["formal", "Formal"], ["casual", "Casual & friendly"], ["technical", "Technical"], ["brief", "Brief & direct"]],
  urgency_preference: [["same_day", "Same day"], ["24h", "Within 24 hours"], ["48h", "Within 48 hours"], ["low", "Low priority"]],
};
const HINTS: Record<string, string> = {
  preferred_language: "Agents write every email / Telegram / WhatsApp message to this customer in this language.",
  communication_style: "The tone agents use with this customer.",
  urgency_preference: "When this customer messages you, a “Reply to …” follow-up is due within this time.",
  custom_instructions: "Rules agents must follow when writing to this customer.",
  agent_notes: "What agents learned about this customer. Agents add to it; you can edit it.",
};

export function CustomerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customer", id], queryFn: () => get(`/memory/${id}/`) });
  const hist = useQuery({ queryKey: ["customer", id, "interactions"], queryFn: () => get(`/memory/${id}/interactions/`) });
  const [form, setForm] = useState<any>(null);
  const save = useMutation({
    mutationFn: () => patch(`/memory/${id}/`, form),
    onSuccess: () => { toast.ok("Saved"); setForm(null); qc.invalidateQueries({ queryKey: ["customer", id] }); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const remove = useMutation({ mutationFn: () => del(`/memory/${id}/`), onSuccess: () => { toast.ok("Customer deleted"); qc.invalidateQueries({ queryKey: ["customers"] }); history.back(); }, onError: (e) => toast.err(errMsg(e)) });
  const me = useMe(); // deleting a customer: Admin or Manager only
  if (q.isLoading) return <Loading />;
  const saved = q.data ?? {}; // header & channels show the saved customer, not what's being typed
  const c = { ...saved, ...(form ?? {}) };
  const emailChanged = form?.email !== undefined && form.email.trim().toLowerCase() !== (saved.email ?? "").toLowerCase();
  const emailOk = !emailChanged || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const topics = asList(c.common_topics);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Customers</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={saved.name || saved.email} className="size-12 text-base" />
        <div className="flex-1"><h1 className="text-xl font-semibold">{saved.name || saved.email}</h1><p className="text-sm text-muted">{saved.email}{saved.company && ` · ${saved.company}`}</p></div>
        {me.canManage && <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => { if (confirm(`Delete ${saved.name || saved.email} and their history?`)) remove.mutate(); }}>Delete</Button>}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 p-5 lg:col-span-2">
          {FIELDS.map(([k, label, type]) => (
            <Field key={k} label={label} hint={HINTS[k]}>
              {type === "textarea"
                ? <Textarea rows={3} value={c[k] ?? ""} onChange={(e) => setForm({ ...(form ?? {}), [k]: e.target.value })} />
                : type === "select"
                ? <Select className="w-full" aria-label={label} value={c[k] ?? ""} onChange={(e) => setForm({ ...(form ?? {}), [k]: e.target.value })}>
                    {c[k] && !CHOICES[k].some(([v]) => v === c[k]) && <option value={c[k]}>{c[k]}</option>}
                    {CHOICES[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                : <Input type={type === "email" ? "email" : "text"} value={c[k] ?? ""} onChange={(e) => setForm({ ...(form ?? {}), [k]: e.target.value })} />}
              {k === "email" && emailChanged && (
                <p className={`mt-1 text-xs ${emailOk ? "text-muted" : "text-err"}`}>
                  {emailOk ? "Agents will use this address from now on. Past history stays with this customer." : "Enter a valid email address."}
                </p>
              )}
            </Field>
          ))}
          <Button variant="primary" disabled={!form || !emailOk || (emailChanged && !form.email.trim())} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </Card>
        <div className="space-y-6 lg:col-span-3">
          {saved.email && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-medium">Channels</p>
              <CustomerChannels email={saved.email} whatsapp={"whatsapp_number" in saved ? saved.whatsapp_number : undefined} />
            </Card>
          )}
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
              {asList(hist.data).map((i: any) => <InteractionRow key={i.id} i={i} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
