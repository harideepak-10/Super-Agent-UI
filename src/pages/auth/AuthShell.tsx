import type { ReactNode } from "react";

/**
 * Auth backdrop from the Flutter app (authNavy gradient + glow blobs) with a
 * centered glass card. Used by login, register and password reset.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-bg relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="blob pointer-events-none absolute -top-40 -left-24 size-[520px] rounded-full bg-[#1a6fff]/30 blur-[120px]" />
      <div className="blob pointer-events-none absolute -right-32 -bottom-40 size-[480px] rounded-full bg-[#6d28d9]/20 blur-[120px]" style={{ animationDelay: "-6s" }} />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center text-white">
          <img src="/logo.svg" className="size-12 shadow-[0_0_50px_-10px_#1a6fff]" alt="" />
          <span className="text-xs font-bold tracking-[0.3em] text-white/90">SUPER AGENT</span>
        </div>
        {/* card is always light, like the Flutter auth sheet */}
        <div className="rounded-3xl border border-white/10 bg-white p-6 text-[#1c1e21] shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)] sm:p-8 [--bg:#eef1f6] [--surface:#fff] [--surface-2:#f4f6fa] [--border:#e3e7ee] [--fg:#1c1e21] [--muted:#6b7280]">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-[#6b7280]">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-[#6b7280]">{footer}</div>}
        </div>
        <p className="mt-6 text-center text-xs text-white/40">© {new Date().getFullYear()} Super Agent · Krypsos</p>
      </div>
    </div>
  );
}
