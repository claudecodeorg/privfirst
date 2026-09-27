import { PDFDocument } from 'pdf-lib';

/** A redaction box in 0..1 fractions of the image/page it covers. */
export interface Box { x: number; y: number; width: number; height: number }

export function boxToPixels(box: Box, width: number, height: number): { x: number; y: number; width: number; height: number } {
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const x = Math.min(Math.round(clamp01(box.x) * width), width - 1);
  const y = Math.min(Math.round(clamp01(box.y) * height), height - 1);
  const w = Math.max(1, Math.min(Math.round(clamp01(box.width) * width), width - x));
  const h = Math.max(1, Math.min(Math.round(clamp01(box.height) * height), height - y));
  return { x, y, width: w, height: h };
}

/** Paints solid boxes directly into the canvas's pixels — this replaces the pixels underneath rather
 *  than drawing an overlay on top, so whatever was there cannot be recovered from the output. */
export function paintRedactions(ctx: CanvasRenderingContext2D, width: number, height: number, boxes: Box[], color = '#000'): void {
  ctx.fillStyle = color;
  for (const b of boxes) {
    const r = boxToPixels(b, width, height);
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
}

export interface RasterPage { png: Uint8Array; width: number; height: number }

/** Builds a new PDF entirely from page images. This is deliberate: a PDF page can carry selectable
 *  text underneath a visual redaction box, so the only reliable way to redact a PDF page is to
 *  flatten it to a picture — there is no text layer left for anything to extract. */
export async function buildRedactedPdf(pages: RasterPage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedPng(p.png);
    const page = doc.addPage([p.width, p.height]);
    page.drawImage(img, { x: 0, y: 0, width: p.width, height: p.height });
  }
  return doc.save();
}
