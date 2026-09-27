// All arithmetic is done on UTC calendar dates so DST and local timezone never shift a result.

export interface YMD { y: number; m: number; d: number } // m is 1-12

const DAY_MS = 86_400_000;

export function parseISODate(s: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return daysInMonth(y, m) >= d && m >= 1 && m <= 12 && d >= 1 ? { y, m, d } : null;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const toMs = ({ y, m, d }: YMD) => Date.UTC(y, m - 1, d);
const fromMs = (ms: number): YMD => {
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

export function totalDaysBetween(a: YMD, b: YMD): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

/** Add months, clamping to the end of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: YMD, months: number): YMD {
  const idx = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(idx / 12);
  const m = (idx % 12 + 12) % 12 + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export interface Duration { years: number; months: number; days: number }

export function addDuration(date: YMD, dur: Duration, sign: 1 | -1): YMD {
  const withMonths = addMonths(date, sign * (dur.years * 12 + dur.months));
  return fromMs(toMs(withMonths) + sign * dur.days * DAY_MS);
}

export interface Difference {
  negative: boolean;
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  remainderDays: number;
  totalMonths: number;
  businessDays: number;
}

export function difference(from: YMD, to: YMD): Difference {
  const negative = toMs(to) < toMs(from);
  const [a, b] = negative ? [to, from] : [from, to];

  // Largest whole number of months that still fits before b.
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (toMs(addMonths(a, months)) > toMs(b)) months--;
  const days = totalDaysBetween(addMonths(a, months), b);
  const totalDays = totalDaysBetween(a, b);

  return {
    negative,
    years: Math.floor(months / 12),
    months: months % 12,
    days,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    remainderDays: totalDays % 7,
    totalMonths: months,
    businessDays: businessDaysBetween(a, b),
  };
}

/** Weekdays (Mon-Fri) in the half-open range [a, b). */
export function businessDaysBetween(a: YMD, b: YMD): number {
  const total = totalDaysBetween(a, b);
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  const startDow = new Date(toMs(a)).getUTCDay();
  for (let i = 0; i < total % 7; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function formatISO({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayISO(): string {
  const n = new Date();
  return formatISO({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
}
