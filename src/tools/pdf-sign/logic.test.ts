import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { embedSignature, toPdfRect } from './logic';

describe('toPdfRect', () => {
  it('converts a top-left, screen-style position to PDF coordinates', () => {
    // A 400x200 page, signature placed flush at the top-left, half the page wide, 2:1 aspect.
    expect(toPdfRect({ xFrac: 0, yFrac: 0, widthFrac: 0.5 }, 400, 200, 2)).toEqual({ x: 0, y: 100, width: 200, height: 100 });
  });
  it('flips the y-axis: near the top on screen means near the top of the page (high y in PDF space)', () => {
    const near0 = toPdfRect({ xFrac: 0, yFrac: 0.1, widthFrac: 0.2 }, 400, 200, 1);
    const near1 = toPdfRect({ xFrac: 0, yFrac: 0.8, widthFrac: 0.2 }, 400, 200, 1);
    expect(near0.y).toBeGreaterThan(near1.y);
  });
  it('derives height from width and aspect ratio', () => {
    expect(toPdfRect({ xFrac: 0, yFrac: 0, widthFrac: 0.25 }, 800, 600, 4).height).toBeCloseTo(50, 5);
  });
});

async function signaturePng(): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 200, alpha: 255 } } }).png().toBuffer());
}
async function pdfPage(width = 400, height = 300): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return doc.save();
}

describe('embedSignature', () => {
  it('embeds the signature image onto the chosen page, without changing the page count', async () => {
    const out = await embedSignature(await pdfPage(), 0, await signaturePng(), { xFrac: 0.1, yFrac: 0.7, widthFrac: 0.3 });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    const text = Buffer.from(out).toString('latin1');
    expect(text).toContain('/Subtype /Image'); // the embedded PNG shows up as an image XObject
  });
  it('rejects an out-of-range page index', async () => {
    await expect(embedSignature(await pdfPage(), 5, await signaturePng(), { xFrac: 0, yFrac: 0, widthFrac: 0.3 })).rejects.toThrow();
  });
});
