export interface LoanInput { principal: number; annualRatePct: number; months: number; extraPayment?: number }
export interface ScheduleRow { period: number; payment: number; principal: number; interest: number; balance: number }
export interface LoanResult { monthlyPayment: number; totalPaid: number; totalInterest: number; schedule: ScheduleRow[]; payoffMonths: number }

export function monthlyPayment({ principal, annualRatePct, months }: LoanInput): number {
  if (principal <= 0 || months <= 0) throw new RangeError('Principal and term must be positive.');
  if (annualRatePct < 0) throw new RangeError('Rate cannot be negative.');
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
}

/** Amortizes the loan, applying any extra payment to principal each period; stops early if paid off sooner. */
export function amortize(input: LoanInput): LoanResult {
  const payment = monthlyPayment(input);
  const r = input.annualRatePct / 100 / 12;
  const extra = Math.max(0, input.extraPayment ?? 0);
  let balance = input.principal;
  const schedule: ScheduleRow[] = [];
  for (let period = 1; period <= input.months && balance > 0.005; period++) {
    const interest = balance * r;
    let principalPaid = payment - interest + extra;
    if (principalPaid > balance) principalPaid = balance;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ period, payment: interest + principalPaid, principal: principalPaid, interest, balance });
  }
  const totalPaid = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  return { monthlyPayment: payment, totalPaid, totalInterest, schedule, payoffMonths: schedule.length };
}
