import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home, MessageSquare, ShieldCheck, Workflow, Bot, LayoutGrid, Users, Wallet, ScrollText, Scale, ListChecks,
  Settings, Search, Bell, Moon, Sun, Menu, LogOut, X, Plug,
} from "lucide-react";
import { get, post } from "@/api/client";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
import { useLiveSocket } from "@/lib/useLiveSocket";
import { asList, cn, timeAgo } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { toast } from "./toast";
import type { Notification } from "@/api/types";

const NAV = [
  { group: "Work", items: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/chat", label: "Chat", icon: MessageSquare },
    { to: "/approvals", label: "Approvals", icon: ShieldCheck, badge: "approvals" },
    { to: "/workflows", label: "Workflows", icon: Workflow },
  ]},
  { group: "Agents", items: [
    { to: "/agents", label: "My Agents", icon: Bot, end: true },
    { to: "/agents/library", label: "Library", icon: LayoutGrid },
  ]},
  { group: "Knowledge", items: [{ to: "/customers", label: "Customers", icon: Users }] },
  { group: "Governance", items: [
    { to: "/costs", label: "Costs", icon: Wallet },
    { to: "/audit", label: "Audit", icon: ScrollText },
    { to: "/compliance", label: "Compliance", icon: Scale },
    { to: "/qa", label: "QA", icon: ListChecks },
  ]},
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pending = useQuery({ queryKey: ["approvals", "pending"], queryFn: () => get("/approvals/pending/"), refetchInterval: 30000 });
  const pendingCount = asList(pending.data).length;
  const { user, clear, refresh } = useAuth();
  const nav = useNavigate();

  const logout = async () => {
    try { await post("/auth/logout/", { refresh }); } catch { /* ignore */ }
    clear();
    nav("/login");
  };

  const link = (active: boolean) =>
    cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
      active ? "bg-surface-2 text-fg font-medium" : "text-muted hover:text-fg hover:bg-surface-2/60");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img src="/logo.svg" className="size-7" alt="" />
        <span className="font-semibold tracking-tight">Super Agent</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-muted/70 uppercase">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={(i as any).end} onClick={onNavigate} className={({ isActive }) => link(isActive)}>
                  <i.icon className="size-4" />
                  <span className="flex-1">{i.label}</span>
                  {(i as any).badge === "approvals" && pendingCount > 0 && (
                    <span className="rounded-full bg-warn px-1.5 text-[10px] font-semibold text-black">{pendingCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border p-3">
        <NavLink to="/settings/integrations" onClick={onNavigate} className={({ isActive }) => link(isActive)}>
          <Plug className="size-4" /> Integrations
        </NavLink>
        <NavLink to="/settings" end onClick={onNavigate} className={({ isActive }) => link(isActive)}>
          <Settings className="size-4" /> Settings
        </NavLink>
        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <Avatar name={user?.name || user?.email} src={user?.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || "You"}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <button onClick={logout} title="Log out" className="text-muted hover:text-fg cursor-pointer"><LogOut className="size-4" /></button>
        </div>
      </div>
    </div>
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
    else if (n.resource_type === "approval" && n.resource_id) nav(`/approvals/${n.resource_id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border bg-surface shadow-2xl">
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

export function Layout() {
  const { theme, toggleTheme, sidebarOpen, setSidebar, setSearch } = useUI();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setSearch]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebar(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="relative h-full w-64 border-r border-border bg-surface" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-4 right-3 text-muted cursor-pointer" onClick={() => setSidebar(false)}><X className="size-4" /></button>
            <Sidebar onNavigate={() => setSidebar(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
          <button className="text-muted lg:hidden cursor-pointer" onClick={() => setSidebar(true)}><Menu className="size-5" /></button>
          <button
            onClick={() => setSearch(true)}
            className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm text-muted hover:border-muted/40 cursor-pointer"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search tasks, agents, customers…</span>
            <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={toggleTheme} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg cursor-pointer" title="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Notifications />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
