import { describe, expect, it } from 'vitest';
import { percentChange, percentOf, splitTip, whatPercent } from './logic';

describe('percentOf / whatPercent / percentChange', () => {
  it('computes basic percentages', () => {
    expect(percentOf(20, 50)).toBe(10);
    expect(whatPercent(10, 50)).toBe(20);
    expect(percentChange(50, 60)).toBe(20);
    expect(percentChange(50, 40)).toBe(-20);
  });
  it('rejects a zero denominator', () => {
    expect(() => whatPercent(5, 0)).toThrow();
    expect(() => percentChange(0, 5)).toThrow();
  });
});

describe('splitTip', () => {
  it('splits a bill evenly with an exact result', () => {
    const r = splitTip(100, 20, 4);
    expect(r.tipAmount).toBe(20);
    expect(r.total).toBe(120);
    expect(r.perPerson).toBe(30);
  });
  it('rounds each person up to the nearest cent when asked', () => {
    const r = splitTip(100, 15, 3, 'roundUpCent');
    expect(r.perPerson).toBeCloseTo(38.34, 2);
    expect(r.perPerson * 100).toBeCloseTo(Math.round(r.perPerson * 100), 6);
  });
  it('rounds each person up to a whole dollar when asked', () => {
    expect(splitTip(100, 0, 3, 'roundUpDollar').perPerson).toBe(34);
  });
  it('rejects invalid input', () => {
    expect(() => splitTip(-1, 10, 2)).toThrow();
    expect(() => splitTip(10, 10, 0)).toThrow();
    expect(() => splitTip(10, 10, 1.5)).toThrow();
  });
});
