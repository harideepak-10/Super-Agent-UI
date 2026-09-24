import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant = "secondary", size = "md", loading, className, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-accent cursor-pointer",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
        variant === "secondary" && "bg-surface-2 border border-border hover:bg-border/60",
        variant === "ghost" && "hover:bg-surface-2 text-muted hover:text-fg",
        variant === "danger" && "bg-err/10 text-err border border-err/30 hover:bg-err/20",
        variant === "success" && "bg-ok text-white hover:brightness-110",
        className
      )}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn("h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent", className)}
    {...p}
  />
));

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(({ className, ...p }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-10", className)} {...p} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg cursor-pointer"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea
    ref={ref}
    className={cn("w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent", className)}
    {...p}
  />
));

export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn("h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent", className)} {...p}>
    {children}
  </select>
);

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-muted">{label}</span>
    {children}
    {hint && <span className="block text-xs text-muted">{hint}</span>}
  </label>
);

export const Card = ({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border border-border bg-surface", className)} {...p}>{children}</div>
);

export const Badge = ({ tone = "neutral", children, className }: { tone?: "neutral" | "ok" | "warn" | "err" | "info" | "accent"; children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
      tone === "neutral" && "bg-surface-2 text-muted",
      tone === "ok" && "bg-ok/12 text-ok",
      tone === "warn" && "bg-warn/12 text-warn",
      tone === "err" && "bg-err/12 text-err",
      tone === "info" && "bg-info/12 text-info",
      tone === "accent" && "bg-accent/15 text-accent",
      className
    )}
  >
    {children}
  </span>
);

const STATUS: Record<string, { tone: any; label: string; pulse?: boolean }> = {
  queued: { tone: "neutral", label: "Queued" },
  running: { tone: "info", label: "Running", pulse: true },
  waiting_approval: { tone: "warn", label: "Needs approval" },
  pending: { tone: "warn", label: "Pending" },
  completed: { tone: "ok", label: "Completed" },
  approved: { tone: "ok", label: "Approved" },
  resolved: { tone: "ok", label: "Resolved" },
  connected: { tone: "ok", label: "Connected" },
  active: { tone: "ok", label: "Active" },
  paused: { tone: "warn", label: "Paused" },
  failed: { tone: "err", label: "Failed" },
  rejected: { tone: "err", label: "Rejected" },
  error: { tone: "err", label: "Error" },
  expired: { tone: "neutral", label: "Expired" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  flagged: { tone: "warn", label: "Flagged" },
  open: { tone: "warn", label: "Open" },
};
export const StatusBadge = ({ status }: { status?: string }) => {
  const s = STATUS[status ?? ""] ?? { tone: "neutral", label: (status ?? "—").replace(/_/g, " ") };
  return (
    <Badge tone={s.tone}>
      <span className={cn("size-1.5 rounded-full bg-current", s.pulse && "pulse-dot")} />
      {s.label}
    </Badge>
  );
};

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("size-5 animate-spin text-muted", className)} />;

export const Loading = () => (
  <div className="flex h-40 items-center justify-center"><Spinner /></div>
);

export const Empty = ({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    {icon && <div className="mb-1 text-muted">{icon}</div>}
    <p className="text-sm font-medium">{title}</p>
    {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const ErrorBox = ({ error }: { error: any }) => (
  <div className="rounded-lg border border-err/30 bg-err/8 px-3 py-2 text-sm text-err">
    {error?.response?.data?.detail || error?.message || "Failed to load"}
  </div>
);

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
            value === t.value ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const Modal = ({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cn("w-full rounded-xl border border-border bg-surface shadow-2xl", wide ? "max-w-2xl" : "max-w-md")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Table = ({ head, children }: { head: ReactNode[]; children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          {head.map((h, i) => <th key={i} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  </div>
);
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>
);

export const Code = ({ children, className }: { children: ReactNode; className?: string }) => (
  <pre className={cn("max-h-80 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words", className)}>{children}</pre>
);

export const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50", checked ? "bg-accent" : "bg-border")}
  >
    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
  </button>
);
