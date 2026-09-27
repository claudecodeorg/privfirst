import { useMemo, useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { amortize } from './logic';

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export default function LoanCalculator() {
  const [principal, setPrincipal] = useState('20000');
  const [rate, setRate] = useState('6');
  const [years, setYears] = useState('5');
  const [extra, setExtra] = useState('0');
  const [showSchedule, setShowSchedule] = useState(false);

  const result = useMemo(() => {
    const p = Number(principal), r = Number(rate), months = Math.round(Number(years) * 12), e = Number(extra);
    if (!(p > 0) || !(r >= 0) || !(months > 0)) return null;
    try { return amortize({ principal: p, annualRatePct: r, months, extraPayment: e }); } catch { return null; }
  }, [principal, rate, years, extra]);

  const csv = () => {
    if (!result) return;
    const rows = ['Period,Payment,Principal,Interest,Balance', ...result.schedule.map((r) => `${r.period},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`)];
    downloadBlob(new Blob([rows.join('\n')]), 'amortization-schedule.csv');
  };

  return (
    <>
      <p class="muted">Loan payment and amortization, computed on your device.</p>
      <div class="card">
        <div class="row">
          <label>Loan amount<input inputMode="decimal" value={principal} onInput={(e) => setPrincipal((e.target as HTMLInputElement).value)} /></label>
          <label>Annual rate (%)<input inputMode="decimal" value={rate} onInput={(e) => setRate((e.target as HTMLInputElement).value)} /></label>
          <label>Term (years)<input inputMode="decimal" value={years} onInput={(e) => setYears((e.target as HTMLInputElement).value)} /></label>
          <label>Extra monthly payment<input inputMode="decimal" value={extra} onInput={(e) => setExtra((e.target as HTMLInputElement).value)} /></label>
        </div>
      </div>
      {result ? (
        <div class="card">
          <p class="result">{money(result.monthlyPayment)}/month</p>
          <div class="stats">
            <div><b>{result.payoffMonths}</b>months to pay off</div>
            <div><b>{money(result.totalInterest)}</b>total interest</div>
            <div><b>{money(result.totalPaid)}</b>total paid</div>
          </div>
          <div class="row" style="margin-top:12px">
            <button onClick={() => setShowSchedule(!showSchedule)}>{showSchedule ? 'Hide' : 'Show'} amortization schedule</button>
            <button onClick={csv}>Download CSV</button>
          </div>
          {showSchedule && (
            <div style="max-height:360px;overflow:auto;margin-top:12px">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                <thead><tr><th style="text-align:left">#</th><th style="text-align:right">Payment</th><th style="text-align:right">Principal</th><th style="text-align:right">Interest</th><th style="text-align:right">Balance</th></tr></thead>
                <tbody>
                  {result.schedule.map((r) => (
                    <tr key={r.period}><td>{r.period}</td><td style="text-align:right">{money(r.payment)}</td><td style="text-align:right">{money(r.principal)}</td><td style="text-align:right">{money(r.interest)}</td><td style="text-align:right">{money(r.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : <p class="error">Enter a positive loan amount and term.</p>}
    </>
  );
}
