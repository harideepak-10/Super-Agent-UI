import { useRef, useState, type ReactNode } from "react";
import { Check, Download, ExternalLink, Eye, File as FileIcon, FileImage, FileSpreadsheet, FileText, FolderUp, Loader2, Paperclip, Presentation, X } from "lucide-react";
import { api } from "@/api/client";
import type { Task, TaskDocument, TaskFile, TaskOption } from "@/api/types";
import { cn, errMsg } from "@/lib/utils";
import { Button, Modal } from "./ui";
import { toast } from "./toast";

/* ─────────────── attachments (composer side) ─────────────── */
export type Attachment = { file: File; path: string };

const MAX_FILE = 25 * 1024 * 1024;
const MAX_TOTAL = 100 * 1024 * 1024;
const MAX_COUNT = 200;
const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

export const fmtSize = (bytes?: number) => {
  const b = bytes ?? 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

/** Files picked for the next message. Matches the backend limits (25 MB a file, 100 MB in total; zips are unpacked by the server). */
export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = [...items];
    for (const file of Array.from(list)) {
      const path = (file as any).webkitRelativePath || "";
      const zip = /\.zip$/i.test(file.name);
      if (file.size > (zip ? MAX_TOTAL : MAX_FILE)) { toast.err(`'${file.name}' is larger than ${mb(zip ? MAX_TOTAL : MAX_FILE)}.`); continue; }
      if (next.some((a) => a.file.name === file.name && a.path === path && a.file.size === file.size)) continue;
      next.push({ file, path });
    }
    const total = next.reduce((s, a) => s + a.file.size, 0);
    if (total > MAX_TOTAL) return toast.err(`Attachments are larger than ${mb(MAX_TOTAL)} in total.`);
    if (next.length > MAX_COUNT) return toast.err(`Too many files (max ${MAX_COUNT}).`);
    setItems(next);
  };
  const remove = (i: number) => setItems((x) => x.filter((_, j) => j !== i));
  const clear = () => setItems([]);
  return { items, add, remove, clear };
}

/**
 * Body for POST /tasks/create/: plain JSON, or multipart when files are attached
 * (files=<file> repeated, paths=<folder path> per file for folder uploads).
 */
export function taskBody(fields: Record<string, any>, attachments: Attachment[]) {
  if (!attachments.length) return fields;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
    else fd.append(k, String(v));
  }
  const withPaths = attachments.some((a) => a.path);
  for (const a of attachments) {
    fd.append("files", a.file, a.file.name);
    if (withPaths) fd.append("paths", a.path || a.file.name);
  }
  return fd;
}

/** Paperclip + folder buttons with hidden inputs. */
export function AttachButtons({ onAdd, compact }: { onAdd: (f: FileList | null) => void; compact?: boolean }) {
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const btn = "flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:border-accent/50 hover:text-fg cursor-pointer";
  return (
    <>
      <input ref={files} type="file" multiple hidden onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      <input ref={folder} type="file" hidden {...({ webkitdirectory: "", directory: "" } as any)} onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      <button type="button" title="Attach files (PDF, Word, Excel, PPT, images, zip…)" onClick={() => files.current?.click()} className={btn}>
        <Paperclip className="size-3.5" />{!compact && " Attach"}
      </button>
      <button type="button" title="Attach a folder" onClick={() => folder.current?.click()} className={btn}>
        <FolderUp className="size-3.5" />{!compact && " Folder"}
      </button>
    </>
  );
}

export function kindIcon(kind?: string, name?: string) {
  const n = (name ?? "").toLowerCase();
  if (kind === "spreadsheet" || /\.(xlsx?|csv|ods)$/.test(n)) return FileSpreadsheet;
  if (kind === "presentation" || /\.(pptx?|odp)$/.test(n)) return Presentation;
  if (kind === "image" || /\.(png|jpe?g|gif|webp)$/.test(n)) return FileImage;
  if (kind === "pdf" || kind === "word" || kind === "text" || /\.(pdf|docx?|txt|md)$/.test(n)) return FileText;
  return FileIcon;
}

