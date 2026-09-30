/**
 * Turns any business file into tables the backend understands.
 * The API only accepts .csv/.xlsx, so PDFs, Word reports, old Excel, OpenDocument,
 * Numbers, JSON, HTML and text exports are converted here (in the browser — the
 * file never leaves the device until the user confirms the upload) and sent as
 * one .xlsx workbook with a sheet per table.
 * Heavy libraries are loaded on demand.
 */
export type Table = { name: string; rows: string[][]; source: string };
export type Prepared = { file: File; tables: Table[]; error?: string; native: boolean; note?: string };

const SHEET_EXT = ["xlsx", "xlsm", "xls", "xlsb", "ods", "fods", "numbers", "csv", "tsv", "txt", "html", "htm"];
const NATIVE_EXT = ["csv", "xlsx", "xlsm"]; // backend parses these directly
export const ACCEPT = [...SHEET_EXT, "pdf", "docx", "json"].map((e) => "." + e).join(",");
export const FORMATS_LABEL = "Excel, CSV, PDF, Word, JSON, ODS";
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "heic", "gif", "bmp", "tif", "tiff"];

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();
const clean = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

/** Drop empty rows/columns, keep a rectangular grid, require header + 1 data row. */
function tidy(rows: unknown[][]): string[][] | null {
  let r = rows.map((row) => (row ?? []).map(clean));
  r = r.filter((row) => row.some((c) => c !== ""));
  if (r.length < 2) return null;
  const width = Math.max(...r.map((x) => x.length));
  r = r.map((x) => [...x, ...Array(width - x.length).fill("")]);
  const keep = Array.from({ length: width }, (_, j) => r.some((x) => x[j] !== ""));
  r = r.map((x) => x.filter((_, j) => keep[j]));
  if ((r[0]?.length ?? 0) < 2) return null;
  return r;
}

async function readSpreadsheet(file: File): Promise<Table[]> {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: true });
  const out: Table[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    const t = tidy(rows);
    if (t) out.push({ name: wb.SheetNames.length > 1 ? name : base(file.name), rows: t, source: file.name });
  }
  return out;
}

function readJson(text: string, file: File): Table[] {
  let data: any = JSON.parse(text);
  if (!Array.isArray(data) && data && typeof data === "object") {
    const arr = Object.entries(data).filter(([, v]) => Array.isArray(v) && (v as any[]).length && typeof (v as any[])[0] === "object");
    if (arr.length) return arr.flatMap(([k, v]) => objectsToTable(v as any[], k, file.name));
    data = [data];
  }
  return Array.isArray(data) ? objectsToTable(data, base(file.name), file.name) : [];
}
function objectsToTable(items: any[], name: string, source: string): Table[] {
  const objs = items.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (!objs.length) return [];
  const cols = [...new Set(objs.flatMap((o) => Object.keys(o)))];
  const t = tidy([cols, ...objs.map((o) => cols.map((c) => (typeof o[c] === "object" ? JSON.stringify(o[c]) : o[c])))]);
  return t ? [{ name, rows: t, source }] : [];
}

