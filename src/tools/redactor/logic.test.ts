import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { boxToPixels, buildRedactedPdf } from './logic';

describe('boxToPixels', () => {
  it('converts a fractional box to pixels', () => expect(boxToPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 1000, 800)).toEqual({ x: 250, y: 400, width: 500, height: 200 }));
  it('clamps a box that runs past the edge', () => expect(boxToPixels({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, 1000, 1000)).toEqual({ x: 900, y: 900, width: 100, height: 100 }));
  it('never produces a zero-size box', () => expect(boxToPixels({ x: 0, y: 0, width: 0, height: 0 }, 100, 100)).toEqual({ x: 0, y: 0, width: 1, height: 1 }));
});

describe('buildRedactedPdf', () => {
  it('builds one page per image, at the given size', async () => {
    const png = new Uint8Array(await sharp({ create: { width: 300, height: 200, channels: 3, background: '#fff' } }).png().toBuffer());
    const out = await buildRedactedPdf([{ png, width: 300, height: 200 }, { png, width: 300, height: 200 }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 200 });
  });
  it('never gives a page any embedded fonts — nothing is drawn but the flattened image', async () => {
    const png = new Uint8Array(await sharp({ create: { width: 100, height: 100, channels: 3, background: '#fff' } }).png().toBuffer());
    const out = await buildRedactedPdf([{ png, width: 100, height: 100 }]);
    const doc = await PDFDocument.load(out);
    const fonts = doc.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
    expect(fonts === undefined || fonts.keys().length === 0).toBe(true);
  });
  it('sanity check: a normal drawn-text page DOES register a font, confirming the assertion above is meaningful', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([100, 100]);
    page.drawText('secret', { font, size: 12 });
    expect(page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict)?.keys().length).toBeGreaterThan(0);
  });
});
