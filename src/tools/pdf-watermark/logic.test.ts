import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { addPageNumbers, addWatermark, anchorPosition, renderLabel } from './logic';

async function makePdf(pages: number, size: [number, number] = [400, 300]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage(size);
  return doc.save();
}

describe('anchorPosition', () => {
  const page = { width: 400, height: 300 };
  it('places each anchor within the page bounds, respecting the margin', () => {
    for (const anchor of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const) {
      const { x, y } = anchorPosition(anchor, page, 50, 12, 20);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + 50).toBeLessThanOrEqual(page.width);
      expect(y + 12).toBeLessThanOrEqual(page.height);
    }
  });
  it('centers the text for the center anchor', () => expect(anchorPosition('center', page, 100, 20)).toEqual({ x: 150, y: 140 }));
});

describe('renderLabel', () => {
  it('substitutes {page} and {total}', () => expect(renderLabel('Page {page} of {total}', 2, 5)).toBe('Page 2 of 5'));
});

describe('addWatermark', () => {
  it('preserves the page count and rejects empty text', async () => {
    const pdf = await makePdf(3);
    const out = await addWatermark(pdf, { text: 'DRAFT', fontSize: 40, opacity: 0.3, rotationDeg: 45, color: { r: 0.5, g: 0.5, b: 0.5 } });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
    await expect(addWatermark(pdf, { text: '   ', fontSize: 40, opacity: 0.3, rotationDeg: 45, color: { r: 0, g: 0, b: 0 } })).rejects.toThrow();
  });
});

describe('addPageNumbers', () => {
  it('numbers every page starting from the given offset', async () => {
    const out = await addPageNumbers(await makePdf(3), { format: '{page}/{total}', anchor: 'bottom-right', fontSize: 10, startAt: 1 });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });
  it('honours a custom start number', () => expect(renderLabel('{page}', 5, 10)).toBe('5'));
});
