import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, HardDrive, Calendar, Slack, Send, MessageCircle, Github, NotebookPen, Plug, UserPlus, Trash2 } from "lucide-react";
import { api, del, get, patch, post } from "@/api/client";
import { asList, cn, errMsg, timeAgo } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useMe } from "@/lib/useMe";
import { Badge, Button, Card, Field, Input, Loading, PasswordInput, Modal, PageHeader, Select, StatusBadge, Table, Td, Toggle } from "@/components/ui";
import { Avatar } from "@/components/Layout";
import { CustomerChannels } from "@/components/CustomerChannels";
import { toast } from "@/components/toast";

export function SettingsLayout() {
  const tabs = [
    { to: "/settings", label: "Profile", end: true },
    { to: "/settings/integrations", label: "Connected apps" },
    { to: "/settings/team", label: "Team" },
    { to: "/settings/notifications", label: "Notifications" },
  ];
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" />
      <div className="mb-6 overflow-x-auto">
        <div className="inline-flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn("rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all", isActive ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}>{t.label}</NavLink>
          ))}
        </div>
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
        <Field label="Current password"><PasswordInput value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
        <Field label="New password"><PasswordInput value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
        <Button disabled={!pw.current_password || pw.new_password.length < 8} loading={changePw.isPending} onClick={() => changePw.mutate()}>Update password</Button>
      </Card>
    </div>
  );
}

