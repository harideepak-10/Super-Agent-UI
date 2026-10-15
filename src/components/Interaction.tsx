import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, FileText, Mail, Sparkles, StickyNote } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";

/** Customer history entry — from /crm/customers/overview/ (recent_interactions) or /memory/<id>/interactions/. */
export type InteractionLike = {
  type?: string; interaction_type?: string; label?: string; summary?: string;
  channel?: string; source?: string; at?: string; created_at?: string; task?: string | null; metadata?: any;
};

const LABEL: Record<string, string> = {
  email_sent: "Email sent", email_received: "Email received", email_read: "Email read", email_classified: "Email classified",
  draft_created: "Draft created", thread_summarized: "Thread summarized", action_items_extracted: "Action items",
  note: "Note", telegram_sent: "Telegram sent", whatsapp_sent: "WhatsApp sent",
};
const SOURCE: Record<string, string> = { agent: "by an agent", gmail_sync: "from your Gmail" };
const LOGO: Record<string, [string, string]> = { telegram: ["/images/telegram_logo.webp", "bg-[#229ED9]"], whatsapp: ["/images/whatsapp_logo.webp", "bg-[#25D366]"] };

export function InteractionRow({ i }: { i: InteractionLike }) {
  const type = i.type ?? i.interaction_type ?? "";
  const channel = i.channel || i.metadata?.channel || (type.startsWith("telegram") ? "telegram" : type.startsWith("whatsapp") ? "whatsapp" : type.startsWith("email") || type === "draft_created" ? "email" : "");
  const source = i.source || i.metadata?.source || "";
  const at = i.at || i.metadata?.at || i.created_at;
  const incoming = type === "email_received";
  const outgoing = /_sent$/.test(type);
  const label = LABEL[type] ?? i.label ?? type.replace(/_/g, " ");

  let icon;
  if (LOGO[channel]) icon = <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg p-1.5", LOGO[channel][1])}><img src={LOGO[channel][0]} alt="" className="max-h-full max-w-full object-contain" /></span>;
  else {
    const I = type === "note" ? StickyNote : channel === "email" ? Mail : type.includes("summar") || type.includes("action") ? Sparkles : FileText;
    icon = <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", type === "note" ? "bg-warn/10 text-warn" : "bg-accent/10 text-accent")}><I className="size-4" /></span>;
  }

  return (
    <div className="flex gap-3">
      <div className="relative">
        {icon}
        {(incoming || outgoing) && (
          <span className={cn("absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border-2 border-surface text-white", incoming ? "bg-ok" : "bg-accent")}>
            {incoming ? <ArrowDownLeft className="size-2.5" /> : <ArrowUpRight className="size-2.5" />}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-fg">{label}</span>
          {SOURCE[source] && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{SOURCE[source]}</span>}
          {at && <span className="text-muted">{fmtDate(at)}</span>}
        </div>
        {i.summary && <p className="mt-0.5 text-sm break-words">{i.summary}</p>}
        {i.task && <Link to={`/chat?task=${i.task}`} className="text-xs text-muted hover:text-accent">View task →</Link>}
      </div>
    </div>
  );
}
