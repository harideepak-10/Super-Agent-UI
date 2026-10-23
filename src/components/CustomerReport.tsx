import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Download, FileBarChart, Paperclip } from "lucide-react";
import { api, get } from "@/api/client";
import { asList, cn, errMsg, money } from "@/lib/utils";
import { Badge, Button, Card, Field, Input, Modal, Select, Toggle } from "./ui";
import { toast } from "./toast";

/**
 * Customer report — one customer (sales, deals, history, files exchanged) or all customers.
 *   GET  /crm/report/?customer=&period=&date_from=&date_to=&include_files=   → data
 *   POST /crm/report/pdf/ {same}                                            → PDF download
 */
const PERIODS: [string, string][] = [
  ["all_time", "All time"], ["last_30_days", "Last 30 days"], ["this_month", "This month"], ["last_month", "Last month"],
  ["last_3_months", "Last 3 months"], ["last_6_months", "Last 6 months"], ["this_year", "This year"], ["last_year", "Last year"], ["custom", "Custom dates"],
];

export function CustomerReport({ open, onClose, customer, name }: { open: boolean; onClose: () => void; customer?: string | null; name?: string }) {
  const [period, setPeriod] = useState("last_30_days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [files, setFiles] = useState(true);
  const args = () => ({
    ...(customer ? { customer, include_files: files } : {}), period,
    ...(period === "custom" ? { date_from: from, date_to: to } : {}),
  });
  const view = useMutation({ mutationFn: () => get("/crm/report/", args()), onError: (e) => toast.err(errMsg(e)) });
  const pdf = useMutation({
    mutationFn: async () => {
      const res = await api.post("/crm/report/pdf/", args(), { responseType: "blob" });
      const cd = String(res.headers["content-disposition"] ?? "");
      const fname = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? cd.match(/filename="?([^";]+)/)?.[1] ?? `${(name || customer || "all-customers").replace(/[^\w.-]+/g, "_")}_report_${period}.pdf`);
      // (the real filename needs CORS_EXPOSE_HEADERS = ["Content-Disposition"] on the backend; otherwise this fallback is used)
      const href = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = href; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    },
    // errors come back as a JSON blob — read it so the message is useful
    onError: async (e: any) => {
      const blob = e?.response?.data;
      if (blob instanceof Blob) { try { const j = JSON.parse(await blob.text()); return toast.err(j.detail ?? "Couldn't build the PDF"); } catch { /* fall through */ } }
      toast.err(errMsg(e));
    },
  });
  const customOk = period !== "custom" || (from && to && from <= to);
  const d: any = view.data;

  return (
    <Modal open={open} onClose={onClose} title={customer ? `Customer report — ${name || customer}` : "Report — all customers"} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48"><Field label="Period"><Select value={period} onChange={(e) => { setPeriod(e.target.value); view.reset(); }}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field></div>
          {period === "custom" && <>
            <div className="w-40"><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></div>
            <div className="w-40"><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
          </>}
          {customer && (
            <label className="flex h-10 items-center gap-2 text-sm" title="Look through Gmail for attachments sent to / received from this customer">
              <Toggle aria-label="Include files exchanged" checked={files} onChange={setFiles} /> <Paperclip className="size-3.5 text-muted" /> Files exchanged
            </label>
          )}
          <div className="ml-auto flex gap-2">
            <Button loading={view.isPending} disabled={!customOk} onClick={() => view.mutate()}><FileBarChart className="size-4" /> Show report</Button>
            <Button variant="primary" loading={pdf.isPending} disabled={!customOk} onClick={() => pdf.mutate()}><Download className="size-4" /> PDF</Button>
          </div>
        </div>

        {!d && !view.isPending && <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{customer ? "Sales, deals, follow-ups, messages and files for this customer" : "Totals, top customers, customers at risk, unpaid invoices and hot leads"} — pick a period and press Show report.</p>}

        {d && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={d.insights?.health === "Good" ? "ok" : d.insights?.health ? "warn" : "neutral"}>{d.insights?.health ?? "—"}</Badge>
              <span className="text-sm text-muted">{d.period}</span>
              {d.lead_score && <span className="text-sm text-muted">· lead score {d.lead_score.score} ({d.lead_score.label})</span>}
            </div>
            {d.kind === "portfolio" ? <Portfolio d={d} /> : <OneCustomer d={d} />}
            {(asList(d.insights?.risks).length > 0 || asList(d.insights?.next_steps).length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {asList(d.insights?.risks).length > 0 && (
                  <Card className="p-4"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="size-4 text-warn" /> Risks</p>
                    <ul className="space-y-1 text-sm text-muted">{asList(d.insights.risks).map((r: string) => <li key={r}>• {r}</li>)}</ul></Card>
                )}
                {asList(d.insights?.next_steps).length > 0 && (
                  <Card className="p-4"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ArrowRight className="size-4 text-accent" /> Next steps</p>
                    <ul className="space-y-1 text-sm text-muted">{asList(d.insights.next_steps).map((r: string) => <li key={r}>• {r}</li>)}</ul></Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <Card className="p-3"><p className="text-[11px] text-muted">{label}</p><p className={cn("mt-1 text-lg font-semibold", tone)}>{value}</p></Card>
);

function OneCustomer({ d }: { d: any }) {
  const s = d.sales ?? {}, cur = s.currency;
  const files = asList(d.files?.gmail?.files);
  const openDeals = asList(d.deals).filter((x: any) => ["new", "contacted", "qualified", "proposal"].includes(x.stage));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sales" value={money(s.total_value ?? 0, cur)} />
        <Stat label="Unpaid" value={money(s.unpaid_total ?? 0, cur)} tone={s.unpaid_total ? "text-err" : undefined} />
        <Stat label="Open deals" value={openDeals.length} />
        <Stat label="Files exchanged" value={d.files?.gmail?.available === false && !files.length ? "—" : files.length} />
      </div>
      {asList(s.top_products).length > 0 && (
        <Card className="p-4"><p className="mb-2 text-sm font-semibold">Top products</p>
          {asList(s.top_products).map((p: any) => <div key={p.product} className="flex justify-between py-0.5 text-sm"><span>{p.product}</span><span className="text-muted">{money(p.amount, cur)}</span></div>)}</Card>
      )}
      {asList(d.timeline?.events).length > 0 && (
        <Card className="p-4"><p className="mb-2 text-sm font-semibold">Recent activity</p>
          <div className="max-h-52 space-y-1.5 overflow-y-auto">{asList(d.timeline.events).slice(0, 15).map((e: any, i: number) => (
            <div key={i} className="flex gap-3 text-sm"><span className="w-28 shrink-0 text-xs text-muted">{e.at}</span><span className="min-w-0"><span className="font-medium">{e.label}</span> <span className="text-muted">{e.summary}</span></span></div>
          ))}</div></Card>
      )}
    </div>
  );
}

function Portfolio({ d }: { d: any }) {
  const t = d.totals ?? {}, cur = d.currency;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Customers" value={t.customers ?? 0} />
        <Stat label="Active / new" value={`${t.active_customers ?? 0} / ${t.new_customers ?? 0}`} />
        <Stat label="Sales" value={money(t.sales_total ?? 0, cur)} />
        <Stat label="Outstanding" value={money(t.outstanding_total ?? 0, cur)} tone={t.outstanding_total ? "text-err" : undefined} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <List title={asList(d.top_customers)[0]?.source === "won deals" ? "Top customers (deals won)" : "Top customers"} rows={asList(d.top_customers).map((c: any) => [c.customer, money(c.amount, cur)])} />
        <List title="At risk" rows={asList(d.at_risk).map((c: any) => [c.customer, asList(c.reasons).slice(0, 2).join(", ")])} />
        <List title="Unpaid invoices" rows={asList(d.overdue_payments).map((c: any) => [c.customer, money(c.amount, cur)])} />
        <List title="Hot leads" rows={asList(d.hot_leads).map((c: any) => [c.customer, `score ${c.score}`])} />
      </div>
    </div>
  );
}

const List = ({ title, rows }: { title: string; rows: [string, string][] }) => (
  <Card className="p-4"><p className="mb-2 text-sm font-semibold">{title}</p>
    {!rows.length ? <p className="text-sm text-muted">None.</p> : rows.slice(0, 6).map(([a, b], i) => <div key={i} className="flex justify-between gap-3 py-0.5 text-sm"><span className="truncate">{a}</span><span className="shrink-0 text-muted">{b}</span></div>)}</Card>
);
