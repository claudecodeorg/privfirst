import { useState } from 'preact/hooks';
import { ALGORITHMS, digestAll, hashesMatch, type Algorithm } from './logic';

type Source = { kind: 'text'; text: string } | { kind: 'file'; name: string; bytes: Uint8Array };

export default function HashChecksum() {
  const [source, setSource] = useState<Source>({ kind: 'text', text: '' });
  const [results, setResults] = useState<Record<Algorithm, string> | null>(null);
  const [compareWith, setCompareWith] = useState('');
  const [busy, setBusy] = useState(false);

  const compute = async (s: Source) => {
    setBusy(true);
    const bytes = s.kind === 'text' ? new TextEncoder().encode(s.text) : s.bytes;
    setResults(bytes.length || s.kind === 'text' ? await digestAll(bytes) : null);
    setBusy(false);
  };

  const setText = (text: string) => { const s: Source = { kind: 'text', text }; setSource(s); void compute(s); };
  const setFile = async (f: File) => { const s: Source = { kind: 'file', name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }; setSource(s); void compute(s); };

  const bestMatch = results && compareWith.trim()
    ? (Object.keys(results) as Algorithm[]).find((a) => hashesMatch(results[a], compareWith))
    : undefined;

  return (
    <>
      <p class="muted">Computes checksums entirely on your device, for text or a whole file.</p>
      <div class="card">
        <div class="tabs" role="group" aria-label="Source">
          <button aria-pressed={source.kind === 'text'} onClick={() => setText('')}>Text</button>
          <button aria-pressed={source.kind === 'file'} onClick={() => setSource({ kind: 'file', name: '', bytes: new Uint8Array() })}>File</button>
        </div>
        {source.kind === 'text' ? (
          <textarea rows={5} class="mono" value={source.text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        ) : (
          <>
            <input type="file" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void setFile(f); }} />
            {source.name && <p class="muted">{source.name} ({source.bytes.length.toLocaleString()} bytes)</p>}
          </>
        )}
      </div>
      {busy && <p class="muted">Computing…</p>}
      {results && (
        <div class="card">
          {ALGORITHMS.map((a) => (
            <div class="row" key={a} style="margin-bottom:8px;align-items:center">
              <strong style="width:70px;flex:0 0 auto">{a}</strong>
              <span class="mono" style="flex:1;word-break:break-all">{results[a]}</span>
              <button aria-label={`Copy ${a}`} onClick={() => void navigator.clipboard?.writeText(results[a])}>Copy</button>
            </div>
          ))}
          <label class="field" style="margin-top:12px">Compare with a hash
            <input class="mono" value={compareWith} onInput={(e) => setCompareWith((e.target as HTMLInputElement).value)} placeholder="Paste a hash to check it matches" />
          </label>
          {compareWith.trim() && (bestMatch ? <p class="result" style="color:#22c55e">✓ Matches {bestMatch}</p> : <p class="error">✕ Does not match any algorithm shown above</p>)}
        </div>
      )}
    </>
  );
}
