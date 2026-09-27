import { describe, expect, it } from 'vitest';
import { fitToPage, pageDimsFor, sanitizeBaseName } from './logic';

describe('pageDimsFor', () => {
  it('"fit" matches the image exactly', () => expect(pageDimsFor(300, 400, 'fit')).toEqual({ width: 300, height: 400 }));
  it('picks portrait A4 for a portrait image, landscape A4 for a landscape image', () => {
    expect(pageDimsFor(300, 400, 'a4')).toEqual({ width: 595.28, height: 841.89 });
    expect(pageDimsFor(400, 300, 'a4')).toEqual({ width: 841.89, height: 595.28 });
  });
  it('supports letter size', () => expect(pageDimsFor(300, 400, 'letter')).toEqual({ width: 612, height: 792 }));
});

describe('fitToPage', () => {
  it('scales a large image down to fit, preserving aspect ratio', () => {
    const r = fitToPage(2000, 1000, 595, 842, 0);
    expect(r.width).toBeCloseTo(595, 5);
    expect(r.height).toBeCloseTo(297.5, 5);
    expect(r.x).toBeCloseTo(0, 5);
  });
  it('never upscales a small image', () => {
    const r = fitToPage(100, 100, 595, 842);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
  });
  it('centers within the page', () => {
    const r = fitToPage(100, 100, 500, 500);
    expect(r.x).toBeCloseTo(200, 5);
    expect(r.y).toBeCloseTo(200, 5);
  });
  it('respects a margin', () => {
    const r = fitToPage(1000, 1000, 500, 500, 50);
    expect(r.width).toBeCloseTo(400, 5);
  });
});

describe('sanitizeBaseName', () => {
  it('strips the extension and unsafe characters', () => expect(sanitizeBaseName('My Report (final)/v2.pdf')).toBe('My_Report_final_v2'));
  it('falls back to "page" for an empty result', () => expect(sanitizeBaseName('???.pdf')).toBe('page'));
});
