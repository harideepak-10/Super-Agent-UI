import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, Phone, Send } from "lucide-react";
import { get, post } from "@/api/client";
import { asList, cn, errMsg } from "@/lib/utils";
import { Button } from "./ui";
import { toast } from "./toast";

type Channel = "whatsapp" | "telegram";
type Result = { connected?: boolean; link?: string; error?: string };

/** Phone number for a customer, read from imported business records (the profile API doesn't expose it). */
export function useCustomerPhone(email?: string | null) {
  const q = useQuery({
    queryKey: ["business", "records", "phone", email],
    queryFn: () => get("/business/records/", { entity: "customers", customer_email: email, limit: 5 }),
    enabled: !!email, retry: false, staleTime: 60_000,
  });
  for (const r of asList(q.data)) {
    const data = { ...(r.extra ?? {}), ...(r.data ?? {}) };
    const key = Object.keys(data).find((k) => /phone|mobile|whats|contact.?no|cell/i.test(k) && String(data[k]).replace(/\D/g, "").length >= 8);
    if (key) return String(data[key]);
  }
  return null;
}

const LOGO: Record<Channel, string> = { whatsapp: "/images/whatsapp_logo.webp", telegram: "/images/telegram_logo.webp" };
const LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", telegram: "Telegram" };
const BG: Record<Channel, string> = { whatsapp: "bg-[#25D366]", telegram: "bg-[#229ED9]" };

function explain(e: any) {
  const m = errMsg(e);
  if (/TWILIO_WHATSAPP_FROM/i.test(m)) return "WhatsApp isn't set up on the server yet — add TWILIO_WHATSAPP_FROM (and the Twilio keys) to the backend on Render.";
  if (/TELEGRAM/i.test(m) && /configured|token|username/i.test(m)) return "Telegram isn't set up on the server yet — add the Telegram bot settings to the backend on Render.";
  return m;
}

/**
 * WhatsApp / Telegram status for one customer:
 *  · customers imported with a phone number are linked to WhatsApp automatically
 *  · everyone else gets a one-time invite link (which you can send to their WhatsApp)
 */
/** The customer's linked WhatsApp number from customer memory (set at import or when they open the invite link). */
export function useCustomerWhatsApp(email?: string | null, known?: string | null) {
  const q = useQuery({
    queryKey: ["memory", "lookup", email],
    queryFn: () => get("/memory/lookup/", { email }),
    enabled: !!email && known === undefined, retry: false, staleTime: 60_000,
  });
  if (known !== undefined) return known || null;
  const d: any = q.data;
  return (d?.whatsapp_number ?? d?.profile?.whatsapp_number) || null;
}

export function CustomerChannels({ email, whatsapp, compact }: { email: string; whatsapp?: string | null; compact?: boolean }) {
  const wa = useCustomerWhatsApp(email, whatsapp);
  const recordPhone = useCustomerPhone(wa ? null : email);
  const phone = wa ?? recordPhone;
  const [res, setRes] = useState<Partial<Record<Channel, Result>>>({});
  const [busy, setBusy] = useState<Channel | null>(null);

  const check = async (ch: Channel) => {
    setBusy(ch);
    try {
      const d: any = await post("/integrations/channels/connect/", { email, channel: ch });
      setRes((r) => ({ ...r, [ch]: d.already_connected ? { connected: true } : { link: d.connect_link ?? d.link ?? d.url } }));
    } catch (e) {
      setRes((r) => ({ ...r, [ch]: { error: explain(e) } }));
    } finally { setBusy(null); }
  };

  const status = (ch: Channel): Result | undefined => res[ch] ?? (ch === "whatsapp" && wa ? { connected: true } : undefined);
  const digits = phone?.replace(/\D/g, "") ?? "";
  const shareOnWhatsApp = (link: string, ch: Channel) =>
    `https://wa.me/${digits}?text=${encodeURIComponent(`Hi! Tap this link to connect with us on ${LABEL[ch]} so we can send you updates: ${link}`)}`;

  return (
    <div className="space-y-2.5">
      {phone && <p className="flex items-center gap-2 text-sm"><Phone className="size-4 text-muted" /> <span className="font-medium">{phone}</span> <span className="text-xs text-muted">{wa ? "WhatsApp number" : "from your records"}</span></p>}
      {(["whatsapp", "telegram"] as Channel[]).map((ch) => {
        const r = status(ch);
        return (
          <div key={ch} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl p-1.5", BG[ch])}><img src={LOGO[ch]} alt="" className="max-h-full max-w-full object-contain" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{LABEL[ch]}</p>
                {!r && <p className="text-xs text-muted">{ch === "whatsapp" && phone ? "Number found — check if it's linked" : "Not checked yet"}</p>}
                {r?.connected && <p className="flex items-center gap-1 text-xs text-ok"><CheckCircle2 className="size-3.5" /> Connected — agents can message this customer</p>}
                {r?.link && <p className="text-xs text-warn">Not connected yet — send them the invite link</p>}
                {r?.error && <p className="text-xs text-err">{r.error}</p>}
              </div>
              {!r?.connected && <Button size="sm" loading={busy === ch} onClick={() => check(ch)}>{r ? "Check again" : compact ? "Check" : "Check / connect"}</Button>}
            </div>
            {r?.link && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px]">{r.link}</span>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(r.link!); toast.ok("Link copied"); }}><Copy className="size-3.5" /></Button>
                {digits ? (
                  <a href={shareOnWhatsApp(r.link, ch)} target="_blank" rel="noreferrer"><Button size="sm" variant="primary"><Send className="size-3.5" /> Send on WhatsApp</Button></a>
                ) : <a href={r.link} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="size-3.5" /></Button></a>}
              </div>
            )}
          </div>
        );
      })}
      <p className={cn("text-[11px] text-muted", compact && "hidden")}>Customers imported with a phone number are linked to WhatsApp automatically. The customer opens the invite link once to connect.</p>
    </div>
  );
}
