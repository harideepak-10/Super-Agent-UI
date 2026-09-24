import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ListChecks } from "lucide-react";
import { get, post } from "@/api/client";
import { asList, cn, errMsg, timeAgo } from "@/lib/utils";
import { Badge, Button, Card, Empty, Loading, PageHeader, Select, StatusBadge } from "@/components/ui";
import { toast } from "@/components/toast";

const SEV: Record<string, any> = { low: "info", medium: "warn", high: "err", critical: "err" };

export default function QA() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["qa", status], queryFn: () => get("/qa/reports/", status ? { status } : undefined) });
  const resolve = useMutation({ mutationFn: (id: string) => post(`/qa/flags/${id}/resolve/`), onSuccess: () => { toast.ok("Flag resolved"); qc.invalidateQueries({ queryKey: ["qa"] }); }, onError: (e) => toast.err(errMsg(e)) });
  const reports = asList(q.data);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Quality assurance" subtitle="The QA Agent reviews agent output and flags anything that looks wrong."
        actions={<Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All reports</option><option value="flagged">Flagged</option><option value="passed">Passed</option></Select>} />
      <Card className="divide-y divide-border">
        {q.isLoading && <Loading />}
        {!q.isLoading && reports.length === 0 && <Empty icon={<ListChecks className="size-8" />} title="No QA reports" />}
        {reports.map((r: any) => {
          const score = Number(r.confidence_score ?? 0);
          const pct = score <= 1 ? score * 100 : score;
          return (
            <div key={r.id}>
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-2/40 cursor-pointer">
                <ChevronRight className={cn("size-3.5 text-muted transition-transform", open === r.id && "rotate-90")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.subject}</p>
                  <p className="text-xs text-muted">{r.source_agent} · {timeAgo(r.created_at)} · {asList(r.flags).length} flags</p>
                </div>
                <div className="hidden w-28 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full", pct >= 80 ? "bg-ok" : pct >= 50 ? "bg-warn" : "bg-err")} style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-right text-[11px] text-muted">{pct.toFixed(0)}% confidence</p>
                </div>
                <StatusBadge status={r.status} />
              </button>
              {open === r.id && (
                <div className="space-y-3 px-5 pb-4 pl-12">
                  {r.summary && <p className="text-sm text-muted">{r.summary}</p>}
                  {asList(r.flags).map((f: any) => (
                    <div key={f.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><Badge tone={SEV[f.severity] ?? "neutral"}>{f.severity}</Badge><span className="text-sm font-medium">{f.title}</span><span className="font-mono text-[11px] text-muted">{f.flag_type}</span></div>
                        <p className="mt-1 text-sm text-muted">{f.detail}</p>
                      </div>
                      {f.status !== "resolved" ? <Button size="sm" onClick={() => resolve.mutate(f.id)}>Resolve</Button> : <StatusBadge status="resolved" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
