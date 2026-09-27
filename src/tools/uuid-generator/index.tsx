import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { generate, type Version } from './logic';

export default function UuidGenerator() {
  const [version, setVersion] = useState<Version>('v4');
  const [count, setCount] = useState(5);
  const [ids, setIds] = useState<string[]>(() => generate('v4', 5));
  const [uppercase, setUppercase] = useState(false);
  const [copied, setCopied] = useState(false);

  const regen = (v = version, c = count) => setIds(generate(v, c));
  const shown = ids.map((id) => (uppercase ? id.toUpperCase() : id));

  return (
    <>
      <p class="muted">Generated with your device's cryptographic random source.</p>
      <div class="card">
        <div class="row">
          <label>Version
            <select value={version} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as Version; setVersion(v); regen(v); }}>
              <option value="v4">v4 (random)</option><option value="v7">v7 (time-ordered)</option>
            </select>
          </label>
          <label>Count
            <input type="number" min="1" max="1000" value={count} onInput={(e) => { const c = Math.max(1, Math.min(1000, Number((e.target as HTMLInputElement).value) || 1)); setCount(c); regen(version, c); }} />
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
            <input type="checkbox" checked={uppercase} style="min-height:auto" onChange={(e) => setUppercase((e.target as HTMLInputElement).checked)} /> Uppercase
          </label>
        </div>
        <p><button class="primary" onClick={() => regen()}>Regenerate</button></p>
      </div>
      <div class="card">
        <textarea class="mono" rows={Math.min(15, shown.length)} readOnly value={shown.join('\n')} />
        <div class="row" style="margin-top:8px">
          <button onClick={async () => { await navigator.clipboard?.writeText(shown.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy all'}</button>
          <button onClick={() => downloadBlob(new Blob([shown.join('\n') + '\n']), 'uuids.txt')}>Download .txt</button>
        </div>
      </div>
    </>
  );
}
