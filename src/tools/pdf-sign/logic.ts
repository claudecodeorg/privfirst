import { PDFDocument } from 'pdf-lib';

/** Position and size of a placed signature, as fractions of the page — xFrac/yFrac is the top-left
 *  corner measured screen-style (yFrac from the TOP), matching how it's dragged on a rendered preview. */
export interface PlacedSignature { xFrac: number; yFrac: number; widthFrac: number }

export function toPdfRect(placed: PlacedSignature, pageWidth: number, pageHeight: number, signatureAspect: number): { x: number; y: number; width: number; height: number } {
  const width = placed.widthFrac * pageWidth;
  const height = width / signatureAspect;
  const x = placed.xFrac * pageWidth;
  const y = pageHeight - placed.yFrac * pageHeight - height; // PDF y is measured from the bottom
  return { x, y, width, height };
}

export async function embedSignature(pdfBytes: Uint8Array, pageIndex: number, signaturePng: Uint8Array, placed: PlacedSignature): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  if (pageIndex < 0 || pageIndex >= pages.length) throw new RangeError('That page does not exist in this document.');
  const page = pages[pageIndex];
  const png = await doc.embedPng(signaturePng);
  const rect = toPdfRect(placed, page.getWidth(), page.getHeight(), png.width / png.height);
  page.drawImage(png, rect);
  return doc.save();
}
