import { useState } from 'preact/hooks';
import { addDuration, difference, formatISO, parseISODate, todayISO } from './logic';

type Mode = 'between' | 'add';
const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

export default function DateDuration() {
  const [mode, setMode] = useState<Mode>('between');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [op, setOp] = useState<'1' | '-1'>('1');
  const [amt, setAmt] = useState({ years: '0', months: '0', days: '30' });

  const a = parseISODate(from);
  const b = parseISODate(to);

  return (
    <>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'between'} onClick={() => setMode('between')}>Between two dates</button>
        <button aria-pressed={mode === 'add'} onClick={() => setMode('add')}>Add / subtract</button>
      </div>

      {mode === 'between' ? (
        <div class="card">
          <div class="row">
            <label>Start date<input type="date" value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} /></label>
            <label>End date<input type="date" value={to} onInput={(e) => setTo((e.target as HTMLInputElement).value)} /></label>
            <button onClick={() => { setFrom(to); setTo(from); }}>Swap</button>
          </div>
          {a && b ? <Between from={a} to={b} /> : <p class="error">Enter two valid dates.</p>}
        </div>
      ) : (
        <div class="card">
          <div class="row">
            <label>Start date<input type="date" value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} /></label>
            <label>Operation
              <select value={op} onChange={(e) => setOp((e.target as HTMLSelectElement).value as '1' | '-1')}>
                <option value="1">Add</option>
                <option value="-1">Subtract</option>
              </select>
            </label>
          </div>
          <div class="row" style="margin-top:12px">
            {(['years', 'months', 'days'] as const).map((k) => (
              <label key={k}>{k[0].toUpperCase() + k.slice(1)}
                <input type="number" min="0" inputMode="numeric" value={amt[k]}
                  onInput={(e) => setAmt({ ...amt, [k]: (e.target as HTMLInputElement).value })} />
              </label>
            ))}
          </div>
          {a ? (
            <p class="result">
              {formatISO(addDuration(a, { years: num(amt.years), months: num(amt.months), days: num(amt.days) }, Number(op) as 1 | -1))}
            </p>
          ) : <p class="error">Enter a valid start date.</p>}
        </div>
      )}
    </>
  );
}

function Between({ from, to }: { from: ReturnType<typeof parseISODate> & object; to: ReturnType<typeof parseISODate> & object }) {
  const r = difference(from, to);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return (
    <>
      <p class="result">
        {[plural(r.years, 'year'), plural(r.months, 'month'), plural(r.days, 'day')].join(', ')}
        {r.negative && <span class="muted"> (end is before start)</span>}
      </p>
      <div class="stats">
        <div><b>{r.totalDays.toLocaleString()}</b>total days</div>
        <div><b>{r.totalWeeks.toLocaleString()} w {r.remainderDays} d</b>weeks + days</div>
        <div><b>{r.totalMonths.toLocaleString()}</b>total months</div>
        <div><b>{r.businessDays.toLocaleString()}</b>weekdays (Mon–Fri)</div>
      </div>
    </>
  );
}
