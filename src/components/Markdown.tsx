import { Fragment, type ReactNode } from "react";

/** Tiny, dependency-free renderer for agent output: headings, lists, code, bold, links. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k++} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{mm[1]}</a>);
    } else out.push(<a key={k++} href={t} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 break-all">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text?: string | null }) {
  if (!text) return null;
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0; let k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs">{buf.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)/.exec(l);
    if (h) { blocks.push(<p key={k++} className="font-semibold">{inline(h[2])}</p>); i++; continue; }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\./.test(l);
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(<L key={k++} className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</L>);
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*•]|\d+\.)\s+/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p)}</Fragment>)}</p>);
  }
  return <div className="space-y-2.5 text-sm leading-relaxed break-words">{blocks}</div>;
}
