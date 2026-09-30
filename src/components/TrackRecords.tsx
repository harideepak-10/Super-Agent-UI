import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, Briefcase, Check, Database, Download, FileSpreadsheet, FolderKanban, Package, Receipt, RefreshCw, ShoppingCart, UploadCloud, Users, Wallet } from "lucide-react";
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

/** Drag-and-drop CSV/XLSX upload → /business/uploads/ (AI detects the sheets). */
export function RecordUploader({ selected = [], compact, onUploaded }: { selected?: string[]; compact?: boolean; onUploaded?: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { types, limits } = useRecordTypes();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append("file", file); fd.append("use_ai", String(useAi));
      return (await api.post("/business/uploads/", fd)).data;
    },
    onSuccess: (d: any) => {
      const n = asList(d?.upload?.sheets).length;
      toast.ok(`Analyzed ${n} sheet${n === 1 ? "" : "s"} — review what we found`);
      qc.invalidateQueries({ queryKey: ["business"] });
      if (onUploaded) onUploaded(); else nav("/business?tab=data");
    },
    onError: (e) => toast.err(errMsg(e)),
  });
  const pick = (f?: File | null) => f && upload.mutate(f);
  const picked = types.filter((t) => selected.includes(t.key));

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      className={cn("border-2 border-dashed text-center transition-colors", compact ? "p-6" : "p-8 sm:p-10", drag ? "border-accent bg-accent/5" : "border-border")}
    >
      <input ref={input} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">{upload.isPending ? <RefreshCw className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}</div>
      <p className="mt-4 font-semibold">{upload.isPending ? "Analyzing your records…" : "Drop your CSV or Excel file here"}</p>
      <p className="mt-1 text-sm text-muted">{limits ? `.csv or .xlsx · up to ${limits.max_file_mb} MB · up to ${limits.max_sheets} sheets in one Excel file` : ".csv or .xlsx · one Excel file can hold several sheets"}</p>
      {picked.length > 0 && (
        <div className="mx-auto mt-4 max-w-lg space-y-1 text-left text-xs text-muted">
          {picked.map((t) => <p key={t.key}><span className="font-semibold text-fg">{t.label}:</span> columns like {t.fields.slice(0, 5).join(", ")}</p>)}
        </div>
      )}
      <Button variant="primary" className="mt-5" loading={upload.isPending} onClick={() => input.current?.click()}><FileSpreadsheet className="size-4" /> Choose file</Button>
      <div className="mt-5 flex items-center justify-center gap-2.5 text-xs text-muted">
        <Toggle checked={useAi} onChange={setUseAi} />
        <span className="text-left">Use AI to detect your sheets <span className="hidden sm:inline">· only column names, types and 3 masked sample rows are sent</span></span>
      </div>
    </Card>
  );
}

/* ── "Do you have business records?" prompt state (per user, per browser) ── */
const key = (uid?: string) => `superagent-biz-prompt:${uid ?? "anon"}`;
export const bizPrompt = {
  get: (uid?: string) => { try { return localStorage.getItem(key(uid)); } catch { return "skipped"; } },
  set: (uid: string | undefined, v: "skipped" | "done" | "dismissed") => { try { localStorage.setItem(key(uid), v); } catch { /* ignore */ } },
};
