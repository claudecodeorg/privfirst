import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type Anchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number; // 0..1
  rotationDeg: number;
  color: { r: number; g: number; b: number }; // 0..1
}

/** Position for `text` (already measured) anchored on a page of the given size. */
export function anchorPosition(anchor: Anchor, page: { width: number; height: number }, textWidth: number, textHeight: number, margin = 24): { x: number; y: number } {
  const { width, height } = page;
  switch (anchor) {
    case 'top-left': return { x: margin, y: height - margin - textHeight };
    case 'top-right': return { x: width - margin - textWidth, y: height - margin - textHeight };
    case 'bottom-left': return { x: margin, y: margin };
    case 'bottom-right': return { x: width - margin - textWidth, y: margin };
    case 'center': return { x: (width - textWidth) / 2, y: (height - textHeight) / 2 };
  }
}

export async function addWatermark(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  if (!opts.text.trim()) throw new Error('Enter some watermark text.');
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(opts.text, opts.fontSize);
    page.drawText(opts.text, {
      x: (width - w) / 2, y: (height - opts.fontSize) / 2, size: opts.fontSize, font,
      color: rgb(opts.color.r, opts.color.g, opts.color.b), opacity: opts.opacity, rotate: degrees(opts.rotationDeg),
    });
  }
  return doc.save();
}

export interface PageNumberOptions {
  format: string; // uses {page} and {total}
  anchor: Anchor;
  fontSize: number;
  startAt: number;
}

export function renderLabel(format: string, page: number, total: number): string {
  return format.replace(/\{page\}/g, String(page)).replace(/\{total\}/g, String(total));
}

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const label = renderLabel(opts.format, opts.startAt + i, pages.length);
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(label, opts.fontSize);
    const { x, y } = anchorPosition(opts.anchor, { width, height }, w, opts.fontSize);
    page.drawText(label, { x, y, size: opts.fontSize, font, color: rgb(0, 0, 0) });
  });
  return doc.save();
}
