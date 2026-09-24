import type { ReactNode } from "react";

/** Centered auth card used by login, register and password reset. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" className="size-11" alt="" />
          <span className="text-lg font-semibold tracking-tight">Super Agent</span>
        </div>
        <div className="rounded-2xl border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Tell your agents what to do. Watch them work. Approve what matters.</p>
        <p className="mt-1 text-center text-xs text-muted/70">© {new Date().getFullYear()} Krypsos</p>
      </div>
    </div>
  );
}
