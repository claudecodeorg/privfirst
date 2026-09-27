import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { editPdf, mergePdfs, pageCount, parseRanges } from './logic';

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]);
  return doc.save();
}

describe('mergePdfs', () => {
  it('concatenates pages in order', async () => {
    const merged = await mergePdfs([await makePdf(2), await makePdf(3)]);
    expect(await pageCount(merged)).toBe(5);
  });
});

describe('editPdf', () => {
  it('reorders, deletes and rotates', async () => {
    const out = await editPdf(await makePdf(3), [
      { index: 2, rotate: 90, keep: true },
      { index: 1, rotate: 0, keep: false },
      { index: 0, rotate: 0, keep: true },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(202); // original page 3 first
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });
  it('normalises negative rotation', async () => {
    const out = await editPdf(await makePdf(1), [{ index: 0, rotate: -90, keep: true }]);
    expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(270);
  });
  it('refuses to produce an empty document', async () => {
    await expect(editPdf(await makePdf(1), [{ index: 0, rotate: 0, keep: false }])).rejects.toThrow();
  });
});

describe('parseRanges', () => {
  it('parses lists and open ranges', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([0, 1, 2, 4]);
    expect(parseRanges('8-', 10)).toEqual([7, 8, 9]);
    expect(parseRanges('-2', 10)).toEqual([0, 1]);
  });
  it('rejects out-of-bounds input', () => {
    expect(() => parseRanges('0', 5)).toThrow();
    expect(() => parseRanges('3-9', 5)).toThrow();
    expect(() => parseRanges('abc', 5)).toThrow();
  });
});
