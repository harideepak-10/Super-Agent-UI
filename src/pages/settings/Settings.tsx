import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Mail, HardDrive, Calendar, Slack, Send, MessageCircle, Github, NotebookPen, Plug, UserPlus, Trash2 } from "lucide-react";
import { api, del, get, patch, post } from "@/api/client";
import { asList, cn, errMsg, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Table, Td, Toggle } from "@/components/ui";
import { Avatar } from "@/components/Layout";
import { toast } from "@/components/toast";

export function SettingsLayout() {
  const tabs = [
    { to: "/settings", label: "Profile", end: true },
    { to: "/settings/integrations", label: "Integrations" },
    { to: "/settings/team", label: "Team" },
    { to: "/settings/notifications", label: "Notifications" },
  ];
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}>{t.label}</NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

/* ─────────────── Profile ─────────────── */
export function ProfileSettings() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const q = useQuery({ queryKey: ["profile"], queryFn: () => get("/profile/") });
  const [name, setName] = useState<string | null>(null);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const p = q.data?.user ?? q.data ?? {};

  const save = useMutation({
    mutationFn: async (file?: File) => {
      if (file) { const fd = new FormData(); fd.append("avatar", file); if (name) fd.append("name", name); return (await api.patch("/profile/update/", fd)).data; }
      return patch("/profile/update/", { name });
    },
    onSuccess: (d: any) => { toast.ok("Profile updated"); setName(null); qc.invalidateQueries({ queryKey: ["profile"] }); const u = d?.user ?? d; if (u?.email) setUser(u); },
    onError: (e) => toast.err(errMsg(e)),
  });
  const changePw = useMutation({ mutationFn: () => post("/profile/change-password/", pw), onSuccess: () => { toast.ok("Password changed"); setPw({ current_password: "", new_password: "" }); }, onError: (e) => toast.err(errMsg(e)) });

  if (q.isLoading) return <Loading />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <p className="text-sm font-medium">Profile</p>
        <div className="flex items-center gap-4">
          <Avatar name={p.name || p.email} src={p.avatar_url} className="size-14 text-base" />
          <label className="cursor-pointer text-sm text-accent hover:underline">
            Change photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && save.mutate(e.target.files[0])} />
          </label>
        </div>
        <Field label="Name"><Input value={name ?? p.name ?? ""} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input value={p.email ?? ""} disabled /></Field>
        <Button variant="primary" disabled={name == null} loading={save.isPending} onClick={() => save.mutate(undefined)}>Save</Button>
      </Card>
      <Card className="space-y-4 p-5">
        <p className="text-sm font-medium">Change password</p>
        <Field label="Current password"><Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
        <Field label="New password"><Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
        <Button disabled={!pw.current_password || pw.new_password.length < 8} loading={changePw.isPending} onClick={() => changePw.mutate()}>Update password</Button>
      </Card>
    </div>
  );
}

/* ─────────────── Integrations & channels ─────────────── */
const PROVIDERS: Record<string, { icon: any; desc: string; auth?: string; color: string }> = {
  gmail: { icon: Mail, desc: "Read and send email with the Email Agent", auth: "/integrations/gmail/auth-url/", color: "text-red-400 bg-red-400/10" },
  google_drive: { icon: HardDrive, desc: "Find, read and create documents", auth: "/integrations/drive/auth-url/", color: "text-emerald-400 bg-emerald-400/10" },
  google_calendar: { icon: Calendar, desc: "Schedule meetings and find free slots", auth: "/integrations/calendar/auth-url/", color: "text-sky-400 bg-sky-400/10" },
  slack: { icon: Slack, desc: "Post updates to channels", color: "text-fuchsia-400 bg-fuchsia-400/10" },
  notion: { icon: NotebookPen, desc: "Read and write Notion pages", color: "text-zinc-300 bg-zinc-400/10" },
  github: { icon: Github, desc: "Issues and pull requests", color: "text-zinc-300 bg-zinc-400/10" },
  telegram: { icon: Send, desc: "Message customers on Telegram", color: "text-sky-400 bg-sky-400/10" },
  whatsapp: { icon: MessageCircle, desc: "Message customers on WhatsApp", color: "text-green-400 bg-green-400/10" },
};

