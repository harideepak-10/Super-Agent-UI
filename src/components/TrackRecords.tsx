import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Boxes, Briefcase, Check, Database, Download, FileSpreadsheet, FolderKanban, Package, Receipt, RefreshCw, ShoppingCart, UploadCloud, Users, Wallet, X } from "lucide-react";
import { ACCEPT, FORMATS_LABEL, prepareFile, toWorkbook, type Prepared } from "@/lib/fileToTables";
import { useBusinessFinalize } from "@/lib/businessFlow";
import { api, get } from "@/api/client";
import { asList, cn, errMsg } from "@/lib/utils";
import { Button, Card, Toggle } from "./ui";
import { toast } from "./toast";

export const ENTITY_ICON: Record<string, any> = {
  customers: Users, sales: BarChart3, orders: ShoppingCart, products: Package, inventory: Boxes,
  employees: Briefcase, projects: FolderKanban, invoices: Receipt, expenses: Wallet,
};

// Used until /business/catalog/ loads (and as friendly descriptions)
const FALLBACK = [
  { key: "customers", label: "Customers", blurb: "Who buys from you", fields: ["name", "email", "phone", "company", "city"] },
  { key: "sales", label: "Sales", blurb: "What you sold and for how much", fields: ["date", "product", "customer", "quantity", "amount"] },
  { key: "orders", label: "Orders", blurb: "Orders and their status", fields: ["order_id", "date", "customer", "amount", "status"] },
  { key: "products", label: "Products", blurb: "Your catalogue and prices", fields: ["name", "sku", "category", "price"] },
  { key: "inventory", label: "Inventory", blurb: "Stock on hand", fields: ["item", "quantity", "reorder_level", "location"] },
  { key: "invoices", label: "Invoices", blurb: "Bills you sent and payments", fields: ["invoice_no", "date", "customer", "amount", "status"] },
  { key: "expenses", label: "Expenses", blurb: "Where money goes", fields: ["date", "category", "vendor", "amount"] },
  { key: "employees", label: "Employees", blurb: "Your team", fields: ["name", "email", "role", "joining_date", "salary"] },
  { key: "projects", label: "Projects", blurb: "Work and deadlines", fields: ["name", "owner", "due_date", "budget", "status"] },
];
const BLURB = Object.fromEntries(FALLBACK.map((f) => [f.key, f.blurb]));

export function useRecordTypes() {
  const catalog = useQuery({ queryKey: ["business", "catalog"], queryFn: () => get("/business/catalog/"), staleTime: 5 * 60_000, retry: false });
  const ents = asList(catalog.data?.entities);
  const types = ents.length ? ents.map((e: any) => ({ key: e.key, label: e.label, blurb: BLURB[e.key] ?? "", fields: asList<string>(e.fields) })) : FALLBACK;
  return { types, limits: catalog.data?.limits };
}