/** Chips for files waiting to be sent. */
export function AttachmentChips({ items, onRemove }: { items: Attachment[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a, i) => {
        const Icon = kindIcon(undefined, a.file.name);
        return (
          <span key={i} className="flex max-w-[240px] items-center gap-1.5 rounded-lg border border-border bg-surface-2 py-1 pl-2 pr-1 text-xs">
            <Icon className="size-3.5 shrink-0 text-accent" />
            <span className="truncate" title={a.path || a.file.name}>{a.path || a.file.name}</span>
            <span className="shrink-0 text-muted">{fmtSize(a.file.size)}</span>
            <button type="button" onClick={() => onRemove(i)} className="grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-surface hover:text-err cursor-pointer"><X className="size-3" /></button>
          </span>
        );
      })}
    </div>
  );
}

/** Wraps a composer so files can be dropped onto it. */
export function DropZone({ onFiles, children, className }: { onFiles: (f: FileList) => void; children: ReactNode; className?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn("relative", className)}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); } }}
    >
      {children}
      {over && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-sm font-medium text-accent">Drop files to attach</div>}
    </div>
  );
}

/* ─────────────── files sent with a task (shown under the prompt) ─────────────── */
export function SentFiles({ files }: { files?: TaskFile[] }) {
  if (!files?.length) return null;
  const shown = files.slice(0, 8);
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {shown.map((f) => {
        const Icon = kindIcon(f.kind, f.name);
        const bad = f.status && f.status !== "ready";
        return (
          <span key={f.id} title={bad ? (f.error || f.status?.replace(/_/g, " ")) : f.path || f.name}
            className={cn("flex max-w-[220px] items-center gap-1.5 rounded-lg border bg-surface px-2 py-1 text-xs", bad ? "border-warn/40" : "border-border")}>
            <Icon className={cn("size-3.5 shrink-0", bad ? "text-warn" : "text-accent")} />
            <span className="truncate">{f.path || f.name}</span>
            <span className="shrink-0 text-muted">{fmtSize(f.size_bytes)}</span>
          </span>
        );
      })}
      {files.length > shown.length && <span className="rounded-lg border border-border px-2 py-1 text-xs text-muted">+{files.length - shown.length} more</span>}
    </div>
  );
}

/* ─────────────── needs_input: the agent's question + choices ─────────────── */
export function InputOptions({ task, enabled, onAnswer, busy }: { task: Task; enabled: boolean; onAnswer: (keys: string[]) => void; busy?: boolean }) {
  const opts: TaskOption[] = Array.isArray(task.input_options) ? task.input_options : [];
  const [sel, setSel] = useState<string[]>([]);
  if (!opts.length) return null;
  const group = opts[0]?.group ?? "topics";
  if (group === "hire") {
    // Default Assistant: "Shall I hire the X agent?" — one tap answers
    return enabled ? (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <Button key={o.key} size="sm" variant={o.key === "hire_yes" ? "primary" : "ghost"} loading={busy && sel[0] === o.key} disabled={busy}
            onClick={() => { setSel([o.key]); onAnswer([o.key]); }}>
            {o.key === "hire_yes" && <Check className="size-3.5" />} {o.label}
          </Button>
        ))}
      </div>
    ) : null;
  }
  const toggle = (k: string) => {
    if (!enabled) return;
    if (k === "everything") return setSel((s) => (s.includes(k) ? [] : [k]));
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s.filter((x) => x !== "everything"), k]));
  };
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold tracking-wider text-muted">{group === "format" ? "HOW SHOULD I SHOW IT?" : "PICK ONE OR MORE"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map((o) => {
          const on = sel.includes(o.key);
          return (
            <button key={o.key} type="button" disabled={!enabled} onClick={() => toggle(o.key)}
              className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition", enabled ? "cursor-pointer" : "cursor-default opacity-60",
                on ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-accent/40")}>
              <span className={cn("mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border", on ? "border-accent bg-accent text-white" : "border-border")}>{on && <Check className="size-3" />}</span>
              <span className="min-w-0"><span className="block font-medium">{o.label}</span>{o.detail && <span className="block text-xs text-muted">{o.detail}</span>}</span>
            </button>
          );
        })}
      </div>
      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" disabled={!sel.length} loading={busy} onClick={() => onAnswer(sel)}>
            <Check className="size-3.5" /> {sel.length ? `Continue with ${sel.length} selected` : "Pick an option"}
          </Button>
          <span className="text-xs text-muted">…or type your answer below.</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────── documents a task made: View / Download / Drive ─────────────── */
