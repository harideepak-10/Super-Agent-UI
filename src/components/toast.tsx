import { create } from "zustand";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type T = { id: number; kind: "ok" | "err" | "info"; text: string };
const useToasts = create<{ items: T[]; push: (k: T["kind"], t: string) => void }>((set) => ({
  items: [],
  push: (kind, text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 4000);
  },
}));

export const toast = {
  ok: (t: string) => useToasts.getState().push("ok", t),
  err: (t: string) => useToasts.getState().push("err", t),
  info: (t: string) => useToasts.getState().push("info", t),
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm shadow-xl">
          {t.kind === "ok" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />}
          {t.kind === "err" && <AlertCircle className="mt-0.5 size-4 shrink-0 text-err" />}
          {t.kind === "info" && <Info className="mt-0.5 size-4 shrink-0 text-info" />}
          <span className={cn(t.kind === "err" && "text-err")}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
