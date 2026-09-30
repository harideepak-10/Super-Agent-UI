import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home, Inbox, ListTodo, MessageSquare, Rocket, Users, Wallet, ScrollText, Scale, ListChecks,
  Settings, Search, Bell, Moon, Sun, Menu, LogOut, X, Plug, Plus, Workflow, BarChart3, Handshake,
} from "lucide-react";
import { get, post } from "@/api/client";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
import { useLiveSocket } from "@/lib/useLiveSocket";
import { useMe } from "@/lib/useMe";
import { bizPrompt } from "./TrackRecords";
import { asList, cn, timeAgo } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { toast } from "./toast";
import type { Notification } from "@/api/types";

type Item = { to: string; label: string; icon: any; end?: boolean; badge?: "approvals" };
const NAV: { group: string; items: Item[] }[] = [
  { group: "", items: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/inbox", label: "Inbox", icon: Inbox, badge: "approvals" },
    { to: "/tasks", label: "Tasks", icon: ListTodo },
    { to: "/chat", label: "Chat", icon: MessageSquare },
    { to: "/agents", label: "Agents", icon: Rocket },
  ]},
  { group: "Business", items: [
    { to: "/business", label: "Business Hub", icon: BarChart3 },
    { to: "/crm", label: "CRM", icon: Handshake },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/workflows", label: "Workflows", icon: Workflow },
  ]},
  { group: "Control", items: [
    { to: "/costs", label: "Costs", icon: Wallet },
    { to: "/audit", label: "Audit log", icon: ScrollText },
    { to: "/compliance", label: "Compliance", icon: Scale },
    { to: "/qa", label: "Quality", icon: ListChecks },
  ]},
];

function usePendingCount() {
  const pending = useQuery({ queryKey: ["approvals", "pending"], queryFn: () => get("/approvals/pending/"), refetchInterval: 30000 });
  return asList(pending.data).length;
}