/* ─────────────── Integrations & channels ─────────────── */
const LOGOS: Record<string, string> = {
  gmail: "/images/gmail_logo.webp", google_drive: "/images/drive_logo.webp", google_calendar: "/images/google_calendar.webp",
  slack: "/images/slack_logo.webp", notion: "/images/notion_logo.webp", github: "/images/github_logo.webp",
  telegram: "/images/telegram_logo.webp", whatsapp: "/images/whatsapp_logo.webp",
};
const PROVIDERS: Record<string, { icon: any; desc: string; auth?: string; color: string }> = {
  gmail: { icon: Mail, desc: "Read and send email with the Email Agent", auth: "/integrations/gmail/auth-url/", color: "text-red-400 bg-red-400/10" },
  google_drive: { icon: HardDrive, desc: "Find, read and create documents", auth: "/integrations/drive/auth-url/", color: "text-emerald-400 bg-emerald-400/10" },
  google_calendar: { icon: Calendar, desc: "Schedule meetings and find free slots", auth: "/integrations/calendar/auth-url/", color: "text-sky-400 bg-sky-400/10" },
  slack: { icon: Slack, desc: "Post updates to channels", color: "text-fuchsia-400 bg-fuchsia-400/10" },
  notion: { icon: NotebookPen, desc: "Read and write Notion pages", color: "text-zinc-300 bg-zinc-400/10" },
  github: { icon: Github, desc: "Issues and pull requests", color: "text-zinc-300 bg-zinc-400/10" },
  telegram: { icon: Send, desc: "Agents message customers on Telegram. Each customer connects once with an invite link.", color: "text-sky-400 bg-sky-400/10" },
  whatsapp: { icon: MessageCircle, desc: "Agents message customers on WhatsApp. Customers imported with a phone number are linked automatically; others connect with an invite link.", color: "text-green-400 bg-green-400/10" },
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
              {LOGOS[p.provider] ? <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl border border-border p-2", p.provider === "whatsapp" ? "bg-[#25D366]" : p.provider === "telegram" ? "bg-[#229ED9]" : "bg-white")}><img src={LOGOS[p.provider]} alt="" className="max-h-full max-w-full object-contain" /></div> : <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", meta.color)}><meta.icon className="size-5" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="font-medium">{p.label}</p>{conn && <StatusBadge status={conn.status} />}</div>
                <p className="mt-0.5 text-sm text-muted">{meta.desc}</p>
                {conn?.metadata?.email && <p className="mt-1 text-xs text-muted">{conn.metadata.email}</p>}
                {conn && <p className="mt-1 text-[11px] text-muted">Connected {timeAgo(conn.created_at)}</p>}
                <div className="mt-3">
                  {isChannel ? <Button size="sm" onClick={() => setChannel(p.provider)}>Connect a customer</Button>
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
  const [go, setGo] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => get("/memory/"), enabled: !!channel });
  useEffect(() => { if (!channel) { setEmail(""); setGo(null); } }, [channel]);
  return (
    <Modal open={!!channel} onClose={onClose} title={`Connect a customer on ${channel === "whatsapp" ? "WhatsApp" : "Telegram"}`} wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">Each customer connects once. Customers you imported with a phone number are linked to WhatsApp automatically. For anyone else, generate an invite link and send it to them.</p>
        <Field label="Customer email">
          <div className="flex gap-2">
            <Input type="email" list="cc-customers" value={email} onChange={(e) => { setEmail(e.target.value); setGo(null); }} placeholder="customer@email.com" />
            <datalist id="cc-customers">{asList(customers.data).map((c: any) => <option key={c.id} value={c.email}>{c.name}</option>)}</datalist>
            <Button variant="primary" disabled={!email.includes("@")} onClick={() => setGo(email.trim().toLowerCase())}>Check</Button>
          </div>
        </Field>
        {go && <CustomerChannels key={go} email={go} />}
      </div>
    </Modal>
  );
}

/* ─────────────── Team (Admin / Manager / Member) ─────────────── */
const ROLE_TONE: Record<string, any> = { owner: "accent", manager: "info", member: "neutral" };
const ROLE_NAME: Record<string, string> = { owner: "Admin", manager: "Manager", member: "Member" };

export function TeamSettings() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const who = useMe();
  const [tab, setTab] = useState<"members" | "activity">("members");
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => get("/team/members/") });
  const invites = useQuery({ queryKey: ["team", "invites"], queryFn: () => get("/team/invites/") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", role: "member" });
  const inv = () => qc.invalidateQueries({ queryKey: ["team"] });
  const invite = useMutation({ mutationFn: () => post("/team/invite/", form), onSuccess: () => { toast.ok("Invite sent"); setOpen(false); setForm({ email: "", role: "member" }); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: any }) => patch(`/team/members/${id}/role/`, body), onSuccess: () => { toast.ok("Updated"); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/team/members/${id}/remove/`), onSuccess: () => { toast.ok("Member removed"); inv(); }, onError: (e) => toast.err(errMsg(e)) });
  const respond = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => post(`/team/invites/${id}/${accept ? "accept" : "reject"}/`), onSuccess: inv, onError: (e) => toast.err(errMsg(e)) });
  const pending = asList(invites.data).filter((i: any) => i.status === "pending");
  const list = asList(members.data);
  const managers = list.filter((m: any) => m.role === "manager");
  const canInvite = who.canManage;
  const canRemove = (m: any) => m.email !== me?.email && m.role !== "owner" && (who.isAdmin || (who.isManager && m.role === "member" && m.manager_email === me?.email));

  return (
    <div className="space-y-6">
      <Card className="p-4 text-sm text-muted">
        <p><span className="font-semibold text-fg">Admin</span> owns the workspace and assigns Managers or Members. <span className="font-semibold text-fg">Managers</span> invite Members, and see and approve only their Members' tasks. <span className="font-semibold text-fg">Members</span> can't approve their own tasks.</p>
      </Card>
      {pending.length > 0 && (
        <Card className="border-accent/40 p-5">
          <p className="mb-3 text-sm font-medium">Invitations for you</p>
          {pending.map((i: any) => (
            <div key={i.id} className="flex items-center gap-3 py-2">
              <p className="flex-1 text-sm">{i.invited_by_email} invited you as <Badge tone="accent">{ROLE_NAME[i.role] ?? i.role}</Badge></p>
              <Button size="sm" variant="success" onClick={() => respond.mutate({ id: i.id, accept: true })}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: i.id, accept: false })}>Decline</Button>
            </div>
          ))}
        </Card>
      )}
      <div className="flex items-center gap-2">
        {(["members", "activity"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize cursor-pointer", tab === t ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted")}>{t}</button>
        ))}
        {canInvite && <Button size="sm" variant="primary" className="ml-auto" onClick={() => setOpen(true)}><UserPlus className="size-3.5" /> Invite</Button>}
      </div>
      {tab === "members" ? (
        <Card>
          {members.isLoading ? <Loading /> : (
            <Table head={["Member", "Role", "Reports to", "Joined", ""]}>
              {list.map((m: any) => (
                <tr key={m.id}>
                  <Td><div className="flex items-center gap-3"><Avatar name={m.name || m.email} src={m.avatar_url} /><div><p className="font-medium">{m.name || "—"} {m.email === me?.email && <span className="text-xs text-accent">(you)</span>}</p><p className="text-xs text-muted">{m.email}</p></div></div></Td>
                  <Td>
                    {who.isAdmin && m.role !== "owner" ? (
                      <Select value={m.role} onChange={(e) => update.mutate({ id: m.id, body: { role: e.target.value } })} className="h-8 text-xs"><option value="manager">Manager</option><option value="member">Member</option></Select>
                    ) : <Badge tone={ROLE_TONE[m.role]}>{m.role_label ?? ROLE_NAME[m.role] ?? m.role}</Badge>}
                  </Td>
                  <Td>
                    {m.role === "member" && who.isAdmin ? (
                      <Select value={managers.find((x: any) => x.email === m.manager_email)?.user ?? ""} onChange={(e) => update.mutate({ id: m.id, body: { manager_id: e.target.value || null } })} className="h-8 max-w-44 text-xs">
                        <option value="">— No manager —</option>
                        {managers.map((x: any) => <option key={x.id} value={x.user}>{x.name || x.email}</option>)}
                      </Select>
                    ) : <span className="text-xs text-muted">{m.manager_email ?? "—"}</span>}
                  </Td>
                  <Td className="text-muted">{timeAgo(m.joined_at)}</Td>
                  <Td className="text-right">{canRemove(m) && <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}><Trash2 className="size-4" /></Button>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : <TeamActivity />}
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a teammate">
        <div className="space-y-4">
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role" hint={who.isManager ? "Managers can invite Members, who are assigned to you." : undefined}>
            <Select className="w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {who.isAdmin && <option value="manager">Manager</option>}
              <option value="member">Member</option>
            </Select>
          </Field>
          <Button variant="primary" className="w-full" disabled={!form.email} loading={invite.isPending} onClick={() => invite.mutate()}>Send invite</Button>
        </div>
      </Modal>
    </div>
  );
}

function TeamActivity() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["team", "activity", days], queryFn: () => get("/team/activity/", { days }) });
  const d = q.data ?? {};
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted">Last <Select value={days} onChange={(e) => setDays(+e.target.value)} className="h-8 text-xs">{[7, 30, 90, 365].map((n) => <option key={n} value={n}>{n} days</option>)}</Select>{d.scope && <span>· you see {d.scope === "Admin" ? "everyone" : d.scope === "Manager" ? "yourself and your Members" : "only yourself"}</span>}</div>
      {q.isLoading ? <Loading /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {asList(d.members).map((m: any) => {
            const rate = m.total_tasks ? Math.round((m.completed / m.total_tasks) * 100) : 0;
            return (
              <Card key={m.user_id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name || m.email} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name || m.email}</p><p className="text-xs text-muted">{m.role_label}{m.manager_email ? ` · reports to ${m.manager_email}` : ""}</p></div>
                  <div className="text-right"><p className="text-xl font-bold">{m.total_tasks}</p><p className="text-[11px] text-muted">tasks</p></div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-ok" style={{ width: `${rate}%` }} /></div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                  <span className="text-ok">{m.completed} completed</span><span className="text-err">{m.failed} failed</span><span className="text-warn">{m.waiting_approval} waiting</span>
                  {m.most_used_agent && <span className="ml-auto">Most used: <span className="text-fg">{m.most_used_agent}</span></span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
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
