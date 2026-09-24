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
    const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
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