/** Download an empty CSV with the columns we recognise for that record type. */
function downloadTemplate(key: string, fields: string[]) {
  const blob = new Blob([fields.join(",") + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${key}-template.csv`; a.click();
  URL.revokeObjectURL(url);
}

/** "Which records do you want to track?" — multi-select cards. */
export function RecordTypePicker({ value, onChange, dense }: { value: string[]; onChange: (v: string[]) => void; dense?: boolean }) {
  const { types } = useRecordTypes();
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className={cn("grid gap-2.5", dense ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {types.map((t) => {
        const on = value.includes(t.key);
        const Icon = ENTITY_ICON[t.key] ?? Database;
        return (
          <div key={t.key} role="checkbox" aria-checked={on} tabIndex={0}
            onClick={() => toggle(t.key)} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), toggle(t.key))}
            className={cn("group relative flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-3.5 text-left shadow-card transition outline-none focus-visible:ring-4 focus-visible:ring-accent/20",
              on ? "border-accent ring-4 ring-accent/10" : "border-border hover:border-accent/40")}>
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-brand text-white" : "bg-accent/10 text-accent")}><Icon className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.label}</p>
              {t.blurb && !dense && <p className="text-xs text-muted">{t.blurb}</p>}
              {on && (
                <button onClick={(e) => { e.stopPropagation(); downloadTemplate(t.key, t.fields); }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer">
                  <Download className="size-3" /> CSV template
                </button>
              )}
            </div>
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-accent bg-accent text-white" : "border-border")}>{on && <Check className="size-3" />}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Drag-and-drop upload of ANY business file (Excel, CSV, PDF, Word, JSON…) → preview → /business/uploads/. */
export function RecordUploader({ selected = [], compact, onUploaded, workbookName }: { selected?: string[]; compact?: boolean; onUploaded?: (res: any) => void | Promise<void>; workbookName?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { types, limits } = useRecordTypes();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [reading, setReading] = useState(false);
  const [prepared, setPrepared] = useState<Prepared[]>([]);
  const [finishing, setFinishing] = useState(false);
  const { finalize } = useBusinessFinalize();
  const picked = types.filter((t) => selected.includes(t.key));
  const tables = prepared.flatMap((p) => p.tables);

  const addFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setReading(true);
    try {
      const out = await Promise.all(list.map((f) => prepareFile(f)));
      setPrepared((prev) => [...prev.filter((p) => !out.some((o) => o.file.name === p.file.name)), ...out]);
    } finally { setReading(false); }
  };

  const upload = useMutation({
    mutationFn: async () => {
      const ok = prepared.filter((p) => p.tables.length);
      // a single CSV/XLSX goes up untouched; everything else is bundled into one workbook
      const file = ok.length === 1 && ok[0].native ? ok[0].file : await toWorkbook(ok.flatMap((p) => p.tables), workbookName || (ok.length === 1 ? ok[0].file.name.replace(/\.[^.]+$/, "") : "Business records"));
      if (limits?.max_file_mb && file.size > limits.max_file_mb * 1024 * 1024) throw new Error(`That's over ${limits.max_file_mb} MB — split it into smaller files.`);
      const fd = new FormData(); fd.append("file", file); fd.append("use_ai", String(useAi));
      return (await api.post("/business/uploads/", fd)).data;
    },
    onSuccess: async (d: any) => {
      setPrepared([]);
      setFinishing(true);
      try {
        if (onUploaded) await onUploaded(d);
        else { await finalize(d); nav("/business"); }
      } finally { setFinishing(false); qc.invalidateQueries({ queryKey: ["business"] }); }
    },
    onError: (e) => toast.err(errMsg(e)),
  });

  return (
    <div className="space-y-4">
      <Card
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={cn("border-2 border-dashed text-center transition-colors", compact ? "p-6" : "p-8 sm:p-10", drag ? "border-accent bg-accent/5" : "border-border")}
      >
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">{reading || finishing ? <RefreshCw className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}</div>
        <p className="mt-4 font-semibold">{finishing ? "Importing your records…" : reading ? "Reading your files…" : "Drop your records here — any format"}</p>
        <p className="mt-1 text-sm text-muted">{FORMATS_LABEL} · several files at once is fine{limits?.max_file_mb ? ` · up to ${limits.max_file_mb} MB` : ""}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {[["XLSX", "text-emerald-600 bg-emerald-500/10"], ["CSV", "text-emerald-600 bg-emerald-500/10"], ["PDF", "text-rose-600 bg-rose-500/10"], ["DOCX", "text-sky-600 bg-sky-500/10"], ["XLS / ODS", "text-emerald-600 bg-emerald-500/10"], ["JSON", "text-amber-600 bg-amber-500/10"]].map(([l, c]) => (
            <span key={l} className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide", c)}>{l}</span>
          ))}
        </div>
        {picked.length > 0 && !prepared.length && (
          <div className="mx-auto mt-4 max-w-lg space-y-1 text-left text-xs text-muted">
            {picked.map((t) => <p key={t.key}><span className="font-semibold text-fg">{t.label}:</span> columns like {t.fields.slice(0, 5).join(", ")}</p>)}
          </div>
        )}
        <Button variant={prepared.length ? "secondary" : "primary"} className="mt-5" loading={reading} onClick={() => input.current?.click()}><FileSpreadsheet className="size-4" /> {prepared.length ? "Add more files" : "Choose files"}</Button>
      </Card>

      {prepared.length > 0 && (
        <Card className="divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">What we found <span className="font-normal text-muted">· {tables.length} table{tables.length === 1 ? "" : "s"} in {prepared.length} file{prepared.length === 1 ? "" : "s"}</span></p>
            <button onClick={() => setPrepared([])} className="text-xs text-muted hover:text-err cursor-pointer">Clear</button>
          </div>
          {prepared.map((p) => (
            <div key={p.file.name} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <FileIcon name={p.file.name} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.file.name}</p>
                <button onClick={() => setPrepared((x) => x.filter((y) => y !== p))} className="text-muted hover:text-err cursor-pointer" aria-label="Remove"><X className="size-4" /></button>
              </div>
              {p.error ? <p className="mt-1.5 flex items-start gap-1.5 text-xs text-err"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{p.error}</p> : (
                <div className="mt-2 space-y-2">
                  {p.note && <p className="text-[11px] text-warn">{p.note}</p>}
                  {p.tables.map((t, i) => (
                    <details key={i} className="group rounded-xl border border-border bg-surface-2/50">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
                        <Check className="size-3.5 text-ok" />
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-muted">{t.rows.length - 1} rows · {t.rows[0].length} columns</span>
                        <span className="ml-auto truncate text-muted">{t.rows[0].slice(0, 4).join(" · ")}{t.rows[0].length > 4 ? " …" : ""}</span>
                      </summary>
                      <div className="overflow-x-auto border-t border-border">
                        <table className="w-full text-[11px]">
                          <tbody>{t.rows.slice(0, 5).map((r, j) => <tr key={j} className={j === 0 ? "font-semibold" : "text-muted"}>{r.map((c, k) => <td key={k} className="max-w-40 truncate border-b border-border px-2 py-1">{c}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <label className="flex items-center gap-2 text-xs text-muted"><Toggle checked={useAi} onChange={setUseAi} /> Use AI to detect record types <span className="hidden sm:inline">· only column names, types and 3 masked sample rows are sent</span></label>
            <Button variant="primary" className="ml-auto" disabled={!tables.length} loading={upload.isPending} onClick={() => upload.mutate()}>
              <UploadCloud className="size-4" /> Upload & import {tables.length} table{tables.length === 1 ? "" : "s"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const e = (name.split(".").pop() || "").toLowerCase();
  const [c, l] = e === "pdf" ? ["bg-rose-500/10 text-rose-600", "PDF"] : e === "docx" ? ["bg-sky-500/10 text-sky-600", "DOC"] : e === "json" ? ["bg-amber-500/10 text-amber-600", "JSON"] : ["bg-emerald-500/10 text-emerald-600", e.toUpperCase().slice(0, 4) || "FILE"];
  return <span className={cn("grid h-7 w-10 shrink-0 place-items-center rounded-md text-[9px] font-bold", c)}>{l}</span>;
}

/* ── "Do you have business records?" prompt state (per user, per browser) ── */
const key = (uid?: string) => `superagent-biz-prompt:${uid ?? "anon"}`;
export const bizPrompt = {
  get: (uid?: string) => { try { return localStorage.getItem(key(uid)); } catch { return "skipped"; } },
  set: (uid: string | undefined, v: "skipped" | "done" | "dismissed") => { try { localStorage.setItem(key(uid), v); } catch { /* ignore */ } },
};
