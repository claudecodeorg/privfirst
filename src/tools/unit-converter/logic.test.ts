import { describe, expect, it } from 'vitest';
import { categories, convert, formatNumber } from './logic';

const cat = (id: string) => categories.find((c) => c.id === id)!;

describe('convert', () => {
  it('converts length', () => {
    expect(convert(cat('length'), 'mi', 'km', 1)).toBeCloseTo(1.609344, 9);
    expect(convert(cat('length'), 'ft', 'in', 1)).toBeCloseTo(12, 9);
  });
  it('converts temperature both ways', () => {
    expect(convert(cat('temperature'), 'c', 'f', 100)).toBeCloseTo(212, 9);
    expect(convert(cat('temperature'), 'f', 'c', -40)).toBeCloseTo(-40, 9);
    expect(convert(cat('temperature'), 'k', 'c', 0)).toBeCloseTo(-273.15, 9);
    expect(convert(cat('temperature'), 'c', 'k', 25)).toBeCloseTo(298.15, 9);
  });
  it('distinguishes decimal and binary storage', () => {
    expect(convert(cat('data'), 'GB', 'MB', 1)).toBe(1000);
    expect(convert(cat('data'), 'GiB', 'MiB', 1)).toBe(1024);
    expect(convert(cat('data'), 'B', 'bit', 1)).toBe(8);
  });
  it('is reversible for every unit in every non-temperature category', () => {
    for (const c of categories.filter((c) => c.id !== 'temperature')) {
      for (const a of c.units) for (const b of c.units) {
        expect(convert(c, b.id, a.id, convert(c, a.id, b.id, 42.5))).toBeCloseTo(42.5, 6);
      }
    }
  });
  it('has unique unit ids per category', () => {
    for (const c of categories) expect(new Set(c.units.map((x) => x.id)).size).toBe(c.units.length);
  });
  it('throws on unknown units', () => expect(() => convert(cat('mass'), 'kg', 'nope', 1)).toThrow());
  it('converts speed and volume sanity checks', () => {
    expect(convert(cat('speed'), 'mph', 'kmh', 60)).toBeCloseTo(96.56064, 4);
    expect(convert(cat('volume'), 'gal', 'l', 1)).toBeCloseTo(3.785411784, 9);
  });
});

describe('formatNumber', () => {
  it('trims float noise', () => expect(formatNumber(0.1 + 0.2)).toBe('0.3'));
  it('uses exponents at extremes', () => {
    expect(formatNumber(1e20)).toBe('1e+20');
    expect(formatNumber(1.5e-9)).toBe('1.5e-9');
  });
  it('handles zero and non-finite', () => { expect(formatNumber(0)).toBe('0'); expect(formatNumber(NaN)).toBe('—'); });
});