export function NewTaskButton({ compact, onClick }: { compact?: boolean; onClick?: () => void }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => { onClick?.(); nav("/tasks/new"); }}
      className={cn("bg-brand group flex items-center justify-center gap-2 font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] transition hover:brightness-110 active:scale-[.98] cursor-pointer",
        compact ? "size-14 rounded-full" : "h-11 w-full rounded-xl text-sm")}
      aria-label="New task"
    >
      <Plus className={cn(compact ? "size-6" : "size-4", "transition-transform group-hover:rotate-90")} />
      {!compact && "New Task"}
    </button>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pendingCount = usePendingCount();
  const { user, clear, refresh } = useAuth();
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();

  const logout = async () => {
    try { await post("/auth/logout/", { refresh }); } catch { /* ignore */ }
    clear(); qc.clear();
    nav("/login");
  };

  const link = (active: boolean) =>
    cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
      active ? "bg-accent/10 text-accent font-semibold" : "text-muted hover:text-fg hover:bg-surface-2");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <img src="/logo.svg" className="size-8" alt="" />
        <span className="text-[15px] font-bold tracking-tight">Super<span className="text-accent">Agent</span></span>
      </div>
      <div className="px-4 pb-2"><NewTaskButton onClick={onNavigate} /></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV.map((g) => (
          <div key={g.group || "main"}>
            {g.group && <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.18em] text-muted/70 uppercase">{g.group}</p>}
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={({ isActive }) => link(isActive)}>
                  <i.icon className="size-[18px]" />
                  <span className="flex-1">{i.label}</span>
                  {i.badge === "approvals" && pendingCount > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-err px-1.5 text-[10px] font-bold text-white">{pendingCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border p-3">
        <NavLink to="/settings/integrations" onClick={onNavigate} className={({ isActive }) => link(isActive)}>
          <Plug className="size-[18px]" /> Connected apps
        </NavLink>
        <NavLink to="/settings" end={false} onClick={onNavigate} className={({ isActive }) => link(isActive && !loc.pathname.startsWith("/settings/integrations"))}>
          <Settings className="size-[18px]" /> Settings
        </NavLink>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
          <Avatar name={user?.name || user?.email} src={user?.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name || "You"}</p>
            <p className="truncate text-[11px] text-muted">{me.roleLabel}{me.header?.plan_label ? ` · ${me.header.plan_label}` : ""}</p>
          </div>
          <button onClick={logout} title="Log out" className="text-muted hover:text-err cursor-pointer"><LogOut className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

/* Mobile bottom bar — same tabs as the Flutter app with the docked New Task FAB */
function BottomBar() {
  const pendingCount = usePendingCount();
  const tab = (to: string, label: string, Icon: any, end?: boolean, badge?: number) => (
    <NavLink to={to} end={end} className={({ isActive }) => cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium", isActive ? "text-accent" : "text-muted")}>
      <Icon className="size-5" />
      {label}
      {!!badge && <span className="absolute top-1 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-err px-1 text-[9px] font-bold text-white">{badge}</span>}
    </NavLink>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="relative flex items-end">
        {tab("/", "Home", Home, true)}
        {tab("/inbox", "Inbox", Inbox, false, pendingCount)}
        <div className="flex w-16 justify-center"><div className="-mt-7"><NewTaskButton compact /></div></div>
        {tab("/tasks", "Tasks", ListTodo)}
        {tab("/agents", "Agents", Rocket)}
      </div>
    </nav>
  );
}

export function Avatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  if (src) return <img src={src} className={cn("size-8 rounded-full object-cover", className)} alt="" />;
  const initials = (name || "?").split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return <div className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-semibold text-accent", className)}>{initials}</div>;
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const nav = useNavigate();
  const count = useQuery({ queryKey: ["notifications", "count"], queryFn: () => get("/notifications/count/") });
  const list = useQuery({ queryKey: ["notifications"], queryFn: () => get("/notifications/"), enabled: open });
  const unread = count.data?.unread_count ?? count.data?.count ?? count.data?.unread ?? 0;

  useLiveSocket("/ws/notifications/", (m) => {
    if (m.type === "notification") {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const n = m.notification ?? m.data ?? m;
      if (n?.title) toast.info(n.title);
    }
  });

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAll = async () => {
    await post("/notifications/mark-all-read/");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const go = (n: Notification) => {
    setOpen(false);
    if (n.resource_type === "task" && n.resource_id) nav(`/chat?task=${n.resource_id}`);
    else if (n.resource_type === "approval" && n.resource_id) nav(`/inbox/${n.resource_id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button onClick={markAll} className="text-xs text-accent hover:underline cursor-pointer">Mark all read</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {asList<Notification>(list.data).length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">You're all caught up</p>}
            {asList<Notification>(list.data).map((n) => (
              <button key={n.id} onClick={() => go(n)} className="flex w-full gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-surface-2 cursor-pointer">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-accent")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-xs text-muted">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sends Admins/Managers of a workspace with no business records to the
 * "Do you have any business records?" question once (until they skip or upload).
 */
function useBusinessPrompt() {
  const me = useMe();
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const loc = useLocation();
  const answered = !!bizPrompt.get(user?.id);
  const prof = useQuery({ queryKey: ["business", "profile"], queryFn: () => get("/business/profile/"), enabled: me.isSuccess && me.canManage && !answered, retry: false });
  useEffect(() => {
    if (answered || !me.canManage || !prof.isSuccess || loc.pathname.startsWith("/business")) return;
    if (!prof.data?.id) nav("/setup/business", { replace: true });
    else bizPrompt.set(user?.id, "done");
  }, [answered, me.canManage, prof.isSuccess, prof.data, loc.pathname, nav, user?.id]);
}

export function Layout() {
  const { theme, toggleTheme, sidebarOpen, setSidebar, setSearch } = useUI();
  const loc = useLocation();
  useBusinessPrompt();
  const fullBleed = loc.pathname.startsWith("/chat");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setSearch]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebar(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <aside className="relative h-full w-72 border-r border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-5 right-4 text-muted cursor-pointer" onClick={() => setSidebar(false)}><X className="size-5" /></button>
            <Sidebar onNavigate={() => setSidebar(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6">
          <button className="text-muted lg:hidden cursor-pointer" onClick={() => setSidebar(true)} aria-label="Menu"><Menu className="size-5" /></button>
          <img src="/logo.svg" className="size-7 lg:hidden" alt="" />
          <button
            onClick={() => setSearch(true)}
            className="ml-auto flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-muted transition-colors hover:border-accent/40 sm:ml-0 cursor-pointer"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">Search tasks, agents…</span>
            <kbd className="hidden rounded-md border border-border bg-surface px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1 sm:ml-auto">
            <button onClick={toggleTheme} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg cursor-pointer" title="Toggle theme">
              {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            <Notifications />
          </div>
        </header>
        <main className={cn("min-h-0 flex-1 overflow-y-auto", !fullBleed && "pb-24 lg:pb-0")}>
          <Outlet />
        </main>
      </div>
      {!fullBleed && <BottomBar />}
      <CommandPalette />
    </div>
  );
}
