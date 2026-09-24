import { Bot, Mail, Calendar, FileText, GitBranch, Search, Wallet, ShieldCheck, ListChecks, Workflow, MessageSquare, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, [any, string]> = {
  email: [Mail, "text-sky-400 bg-sky-400/10"],
  calendar: [Calendar, "text-amber-400 bg-amber-400/10"],
  document: [FileText, "text-emerald-400 bg-emerald-400/10"],
  orchestrator: [GitBranch, "text-violet-400 bg-violet-400/10"],
  research: [Search, "text-cyan-400 bg-cyan-400/10"],
  finance: [Wallet, "text-lime-400 bg-lime-400/10"],
  compliance: [ShieldCheck, "text-rose-400 bg-rose-400/10"],
  qa: [ListChecks, "text-orange-400 bg-orange-400/10"],
  workflow: [Workflow, "text-fuchsia-400 bg-fuchsia-400/10"],
  communication: [MessageSquare, "text-teal-400 bg-teal-400/10"],
  reporting: [BarChart3, "text-indigo-400 bg-indigo-400/10"],
};

export function AgentIcon({ type, className, size = "md" }: { type?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const [Icon, color] = MAP[type ?? ""] ?? [Bot, "text-accent bg-accent/10"];
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-lg", color, size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9", className)}>
      <Icon className={size === "sm" ? "size-3.5" : size === "lg" ? "size-5" : "size-4"} />
    </div>
  );
}