/** Word .docx: every <w:tbl> becomes a table. */
async function readDocx(file: File): Promise<Table[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const tables = Array.from(doc.getElementsByTagNameNS(W, "tbl"));
  const out: Table[] = [];
  tables.forEach((tbl, i) => {
    const rows = Array.from(tbl.getElementsByTagNameNS(W, "tr")).map((tr) =>
      Array.from(tr.getElementsByTagNameNS(W, "tc")).map((tc) =>
        Array.from(tc.getElementsByTagNameNS(W, "p")).map((p) => Array.from(p.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join("")).join(" ")));
    const t = tidy(rows);
    if (t) out.push({ name: tables.length > 1 ? `${base(file.name)} ${i + 1}` : base(file.name), rows: t, source: file.name });
  });
  return out;
}

/**
 * PDF reports/invoices: rebuild lines from text positions, split cells on wide
 * gaps, then keep runs of lines that share the same column count as tables.
 */
async function readPdf(file: File): Promise<Table[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[][] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 60); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter((it) => typeof it.str === "string" && it.str.trim() !== "")
      .map((it) => ({ s: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number, w: (it.width as number) || 0, h: Math.abs(it.transform[3]) || 10 }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: typeof items[] = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(2.5, it.h * 0.35));
      row ? row.push(it) : rows.push([it]);
    }
    for (const r of rows) {
      r.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let last: (typeof r)[number] | null = null;
      for (const it of r) {
        const gap = last ? it.x - (last.x + last.w) : Infinity;
        if (last && gap < Math.max(6, it.h * 0.9)) cells[cells.length - 1] += (gap > 1 ? " " : "") + it.s;
        else cells.push(it.s);
        last = it;
      }
      lines.push(cells.map(clean));
    }
    lines.push([]); // page break
  }
  // group consecutive multi-column lines with (roughly) the same width into tables
  const out: Table[] = [];
  let block: string[][] = [];
  const flush = () => {
    if (block.length >= 3) {
      const counts = new Map<number, number>();
      block.forEach((l) => counts.set(l.length, (counts.get(l.length) ?? 0) + 1));
      const width = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
      const rows = block.filter((l) => l.length === width || l.length === width - 1);
      const t = tidy(rows);
      if (t && t.length >= 3) {
        // same header as the previous table (multi-page report) → append
        const prev = out[out.length - 1];
        if (prev && prev.rows[0].join("|") === t[0].join("|")) prev.rows.push(...t.slice(1));
        else out.push({ name: `${base(file.name)}${out.length ? " " + (out.length + 1) : ""}`, rows: t, source: file.name });
      }
    }
    block = [];
  };
  for (const l of lines) {
    if (l.length >= 2 && (!block.length || Math.abs(l.length - block[0].length) <= 1)) block.push(l);
    else { flush(); if (l.length >= 2) block.push(l); }
  }
  flush();
  return out;
}

const base = (name: string) => name.replace(/\.[^.]+$/, "").slice(0, 60) || "Records";

export async function prepareFile(file: File): Promise<Prepared> {
  const e = ext(file.name);
  try {
    if (IMAGE_EXT.includes(e)) return { file, tables: [], native: false, error: "Photos and scans can't be read yet — export the report as PDF (with selectable text), Excel or CSV." };
    if (e === "doc") return { file, tables: [], native: false, error: "Old .doc files aren't supported — save it as .docx or PDF." };
    if (e === "pptx" || e === "ppt") return { file, tables: [], native: false, error: "Slides aren't supported — export the table to Excel or PDF." };
    let tables: Table[] = [];
    if (e === "pdf") tables = await readPdf(file);
    else if (e === "docx") tables = await readDocx(file);
    else if (e === "json") tables = readJson(await file.text(), file);
    else if (SHEET_EXT.includes(e) || !e) tables = await readSpreadsheet(file);
    else tables = await readSpreadsheet(file); // let SheetJS try anything else
    if (!tables.length) return { file, tables, native: false, error: e === "pdf" ? "No tables found in this PDF. If it's a scanned image, export it from the original app as Excel or CSV." : "No table found — the file needs a header row and at least one data row." };
    return { file, tables, native: NATIVE_EXT.includes(e), note: e === "pdf" ? "Tables were rebuilt from the PDF layout — check the preview." : undefined };
  } catch (err: any) {
    return { file, tables: [], native: false, error: `Couldn't read this file (${err?.message?.slice(0, 80) || "unknown error"}).` };
  }
}

/** One .xlsx with a sheet per table (unique, Excel-safe names, max 20 sheets). */
export async function toWorkbook(tables: Table[], filename: string): Promise<File> {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const t of tables.slice(0, 20)) {
    let n = t.name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Sheet";
    let k = n, i = 2;
    while (used.has(k.toLowerCase())) k = `${n.slice(0, 25)} ${i++}`;
    used.add(k.toLowerCase());
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.rows), k);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
