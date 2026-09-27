import { degrees, PDFDocument } from 'pdf-lib';

export interface PageEdit {
  /** Zero-based index in the source document. */
  index: number;
  /** Extra clockwise rotation in degrees (multiple of 90). */
  rotate: number;
  keep: boolean;
}

export async function pageCount(data: Uint8Array): Promise<number> {
  return (await PDFDocument.load(data, { ignoreEncryption: true })).getPageCount();
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const data of files) {
    const src = await PDFDocument.load(data);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Builds a new PDF from `edits`, in order, skipping pages marked `keep: false`. */
export async function editPdf(data: Uint8Array, edits: PageEdit[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(data);
  const out = await PDFDocument.create();
  const kept = edits.filter((e) => e.keep);
  if (!kept.length) throw new Error('Keep at least one page.');
  const copied = await out.copyPages(src, kept.map((e) => e.index));
  copied.forEach((page, i) => {
    const angle = (page.getRotation().angle + kept[i].rotate) % 360;
    page.setRotation(degrees((angle + 360) % 360));
    out.addPage(page);
  });
  return out.save();
}

/** Parses "1-3, 5, 8-" style ranges into zero-based indices (1-based input). */
export function parseRanges(input: string, total: number): number[] {
  const out: number[] = [];
  for (const part of input.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part);
    const [start, end] = m ? [m[1] ? +m[1] : 1, m[2] ? +m[2] : total] : [+part, +part];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > total || start > end) {
      throw new Error(`Invalid range "${part}" (document has ${total} pages).`);
    }
    for (let i = start; i <= end; i++) out.push(i - 1);
  }
  return out;
}
