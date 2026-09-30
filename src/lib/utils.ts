import clsx, { type ClassValue } from "clsx";
export const cn = (...c: ClassValue[]) => clsx(c);

/** DRF endpoints may return a plain array or a paginated {results} object. */
export function asList<T = any>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  for (const k of ["items", "data", "tasks", "agents", "templates", "events", "alerts", "flags", "reports", "members", "notifications"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const eur = (n?: number | string | null) =>
  n == null || n === "" ? "—" : `€${Number(n).toFixed(Number(n) < 1 ? 4 : 2)}`;

export const uuid = () =>
  (crypto as any).randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export function errMsg(e: any): string {
  // No response at all = the request never reached Django (server down, wrong URL, CORS, or blocked mixed content)
  if (e?.isAxiosError && !e.response) {
    const base = (import.meta.env.VITE_API_URL as string) || "https://super-agent-platform.onrender.com";
    return `Can't reach the server at ${base}. Check that the backend is running and VITE_API_URL in .env is correct.`;
  }
  const d = e?.response?.data;
  if (!d) return e?.message || "Something went wrong";
  if (typeof d === "string") return d.slice(0, 200);
  if (d.detail) return String(d.detail);
  if (d.error) return String(d.error);
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return "Request failed";
}

export const pretty = (v: unknown) => {
  if (v == null) return "";
  if (typeof v === "string") {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  return JSON.stringify(v, null, 2);
};

/** Format an amount in any ISO currency (backend sends Decimal strings). */
function compactUnits(n: number, currency: string) {
  const a = Math.abs(n);
  const units: [number, string][] = currency === "INR" ? [[1e7, "Cr"], [1e5, "L"], [1e3, "K"]] : [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [d, u] of units) if (a >= d) return `${+(n / d).toFixed(a / d >= 100 ? 0 : 1)}${u}`;
  return String(Math.round(n));
}
export function money(v: number | string | null | undefined, currency = "INR", compact = false) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (compact && Math.abs(n) >= 1000) {
    const sym = new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency + " ";
    return `${sym}${compactUnits(n, currency)}`;
  }
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, { style: "currency", currency, maximumFractionDigits: compact || Math.abs(n) >= 1000 ? 0 : 2, notation: compact ? "compact" : "standard" }).format(n);
  } catch { return `${currency} ${n.toLocaleString()}`; }
}
export const num = (v: any, compact = false) => (v == null || v === "" ? "—" : new Intl.NumberFormat(undefined, { notation: compact ? "compact" : "standard", maximumFractionDigits: 2 }).format(Number(v)));