export function IntegrationSettings() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["integrations"], queryFn: () => get("/integrations/") });
  const avail = useQuery({ queryKey: ["integrations", "available"], queryFn: () => get("/integrations/available/") });
  const [channel, setChannel] = useState<"telegram" | "whatsapp" | null>(null);

  // after the OAuth popup closes the user returns to this tab → refresh
  useEffect(() => {
    const h = () => qc.invalidateQueries({ queryKey: ["integrations"] });
    window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, [qc]);

  const connect = useMutation({
    mutationFn: async (provider: string) => {
      const path = PROVIDERS[provider]?.auth;
      if (!path) throw new Error("Connect this integration from the mobile app for now.");
      const d = await get(path);
      window.open(d.auth_url, "oauth", "width=520,height=680");
    },
    onError: (e) => toast.err(errMsg(e)),
  });
  const disconnect = useMutation({ mutationFn: (id: string) => post(`/integrations/${id}/disconnect/`), onSuccess: () => { toast.ok("Disconnected"); qc.invalidateQueries({ queryKey: ["integrations"] }); }, onError: (e) => toast.err(errMsg(e)) });

  if (mine.isLoading || avail.isLoading) return <Loading />;
  const connected = asList(mine.data);
  const providers = asList(avail.data).length ? asList(avail.data) : Object.keys(PROVIDERS).map((p) => ({ provider: p, label: p }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {providers.map((p: any) => {
          const meta = PROVIDERS[p.provider] ?? { icon: Plug, desc: "", color: "text-accent bg-accent/10" };
          const conn = connected.find((c: any) => c.provider === p.provider && c.status !== "disconnected");
          const isChannel = p.provider === "telegram" || p.provider === "whatsapp";
          return (
            <Card key={p.provider} className="flex items-start gap-4 p-5">
              <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", meta.color)}><meta.icon className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="font-medium">{p.label}</p>{conn && <StatusBadge status={conn.status} />}</div>
                <p className="mt-0.5 text-sm text-muted">{meta.desc}</p>
                {conn?.metadata?.email && <p className="mt-1 text-xs text-muted">{conn.metadata.email}</p>}
                {conn && <p className="mt-1 text-[11px] text-muted">Connected {timeAgo(conn.created_at)}</p>}
                <div className="mt-3">
                  {isChannel ? <Button size="sm" onClick={() => setChannel(p.provider)}>Invite a customer</Button>
                    : conn ? <Button size="sm" variant="danger" loading={disconnect.isPending && disconnect.variables === conn.id} onClick={() => disconnect.mutate(conn.id)}>Disconnect</Button>
                    : <Button size="sm" variant="primary" disabled={!meta.auth} loading={connect.isPending && connect.variables === p.provider} onClick={() => connect.mutate(p.provider)}>{meta.auth ? "Connect" : "Coming soon"}</Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <ChannelConnect channel={channel} onClose={() => setChannel(null)} />
    </div>
  );
}

function ChannelConnect({ channel, onClose }: { channel: "telegram" | "whatsapp" | null; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const gen = useMutation({ mutationFn: () => post("/integrations/channels/connect/", { email, channel }), onSuccess: (d: any) => setLink(d.connect_link ?? d.link ?? d.url), onError: (e) => toast.err(errMsg(e)) });
  useEffect(() => { if (!channel) { setEmail(""); setLink(null); } }, [channel]);
  return (
    <Modal open={!!channel} onClose={onClose} title={`Connect a customer on ${channel === "whatsapp" ? "WhatsApp" : "Telegram"}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Generate a one-time link. When the customer opens it, their {channel} chat is linked to their profile so agents can message them.</p>
        <Field label="Customer email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {link ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2.5"><span className="flex-1 truncate font-mono text-xs">{link}</span>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(link); toast.ok("Copied"); }}><Copy className="size-3.5" /></Button>
              <a href={link} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="size-3.5" /></Button></a>
            </div>
            <p className="text-xs text-muted">Send this link to the customer.</p>
          </div>
        ) : <Button variant="primary" className="w-full" disabled={!email} loading={gen.isPending} onClick={() => gen.mutate()}>Generate link</Button>}
      </div>
    </Modal>
  );
}

/* ─────────────── Team ─────────────── */
const ROLES = [{ v: "owner", l: "Owner" }, { v: "admin", l: "Operator" }, { v: "member", l: "Member" }, { v: "viewer", l: "Viewer" }];

export function TeamSettings() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => get("/team/members/") });
  const invites = useQuery({ queryKey: ["team", "invites"], queryFn: () => get("/team/invites/") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", role: "member" });
  const inv = () => qc.invalidateQueries({ queryKey: ["team"] });
  const invite = useMutation({ mutationFn: () => post("/team/invite/", form), onSuccess: () => { toast.ok("Invite sent"); setOpen(false); setForm({ email: "", role: "member" }); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const role = useMutation({ mutationFn: ({ id, role }: { id: string; role: string }) => post(`/team/members/${id}/role/`, { role }), onSuccess: () => { toast.ok("Role updated"); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/team/members/${id}/remove/`), onSuccess: () => { toast.ok("Member removed"); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const respond = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => post(`/team/invites/${id}/${accept ? "accept" : "reject"}/`), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });
  const pending = asList(invites.data).filter((i: any) => i.status === "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-accent/40 p-5">
          <p className="mb-3 text-sm font-medium">Invitations for you</p>
          {pending.map((i: any) => (
            <div key={i.id} className="flex items-center gap-3 py-2">
              <p className="flex-1 text-sm">{i.invited_by_email} invited you as <Badge tone="accent">{i.role}</Badge></p>
              <Button size="sm" variant="success" onClick={() => respond.mutate({ id: i.id, accept: true })}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: i.id, accept: false })}>Decline</Button>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-medium">Members</p>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}><UserPlus className="size-3.5" /> Invite</Button>
        </div>
        {members.isLoading ? <Loading /> : (
          <Table head={["Member", "Role", "Joined", ""]}>
            {asList(members.data).map((m: any) => (
              <tr key={m.id}>
                <Td><div className="flex items-center gap-3"><Avatar name={m.name || m.email} src={m.avatar_url} /><div><p className="font-medium">{m.name || "—"} {m.email === me?.email && <span className="text-xs text-accent">(you)</span>}</p><p className="text-xs text-muted">{m.email}</p></div></div></Td>
                <Td><Select value={m.role} disabled={m.email === me?.email} onChange={(e) => role.mutate({ id: m.id, role: e.target.value })} className="h-8 text-xs">{ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</Select></Td>
                <Td className="text-muted">{timeAgo(m.joined_at)}</Td>
                <Td className="text-right">{m.email !== me?.email && <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}><Trash2 className="size-4" /></Button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a teammate">
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role"><Select className="w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.filter((r) => r.v !== "owner").map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</Select></Field>
          <Button variant="primary" className="w-full" disabled={!form.email} loading={invite.isPending} onClick={() => invite.mutate()}>Send invite</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────── Notifications ─────────────── */
const NOTIF: [string, string, string][] = [
  ["email_on_task_complete", "Task completed", "Email me when a task finishes"],
  ["email_on_task_failed", "Task failed", "Email me when a task fails"],
  ["email_on_approval_needed", "Approval needed", "Email me when an agent needs my approval"],
  ["email_on_budget_alert", "Budget alerts", "Email me when spend crosses the alert threshold"],
  ["push_enabled", "Push notifications", "Send push notifications to the mobile app"],
];

export function NotificationSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notification-settings"], queryFn: () => get("/notifications/settings/") });
  const save = useMutation({
    mutationFn: (body: any) => patch("/notifications/settings/", body),
    onMutate: (body) => qc.setQueryData(["notification-settings"], (o: any) => ({ ...o, ...body })),
    onError: (e) => { toast.err(errMsg(e)); qc.invalidateQueries({ queryKey: ["notification-settings"] }); },
  });
  if (q.isLoading) return <Loading />;
  return (
    <Card className="divide-y divide-border">
      {NOTIF.map(([k, label, desc]) => (
        <div key={k} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted">{desc}</p></div>
          <Toggle checked={!!q.data?.[k]} onChange={(v) => save.mutate({ [k]: v })} />
        </div>
      ))}
    </Card>
  );
}
