import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Check, X } from "lucide-react";
import { get, post } from "@/api/client";
import { errMsg, timeAgo } from "@/lib/utils";
import { Badge, Button, Spinner, StatusBadge, Textarea } from "./ui";
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
  const toolName = r?.action?.display_name ?? b?.tool_display ?? r?.action?.tool_name ?? b?.tool_name;
  const toolInput = r?.action?.tool_input ?? b?.tool_input;
  const preview = r?.action?.preview ?? b?.preview;
  const description = r?.action?.description;
  const risk = r?.risk;
  const agentName = r?.agent?.name;
  const pending = status === "pending";

  return (
    <div className="rounded-xl border border-warn/40 bg-warn/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-warn/20 px-4 py-3">
        <ShieldAlert className="size-4 text-warn" />
        <p className="text-sm">{agentName ? `${agentName} needs your OK to` : "Approval needed to"} <span className="font-semibold text-warn">{lower(toolName)}</span></p>
        <div className="ml-auto flex items-center gap-2">
          {risk?.label && <Badge tone={RISK_TONE[risk.level] ?? "warn"}>{risk.label}</Badge>}
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="space-y-3 p-4">
        {description && <p className="text-sm text-muted">{description}</p>}
        {risk?.description && !compact && <p className="text-xs text-muted">{risk.description}</p>}
        <ActionPreview input={toolInput} preview={preview} />
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

const lower = (t?: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : "");

// Plumbing the agent passes along — never shown to the person approving.
const HIDDEN = new Set(["customer", "name", "parse_mode", "chat_id", "workspace_id", "task_id", "thread_id", "message_id",
  "draft_id", "event_id", "calendar_id", "id", "html", "is_html", "format",
  // raw ids mean nothing to the approver — the card names the record via preview.item instead
  "original_text", "language_override", "preferences_checked", "file_path",
  "deal_id", "follow_up_id", "customer_id", "report_id", "run_id", "workflow_id", "file_id", "rule_id", "record_id", "approval_id"]);
const LABELS: Record<string, string> = { notify: "Email the attendees", send_updates: "Email the attendees" };
const label = (k: string) => LABELS[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const show = (v: unknown): string =>
  typeof v === "boolean" ? (v ? "Yes" : "No")
    : Array.isArray(v) ? v.map(show).join(", ") : v && typeof v === "object" ? Object.values(v as object).map(show).join(", ") : String(v ?? "");

type Preview = { channel?: string | null; to?: string | null; subject?: string | null; cc?: any; bcc?: any; body?: string | null; meeting?: string | null; item?: string | null; item_label?: string | null };

/** What the approver checks, in plain words: who it goes to (the person, not a chat ID),
 *  subject and message — or the action's details as labelled rows. Never raw JSON. */
export function ActionPreview({ input, preview }: { input: any; preview?: Preview | null }) {
  let data = input;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { /* keep */ } }
  const obj = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, any>) : null;
  const body = preview?.body ?? (obj && (obj.body ?? obj.text ?? obj.message ?? obj.content));
  if (obj && body && typeof body === "string") {
    const to = preview?.to ?? obj.to ?? obj.recipient ?? obj.email ?? obj.customer ?? obj.phone;
    const rows: [string, string][] = [];
    if (to) rows.push(["To", show(to)]);
    if (preview?.cc ?? obj.cc) rows.push(["Cc", show(preview?.cc ?? obj.cc)]);
    if (preview?.bcc ?? obj.bcc) rows.push(["Bcc", show(preview?.bcc ?? obj.bcc)]);
    const subject = preview?.subject ?? obj.subject ?? obj.title;
    const files = obj.attachments ?? obj.files ?? (obj.file_path ? String(obj.file_path).split(/[\\/]/).pop()?.replace(/^[0-9a-f-]{36}_/, "") : undefined);
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {(rows.length > 0 || subject || preview?.channel) && (
          <div className="space-y-0.5 border-b border-border px-3 py-2 text-xs">
            {rows.map(([k, v]) => <p key={k}><span className="text-muted">{k}:</span> {v}</p>)}
            {subject && <p><span className="text-muted">Subject:</span> <span className="font-medium">{String(subject)}</span></p>}
            {preview?.channel && <p><span className="text-muted">Via:</span> {preview.channel}</p>}
          </div>
        )}
        <p className="px-3 py-2.5 text-sm whitespace-pre-wrap">{body}</p>
        {typeof obj.original_text === "string" && obj.original_text.trim() && obj.original_text.trim() !== body.trim() && (
          <div className="border-t border-border bg-surface-2/50 px-3 py-2">
            <p className="text-[11px] font-medium text-muted">Your words (translated above for the customer — not sent)</p>
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted">{obj.original_text}</p>
          </div>
        )}
        {files && show(files) && <p className="border-t border-border px-3 py-2 text-xs text-muted">Attachments: {show(files)}</p>}
      </div>
    );
  }
  if (obj) {
    const rows = Object.entries(obj).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
    const item = preview?.item ?? preview?.meeting;
    if (!rows.length && !item) return null;
    return (
      <div className="space-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
        {item && <p><span className="text-muted">{preview?.item_label ?? "Meeting"}:</span> <span className="font-medium">{item}</span></p>}
        {rows.map(([k, v]) => <p key={k}><span className="text-muted">{label(k)}:</span> {show(v)}</p>)}
      </div>
    );
  }
  return data ? <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm whitespace-pre-wrap">{String(data)}</p> : null;
}
