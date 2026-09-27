export function percentOf(pct: number, whole: number): number { return (pct / 100) * whole; }
export function whatPercent(part: number, whole: number): number {
  if (whole === 0) throw new RangeError('Whole cannot be zero.');
  return (part / whole) * 100;
}
export function percentChange(from: number, to: number): number {
  if (from === 0) throw new RangeError('Starting value cannot be zero.');
  return ((to - from) / from) * 100;
}

export interface TipSplit { tipAmount: number; total: number; perPerson: number }
export type RoundMode = 'exact' | 'roundUpCent' | 'roundUpDollar';

export function splitTip(bill: number, tipPct: number, people: number, round: RoundMode = 'exact'): TipSplit {
  if (bill < 0 || tipPct < 0) throw new RangeError('Bill and tip must not be negative.');
  if (!Number.isInteger(people) || people < 1) throw new RangeError('People must be a whole number of at least 1.');
  const tipAmount = percentOf(tipPct, bill);
  const total = bill + tipAmount;
  let perPerson = total / people;
  if (round === 'roundUpCent') perPerson = Math.ceil(perPerson * 100) / 100;
  if (round === 'roundUpDollar') perPerson = Math.ceil(perPerson);
  return { tipAmount, total, perPerson };
}
