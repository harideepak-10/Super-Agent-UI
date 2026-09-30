import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Right-side slide-over panel. */
export function Drawer({ open, onClose, title, children, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`slide-in flex h-full w-full ${width} flex-col border-l border-border bg-surface shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="min-w-0 font-semibold">{title}</div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 cursor-pointer"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
