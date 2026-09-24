import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Check, X } from "lucide-react";
import { get, post } from "@/api/client";
import { errMsg, pretty, timeAgo } from "@/lib/utils";
import { Badge, Button, Code, Spinner, StatusBadge, Textarea } from "./ui";
import { toast } from "./toast";

const RISK_TONE: Record<string, any> = { low: "ok", medium: "warn", high: "err", critical: "err" };

/** Shows what an agent wants to do and lets a human approve or reject it. */
export function ApprovalCard({ approvalId, compact, onDecided }: { approvalId: string; compact?: boolean; onDecided?: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const review = useQuery({ queryKey: ["approval", approvalId, "review"], queryFn: () => get(`/approvals/${approvalId}/review/`), retry: false });
  const basic = useQuery({ queryKey: ["approval", approvalId], queryFn: () => get(`/approvals/${approvalId}/`), enabled: review.isError });

  const decide = useMutation({
    mutationFn: (approved: boolean) => post(`/approvals/${approvalId}/decide/`, { approved, note }),
    onSuccess: (_d, approved) => {
      toast.ok(approved ? "Approved — the agent will continue" : "Rejected");
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["approval", approvalId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDecided?.();
    },
    onError: (e) => toast.err(errMsg(e)),
  });

  if (review.isLoading || basic.isLoading) return <div className="p-4"><Spinner /></div>;
  const r = review.data;
  const b = basic.data;
  const status = r?.status ?? b?.status;
  const toolName = r?.action?.display_name ?? r?.action?.tool_name ?? b?.tool_name;
  const toolInput = r?.action?.tool_input ?? b?.tool_input;
  const description = r?.action?.description;
  const risk = r?.risk;
  const agentName = r?.agent?.name;
  const pending = status === "pending";

  return (
    <div className="rounded-xl border border-warn/40 bg-warn/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-warn/20 px-4 py-3">
        <ShieldAlert className="size-4 text-warn" />
        <p className="text-sm font-medium">{agentName ? `${agentName} wants to run` : "Approval needed for"} <span className="font-mono text-warn">{toolName}</span></p>
        <div className="ml-auto flex items-center gap-2">
          {risk?.label && <Badge tone={RISK_TONE[risk.level] ?? "warn"}>{risk.label}</Badge>}
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="space-y-3 p-4">
        {description && <p className="text-sm text-muted">{description}</p>}
        {risk?.description && !compact && <p className="text-xs text-muted">{risk.description}</p>}
        <ActionPreview input={toolInput} />
        {pending ? (
          <>
            {!compact && <Textarea rows={2} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
            <div className="flex gap-2">
              <Button variant="success" loading={decide.isPending && decide.variables === true} onClick={() => decide.mutate(true)}><Check className="size-4" /> Approve</Button>
              <Button variant="danger" loading={decide.isPending && decide.variables === false} onClick={() => decide.mutate(false)}><X className="size-4" /> Reject</Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">
            {status} {r?.reviewed_at || b?.reviewed_at ? timeAgo(r?.reviewed_at ?? b?.reviewed_at) : ""} {(r?.reviewer_note || b?.reviewer_note) && `· “${r?.reviewer_note ?? b?.reviewer_note}”`}
          </p>
        )}
      </div>
    </div>
  );
}

/** Render common tool inputs (emails, messages) as a readable preview, fallback to JSON. */
export function ActionPreview({ input }: { input: any }) {
  let data = input;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { /* keep */ } }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const to = data.to ?? data.recipient ?? data.email ?? data.chat_id ?? data.channel ?? data.phone;
    const subject = data.subject ?? data.title;
    const body = data.body ?? data.text ?? data.message ?? data.content;
    if (body && typeof body === "string") {
      const rest = Object.fromEntries(Object.entries(data).filter(([k]) => !["to", "recipient", "email", "chat_id", "channel", "phone", "subject", "title", "body", "text", "message", "content"].includes(k)));
      return (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {(to || subject) && (
            <div className="space-y-0.5 border-b border-border px-3 py-2 text-xs">
              {to && <p><span className="text-muted">To:</span> {String(to)}</p>}
              {subject && <p><span className="text-muted">Subject:</span> <span className="font-medium">{String(subject)}</span></p>}
            </div>
          )}
          <p className="px-3 py-2.5 text-sm whitespace-pre-wrap">{body}</p>
          {Object.keys(rest).length > 0 && <Code className="rounded-none border-t border-border">{pretty(rest)}</Code>}
        </div>
      );
    }
  }
  return <Code>{pretty(data) || "No input"}</Code>;
}
