import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, Bot, User, CornerDownLeft, Plus } from "lucide-react";
import { get } from "@/api/client";
import { useUI } from "@/store/ui";
import { asList, cn } from "@/lib/utils";
import { Spinner } from "./ui";

type Hit = { kind: "task" | "agent" | "customer" | "action"; id: string; title: string; sub?: string; to: string };

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function CommandPalette() {
  const { searchOpen, setSearch } = useUI();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const dq = useDebounced(q);
  const nav = useNavigate();

  const res = useQuery({
    queryKey: ["search", dq],
    queryFn: () => get("/search/", { q: dq }),
    enabled: searchOpen && dq.trim().length > 1,
  });

  const hits: Hit[] = useMemo(() => {
    const actions: Hit[] = [
      { kind: "action", id: "new-chat", title: "New chat", sub: "Start a task with an agent", to: "/chat" },
      { kind: "action", id: "library", title: "Browse agent library", to: "/agents/library" },
      { kind: "action", id: "approvals", title: "Open approvals inbox", to: "/approvals" },
    ];
    if (dq.trim().length < 2) return actions;
    const d = res.data ?? {};
    const tasks = asList(d.tasks ?? d.results?.tasks).map((t: any) => ({ kind: "task" as const, id: t.id, title: t.prompt ?? t.title, sub: t.agent_name ?? t.status, to: `/chat?task=${t.id}` }));
    const agents = asList(d.agents ?? d.results?.agents).map((a: any) => ({ kind: "agent" as const, id: a.id, title: a.name, sub: a.agent_type, to: `/agents/${a.id}` }));
    const customers = asList(d.customers ?? d.customer_profiles ?? d.results?.customers).map((c: any) => ({ kind: "customer" as const, id: c.id, title: c.name || c.email, sub: c.email, to: `/customers/${c.id}` }));
    return [...tasks, ...agents, ...customers];
  }, [res.data, dq]);

  useEffect(() => { setIdx(0); }, [dq]);
  useEffect(() => { if (!searchOpen) setQ(""); }, [searchOpen]);

  if (!searchOpen) return null;
  const pick = (h?: Hit) => { if (!h) return; setSearch(false); nav(h.to); };
  const Icon = { task: MessageSquare, agent: Bot, customer: User, action: Plus };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setSearch(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearch(false);
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") pick(hits[idx]);
            }}
            placeholder="Search tasks, agents, customers…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {res.isFetching && <Spinner className="size-4" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {hits.length === 0 && !res.isFetching && <p className="py-8 text-center text-sm text-muted">No results for “{dq}”</p>}
          {hits.map((h, i) => {
            const I = Icon[h.kind];
            return (
              <button
                key={h.kind + h.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(h)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer", i === idx && "bg-surface-2")}
              >
                <I className="size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{h.title}</p>
                  {h.sub && <p className="truncate text-xs text-muted">{h.sub}</p>}
                </div>
                {i === idx && <CornerDownLeft className="size-3.5 text-muted" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
