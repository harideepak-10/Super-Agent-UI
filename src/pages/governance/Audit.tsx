import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { get } from "@/api/client";
import { asList, cn, fmtDate, pretty } from "@/lib/utils";
import { Badge, Card, Code, Empty, Loading, PageHeader, Select } from "@/components/ui";

export default function Audit() {
  const [eventType, setEventType] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const types = useQuery({ queryKey: ["audit", "types"], queryFn: () => get("/audit/event-types/") });
  const summary = useQuery({ queryKey: ["audit", "summary"], queryFn: () => get("/audit/summary/") });
  const q = useQuery({ queryKey: ["audit", eventType], queryFn: () => get("/audit/", eventType ? { event_type: eventType } : undefined) });
  const typeList: any[] = asList(types.data?.event_types ?? types.data);
  const summ = summary.data ?? {};
  const counters = Object.entries(summ).filter(([, v]) => typeof v === "number").slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Audit log" subtitle="Every action taken in your workspace — by people and agents."
        actions={
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All events</option>
            {typeList.map((t: any) => { const v = typeof t === "string" ? t : t.value ?? t.event_type ?? t.key; return <option key={v} value={v}>{typeof t === "string" ? t : t.label ?? v}</option>; })}
          </Select>
        } />
      {counters.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {counters.map(([k, v]) => <Card key={k} className="p-4"><p className="text-xs text-muted capitalize">{k.replace(/_/g, " ")}</p><p className="mt-2 text-2xl font-semibold">{String(v)}</p></Card>)}
        </div>
      )}
      <Card className="divide-y divide-border">
        {q.isLoading && <Loading />}
        {!q.isLoading && asList(q.data).length === 0 && <Empty title="No events" />}
        {asList(q.data).map((e: any) => (
          <div key={e.id}>
            <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/40 cursor-pointer">
              <ChevronRight className={cn("size-3.5 text-muted transition-transform", open === e.id && "rotate-90")} />
              <Badge tone={e.event_type?.includes("fail") || e.event_type?.includes("reject") ? "err" : e.event_type?.includes("approv") ? "warn" : "neutral"} className="font-mono">{e.event_type}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {e.resource_type && <span className="text-muted">{e.resource_type} </span>}
                {e.resource_type === "task" && e.resource_id ? <Link onClick={(ev) => ev.stopPropagation()} to={`/chat?task=${e.resource_id}`} className="font-mono text-xs hover:text-accent">{e.resource_id.slice(0, 8)}</Link> : <span className="font-mono text-xs">{e.resource_id?.slice?.(0, 8)}</span>}
              </span>
              <span className="hidden text-xs text-muted sm:inline">{e.actor_email ?? "system"}</span>
              <span className="w-36 text-right text-xs text-muted">{fmtDate(e.created_at)}</span>
            </button>
            {open === e.id && <div className="px-5 pb-4 pl-12"><Code>{pretty({ metadata: e.metadata, ip: e.ip_address, user_agent: e.user_agent })}</Code></div>}
          </div>
        ))}
      </Card>
    </div>
  );
}
