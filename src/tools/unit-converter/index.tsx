import { useState } from 'preact/hooks';
import { categories, convert, formatNumber } from './logic';

export default function UnitConverter() {
  const [catId, setCatId] = useState('length');
  const cat = categories.find((c) => c.id === catId)!;
  const [from, setFrom] = useState(cat.units[0].id);
  const [to, setTo] = useState(cat.units[1].id);
  const [input, setInput] = useState('1');

  const pick = (id: string) => {
    const c = categories.find((x) => x.id === id)!;
    setCatId(id); setFrom(c.units[0].id); setTo(c.units[1].id);
  };
  const value = input.trim() === '' ? NaN : Number(input);
  const out = Number.isFinite(value) ? convert(cat, from, to, value) : NaN;
  const sel = (v: string, set: (s: string) => void, label: string) => (
    <label>{label}
      <select value={v} onChange={(e) => set((e.target as HTMLSelectElement).value)}>
        {cat.units.map((x) => <option value={x.id} key={x.id}>{x.label}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <div class="tabs" style="flex-wrap:wrap" role="group" aria-label="Category">
        {categories.map((c) => <button key={c.id} aria-pressed={c.id === catId} onClick={() => pick(c.id)}>{c.label}</button>)}
      </div>
      <div class="card">
        <div class="row">
          <label>Value<input inputMode="decimal" value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} /></label>
          {sel(from, setFrom, 'From')}
          <button aria-label="Swap units" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
          {sel(to, setTo, 'To')}
        </div>
        <p class="result" data-testid="result">{Number.isFinite(out) ? formatNumber(out) : <span class="error">Enter a number</span>}</p>
      </div>
      <div class="card">
        <div class="stats">
          {cat.units.filter((x) => x.id !== from).map((x) => (
            <div key={x.id}><b>{Number.isFinite(value) ? formatNumber(convert(cat, from, x.id, value)) : '—'}</b>{x.label}</div>
          ))}
        </div>
      </div>
    </>
  );
}
