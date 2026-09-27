import { useState } from 'preact/hooks';
import { percentChange, percentOf, splitTip, whatPercent, type RoundMode } from './logic';

export default function PercentageTip() {
  const [mode, setMode] = useState<'percent' | 'tip'>('percent');
  return (
    <>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'percent'} onClick={() => setMode('percent')}>Percentage</button>
        <button aria-pressed={mode === 'tip'} onClick={() => setMode('tip')}>Tip split</button>
      </div>
      {mode === 'percent' ? <Percent /> : <Tip />}
    </>
  );
}

function Percent() {
  const [a, setA] = useState('20');
  const [b, setB] = useState('50');
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

  return (
    <>
      <div class="card">
        <p class="muted">What is {a || '?'}% of {b || '?'}?</p>
        <div class="row"><label>Percent<input inputMode="decimal" value={a} onInput={(e) => setA((e.target as HTMLInputElement).value)} /></label>
          <label>Of<input inputMode="decimal" value={b} onInput={(e) => setB((e.target as HTMLInputElement).value)} /></label></div>
        <p class="result">{Number.isFinite(num(a)) && Number.isFinite(num(b)) ? percentOf(num(a), num(b)).toLocaleString() : '—'}</p>
      </div>
      <div class="card">
        <p class="muted">{a || '?'} is what percent of {b || '?'}?</p>
        <p class="result">{Number.isFinite(num(a)) && Number.isFinite(num(b)) && num(b) !== 0 ? `${whatPercent(num(a), num(b)).toLocaleString()}%` : '—'}</p>
      </div>
      <div class="card">
        <p class="muted">Percent change from {a || '?'} to {b || '?'}</p>
        <p class="result">{Number.isFinite(num(a)) && Number.isFinite(num(b)) && num(a) !== 0 ? `${percentChange(num(a), num(b)).toFixed(2)}%` : '—'}</p>
      </div>
    </>
  );
}

function Tip() {
  const [bill, setBill] = useState('50');
  const [pct, setPct] = useState('18');
  const [people, setPeople] = useState('2');
  const [round, setRound] = useState<RoundMode>('exact');
  const b = Number(bill), t = Number(pct), n = Math.round(Number(people));
  let result: ReturnType<typeof splitTip> | null = null;
  try { if (bill && pct && people) result = splitTip(b, t, n, round); } catch { /* invalid input, show nothing */ }

  return (
    <div class="card">
      <div class="row">
        <label>Bill<input inputMode="decimal" value={bill} onInput={(e) => setBill((e.target as HTMLInputElement).value)} /></label>
        <label>Tip %<input inputMode="decimal" value={pct} onInput={(e) => setPct((e.target as HTMLInputElement).value)} /></label>
        <label>People<input inputMode="numeric" value={people} onInput={(e) => setPeople((e.target as HTMLInputElement).value)} /></label>
        <label>Rounding
          <select value={round} onChange={(e) => setRound((e.target as HTMLSelectElement).value as RoundMode)}>
            <option value="exact">Exact</option><option value="roundUpCent">Round up to the cent</option><option value="roundUpDollar">Round up to the dollar</option>
          </select>
        </label>
      </div>
      {result ? (
        <div class="stats" style="margin-top:12px">
          <div><b>{result.tipAmount.toFixed(2)}</b>tip</div>
          <div><b>{result.total.toFixed(2)}</b>total</div>
          <div><b>{result.perPerson.toFixed(2)}</b>per person</div>
        </div>
      ) : <p class="error" style="margin-top:12px">Enter a bill, tip percentage, and at least one person.</p>}
    </div>
  );
}