/** Signed links come back absolute (sometimes http:// behind Render's proxy) — call them through our API client instead. */
const apiPath = (url: string) => {
  try { const u = new URL(url, "http://x"); return (u.pathname + u.search).replace(/^\/api\/v1/, ""); } catch { return url; }
};

async function fetchBlob(url: string) {
  const res = await api.get(apiPath(url), { responseType: "blob" });
  return res.data as Blob;
}

export function TaskDocuments({ docs }: { docs?: TaskDocument[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ doc: TaskDocument; src?: string; text?: string } | null>(null);
  if (!docs?.length) return null;

  const download = async (d: TaskDocument) => {
    setBusy(`dl:${d.id}`);
    try {
      const href = URL.createObjectURL(await fetchBlob(d.download_url));
      const a = document.createElement("a"); a.href = href; a.download = d.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(null); }
  };
  const view = async (d: TaskDocument) => {
    if (!d.can_preview) return setViewing({ doc: d, text: d.preview_text || "" });
    setBusy(`v:${d.id}`);
    try {
      const blob = await fetchBlob(d.view_url);
      const fmt = (d.format || "").toLowerCase();
      if (["txt", "csv", "md", "json"].includes(fmt)) setViewing({ doc: d, text: await blob.text() });
      else setViewing({ doc: d, src: URL.createObjectURL(blob) });
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(null); }
  };
  const close = () => { if (viewing?.src) URL.revokeObjectURL(viewing.src); setViewing(null); };
  const isImage = (f?: string) => ["png", "jpg", "jpeg"].includes((f || "").toLowerCase());

  return (
    <>
      <div className="space-y-2">
        {docs.map((d) => {
          const Icon = kindIcon(undefined, d.filename);
          const canView = d.can_preview || !!d.preview_text;
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10"><Icon className="size-4.5 text-accent" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={d.filename}>{d.filename}</p>
                <p className="text-[11px] text-muted">{(d.format || "file").toUpperCase()} · {d.size_kb != null ? `${d.size_kb} KB` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {canView && <Button size="sm" loading={busy === `v:${d.id}`} onClick={() => view(d)}><Eye className="size-3.5" /> View</Button>}
                <Button size="sm" variant="primary" loading={busy === `dl:${d.id}`} onClick={() => download(d)}><Download className="size-3.5" /> Download</Button>
                {d.drive_url && <a href={d.drive_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="size-3.5" /> Drive</Button></a>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!viewing} onClose={close} title={viewing?.doc.filename ?? ""} wide>
        {viewing && (
          <div className="space-y-3">
            {viewing.src ? (
              isImage(viewing.doc.format)
                ? <img src={viewing.src} alt={viewing.doc.filename} className="mx-auto max-h-[70vh] rounded-lg" />
                : <iframe src={viewing.src} title={viewing.doc.filename} className="h-[70vh] w-full rounded-lg border border-border bg-white" />
            ) : viewing.text ? (
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed">{viewing.text}</pre>
            ) : <p className="py-6 text-center text-sm text-muted">No preview for this file — download it to open.</p>}
            <div className="flex justify-end gap-2">
              {viewing.src && <a href={viewing.src} target="_blank" rel="noreferrer"><Button size="sm"><ExternalLink className="size-3.5" /> Open in new tab</Button></a>}
              <Button size="sm" variant="primary" loading={busy === `dl:${viewing.doc.id}`} onClick={() => download(viewing.doc)}><Download className="size-3.5" /> Download</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export const Uploading = () => <span className="flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Uploading files…</span>;
