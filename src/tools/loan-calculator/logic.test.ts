import { describe, expect, it } from 'vitest';
import { amortize, monthlyPayment } from './logic';

describe('monthlyPayment', () => {
  it('matches a hand-checked standard amortization example', () => {
    // $200,000 at 6% APR over 30 years (360 months) -> ~$1,199.10/month
    expect(monthlyPayment({ principal: 200_000, annualRatePct: 6, months: 360 })).toBeCloseTo(1199.1, 1);
  });
  it('is a plain division at 0% interest', () => expect(monthlyPayment({ principal: 12_000, annualRatePct: 0, months: 12 })).toBeCloseTo(1000, 6));
  it('rejects invalid input', () => {
    expect(() => monthlyPayment({ principal: 0, annualRatePct: 5, months: 12 })).toThrow();
    expect(() => monthlyPayment({ principal: 100, annualRatePct: -1, months: 12 })).toThrow();
    expect(() => monthlyPayment({ principal: 100, annualRatePct: 5, months: 0 })).toThrow();
  });
});

describe('amortize', () => {
  it('pays off exactly at term with no extra payments, and totals add up', () => {
    const r = amortize({ principal: 10_000, annualRatePct: 5, months: 24 });
    expect(r.schedule).toHaveLength(24);
    expect(r.schedule.at(-1)!.balance).toBeCloseTo(0, 2);
    expect(r.totalPaid).toBeCloseTo(r.schedule.reduce((s, row) => s + row.payment, 0), 6);
    expect(r.totalPaid - r.totalInterest).toBeCloseTo(10_000, 1);
  });
  it('pays off sooner with an extra payment', () => {
    const base = amortize({ principal: 10_000, annualRatePct: 5, months: 24 });
    const faster = amortize({ principal: 10_000, annualRatePct: 5, months: 24, extraPayment: 200 });
    expect(faster.payoffMonths).toBeLessThan(base.payoffMonths);
    expect(faster.totalInterest).toBeLessThan(base.totalInterest);
  });
  it('never lets the balance go negative even on the last payment', () => {
    const r = amortize({ principal: 100, annualRatePct: 10, months: 3, extraPayment: 1000 });
    expect(r.schedule.every((row) => row.balance >= 0)).toBe(true);
    expect(r.payoffMonths).toBe(1);
  });
});
