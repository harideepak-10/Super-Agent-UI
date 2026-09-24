import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--accent)_25%,transparent),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2.5"><img src="/logo.svg" className="size-8" alt="" /><span className="text-lg font-semibold">Super Agent</span></div>
          <div className="max-w-md space-y-4">
            <p className="text-3xl font-semibold leading-tight tracking-tight">Tell your agents what to do. Watch them work. Approve what matters.</p>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Email, Calendar, Drive, Slack, Telegram & WhatsApp agents</li>
              <li>• Live execution trace for every task</li>
              <li>• Human approval for risky actions, full audit trail</li>
            </ul>
          </div>
          <p className="text-xs text-muted">© {new Date().getFullYear()} Krypsos</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><img src="/logo.svg" className="size-8" alt="" /><span className="text-lg font-semibold">Super Agent</span></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
