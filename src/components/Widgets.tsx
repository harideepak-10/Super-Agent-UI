import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, money, num } from "@/lib/utils";
import { Card } from "./ui";

/** Renders the Business dashboard widgets returned by /business/dashboard/<page>/. */
export type Widget =
  | { id: string; type: "kpi"; title: string; value: any; format: string; change_percent?: number | null }
  | { id: string; type: "line"; title: string; format: string; x: string[]; series: { name: string; values: number[] }[] }
  | { id: string; type: "bar"; title: string; format: string; items: { label: string; value: number }[] }
  | { id: string; type: "pie"; title: string; items: { label: string; value: number }[] }
  | { id: string; type: "table"; title: string; columns: string[]; rows: any[][] };

const PALETTE = ["#1a6fff", "#10b981", "#f97316", "#8b5cf6", "#0ea5e9", "#f59e0b", "#ec4899", "#14b8a6"];
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, boxShadow: "var(--shadow)" };

export function fmtValue(v: any, format: string, currency: string, compact = false) {
  if (v == null || v === "") return "—";
  switch (format) {
    case "currency": return money(v, currency, compact);
    case "percent": return `${num(v)}%`;
    case "date": return new Date(v).toLocaleDateString();
    case "number": return num(v, compact);
    default: return String(v);
  }
}

export function KpiCard({ w, currency }: { w: Extract<Widget, { type: "kpi" }>; currency: string }) {
  const c = w.change_percent;
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{w.title}</p>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight" title={fmtValue(w.value, w.format, currency)}>
        {fmtValue(w.value, w.format, currency, (w.format === "currency" || w.format === "number") && Math.abs(Number(w.value)) >= 100000)}
      </p>
      {c != null && (
        <p className={cn("mt-1 flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap", c >= 0 ? "text-ok" : "text-err")}>
          {c >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(c)}% <span className="ml-0.5 font-normal text-muted">vs prev.</span>
        </p>
      )}
    </Card>
  );
}

export function WidgetCard({ w, currency }: { w: Widget; currency: string }) {
  if (w.type === "kpi") return <KpiCard w={w} currency={currency} />;
  const wide = w.type === "line" || w.type === "table";
  return (
    <Card className={cn("flex flex-col p-5", wide && "lg:col-span-2")}>
      <p className="mb-4 text-sm font-semibold">{w.title}</p>
      {w.type === "line" && <LineW w={w} currency={currency} />}
      {w.type === "bar" && <BarW w={w} currency={currency} />}
      {w.type === "pie" && <PieW w={w} />}
      {w.type === "table" && <TableW w={w} />}
    </Card>
  );
}

function LineW({ w, currency }: { w: Extract<Widget, { type: "line" }>; currency: string }) {
  const data = w.x.map((x, i) => Object.fromEntries([["x", x], ...w.series.map((s) => [s.name, s.values[i] ?? 0])]));
  if (!data.length) return <EmptyW />;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <defs>{w.series.map((s, i) => (
            <linearGradient key={s.name} id={`g-${w.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}</defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={56} tickFormatter={(v) => fmtValue(v, w.format, currency, true)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtValue(v, w.format, currency)} />
          {w.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {w.series.map((s, i) => <Area key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} fill={`url(#g-${w.id}-${i})`} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarW({ w, currency }: { w: Extract<Widget, { type: "bar" }>; currency: string }) {
  if (!w.items.length) return <EmptyW />;
  return (
    <div style={{ height: Math.max(160, w.items.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={w.items} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={120} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle} formatter={(v: any) => fmtValue(v, w.format, currency)} />
          <Bar dataKey="value" fill="#1a6fff" radius={[0, 6, 6, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieW({ w }: { w: Extract<Widget, { type: "pie" }> }) {
  if (!w.items.length) return <EmptyW />;
  const total = w.items.reduce((a, b) => a + Number(b.value), 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={w.items} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {w.items.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {w.items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate capitalize">{it.label || "—"}</span>
            <span className="text-muted">{total ? Math.round((Number(it.value) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableW({ w }: { w: Extract<Widget, { type: "table" }> }) {
  if (!w.rows.length) return <EmptyW />;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted">{w.columns.map((c) => <th key={c} className="px-5 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{w.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-5 py-2.5 whitespace-nowrap">{c === "" || c == null ? "—" : String(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const EmptyW = () => <p className="py-10 text-center text-sm text-muted">No data for this period</p>;
