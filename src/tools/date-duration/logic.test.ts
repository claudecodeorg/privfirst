import { describe, expect, it } from 'vitest';
import { addDuration, addMonths, businessDaysBetween, difference, parseISODate } from './logic';

const d = (s: string) => parseISODate(s)!;

describe('parseISODate', () => {
  it('rejects invalid dates', () => {
    expect(parseISODate('2023-02-29')).toBeNull();
    expect(parseISODate('2023-13-01')).toBeNull();
    expect(parseISODate('nope')).toBeNull();
  });
  it('accepts leap days', () => expect(parseISODate('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 }));
});

describe('difference', () => {
  it('computes years/months/days', () => {
    const r = difference(d('2020-01-15'), d('2024-03-20'));
    expect([r.years, r.months, r.days]).toEqual([4, 2, 5]);
  });
  it('handles month-end borrowing', () => {
    const r = difference(d('2024-01-31'), d('2024-03-01'));
    expect([r.years, r.months, r.days]).toEqual([1 - 1, 1, 1]);
    expect(r.totalDays).toBe(30);
  });
  it('marks negative ranges and mirrors the result', () => {
    const r = difference(d('2024-03-20'), d('2020-01-15'));
    expect(r.negative).toBe(true);
    expect([r.years, r.months, r.days]).toEqual([4, 2, 5]);
  });
  it('is zero for identical dates', () => expect(difference(d('2024-05-05'), d('2024-05-05')).totalDays).toBe(0));
  it('counts a leap year as 366 days', () => expect(difference(d('2024-01-01'), d('2025-01-01')).totalDays).toBe(366));
});

describe('addMonths / addDuration', () => {
  it('clamps to month end', () => {
    expect(addMonths(d('2024-01-31'), 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addMonths(d('2023-01-31'), 1)).toEqual({ y: 2023, m: 2, d: 28 });
  });
  it('subtracts across year boundaries', () => expect(addMonths(d('2024-01-15'), -2)).toEqual({ y: 2023, m: 11, d: 15 }));
  it('adds and subtracts full durations', () => {
    expect(addDuration(d('2024-01-31'), { years: 1, months: 1, days: 10 }, 1)).toEqual({ y: 2025, m: 3, d: 10 });
    expect(addDuration(d('2024-03-10'), { years: 0, months: 0, days: 10 }, -1)).toEqual({ y: 2024, m: 2, d: 29 });
  });
});

describe('businessDaysBetween', () => {
  it('counts Mon-Fri in [a, b)', () => {
    expect(businessDaysBetween(d('2024-01-01'), d('2024-01-08'))).toBe(5); // Mon -> next Mon
    expect(businessDaysBetween(d('2024-01-06'), d('2024-01-08'))).toBe(0); // Sat, Sun
  });
});
