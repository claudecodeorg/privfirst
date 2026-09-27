import { useMemo, useState } from 'preact/hooks';
import { computeDiff, type DiffMode } from './logic';

export default function TextDiff() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [mode, setMode] = useState<DiffMode>('lines');
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);

  const result = useMemo(() => computeDiff(a, b, { mode, ignoreCase, ignoreWhitespace }), [a, b, mode, ignoreCase, ignoreWhitespace]);
  const unitName = mode === 'lines' ? 'line' : mode === 'words' ? 'word' : 'character';
  const area = (label: string, v: string, set: (s: string) => void) => (
    <label class="field" style="flex:1 1 280px">{label}
      <textarea rows={10} value={v} spellcheck={false} onInput={(e) => set((e.target as HTMLTextAreaElement).value)} class="mono" />
    </label>
  );

  return (
    <>
      <p class="muted">Compare two texts entirely on your device.</p>
      <div class="row">{area('Original', a, setA)}{area('Changed', b, setB)}</div>
      <div class="card">
        <div class="row">
          <label>Compare by
            <select value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as DiffMode)}>
              <option value="lines">Lines</option><option value="words">Words</option><option value="chars">Characters</option>
            </select>
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
            <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase((e.target as HTMLInputElement).checked)} style="min-height:auto" /> Ignore case
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
            <input type="checkbox" checked={ignoreWhitespace} disabled={mode !== 'lines'} onChange={(e) => setIgnoreWhitespace((e.target as HTMLInputElement).checked)} style="min-height:auto" /> Ignore whitespace (lines)
          </label>
          <button onClick={() => { setA(b); setB(a); }}>Swap</button>
        </div>
      </div>
      <div class="card">
        {!a && !b ? <p class="muted">Paste text in both boxes to see differences.</p> : result.identical ? <p class="result">No differences</p> : (
          <>
            <p><span class="ins">+{result.added}</span> <span class="del">−{result.removed}</span> <span class="muted">{unitName}s · {result.unchanged} unchanged</span></p>
            <pre class="diff" aria-label="Diff output">{result.parts.map((p, i) =>
              p.added ? <ins key={i}>{p.value}</ins> : p.removed ? <del key={i}>{p.value}</del> : <span key={i}>{p.value}</span>)}</pre>
          </>
        )}
      </div>
    </>
  );
}
