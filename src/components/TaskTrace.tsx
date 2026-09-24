import { useState } from "react";
import { Brain, Wrench, CheckCircle2, Sparkles, ChevronRight, Circle } from "lucide-react";
import type { TaskStep } from "@/api/types";
import { cn, pretty } from "@/lib/utils";
import { Code } from "./ui";

const KIND: Record<string, { icon: any; color: string; label: string }> = {
  thought: { icon: Brain, color: "text-violet-400", label: "Thinking" },
  tool_call: { icon: Wrench, color: "text-info", label: "Tool call" },
  tool_result: { icon: CheckCircle2, color: "text-ok", label: "Result" },
  final_answer: { icon: Sparkles, color: "text-accent", label: "Answer" },
};

function Step({ s }: { s: TaskStep }) {
  const [open, setOpen] = useState(false);
  const k = KIND[s.step_type] ?? { icon: Circle, color: "text-muted", label: s.step_type };
  const title = s.title || (s.tool_name ? `${k.label}: ${s.tool_name}` : k.label);
  const hasDetail = s.content || s.tool_input || s.tool_output;
  return (
    <li className="relative pl-7">
      <span className="absolute top-0 left-0 grid size-5 place-items-center rounded-full bg-surface"><k.icon className={cn("size-3.5", k.color)} /></span>
      <button onClick={() => hasDetail && setOpen(!open)} className={cn("flex w-full items-start gap-1.5 text-left", hasDetail && "cursor-pointer")}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px]">
            {title}
            {s.tool_zone && s.tool_zone !== "green" && <span className={cn("ml-2 text-[10px] uppercase", s.tool_zone === "red" ? "text-err" : "text-warn")}>{s.tool_zone} zone</span>}
          </p>
          {s.detail && <p className="truncate text-xs text-muted">{s.detail}</p>}
        </div>
        {hasDetail && <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0 text-muted transition-transform", open && "rotate-90")} />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {s.content && <Code>{s.content}</Code>}
          {s.tool_input != null && s.tool_input !== "" && <div><p className="mb-1 text-[11px] text-muted">Input</p><Code>{pretty(s.tool_input)}</Code></div>}
          {s.tool_output != null && s.tool_output !== "" && <div><p className="mb-1 text-[11px] text-muted">Output</p><Code>{pretty(s.tool_output)}</Code></div>}
        </div>
      )}
    </li>
  );
}

export function TaskTrace({ steps, live, defaultOpen }: { steps: TaskStep[]; live?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const expanded = open || live;
  if (!steps.length && !live) return null;
  const tools = steps.filter((s) => s.step_type === "tool_call").length;
  return (
    <div className="rounded-lg border border-border bg-surface-2/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-fg cursor-pointer">
        <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        {live ? <span className="flex items-center gap-1.5 text-info"><span className="size-1.5 rounded-full bg-info pulse-dot" /> Working…</span> : <span>Execution trace</span>}
        <span className="ml-auto">{steps.length} steps · {tools} tool calls</span>
      </button>
      {expanded && (
        <ol className="relative space-y-3 border-t border-border px-3 py-3 before:absolute before:top-4 before:bottom-4 before:left-[21px] before:w-px before:bg-border">
          {steps.map((s) => <Step key={s.id ?? s.step_number} s={s} />)}
          {live && (
            <li className="relative pl-7 text-xs text-muted">
              <span className="absolute top-0.5 left-1 size-3 rounded-full border-2 border-info border-t-transparent animate-spin" />
              waiting for next step…
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
