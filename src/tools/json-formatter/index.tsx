import { useState } from 'preact/hooks';
import { describeError, format, minify, parseJson, sortKeysDeep } from './logic';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [indent, setIndent] = useState(2);
  const [sort, setSort] = useState(false);

  const run = (fn: (t: string) => string) => {
    try {
      const text = sort ? JSON.stringify(sortKeysDeep(JSON.parse(input)), null, fn === minify ? undefined : indent) : fn(input);
      setOutput(text); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setOutput(''); }
  };

  const validate = () => {
    const r = parseJson(input);
    setOutput(''); setError('error' in r ? describeError(r.error) : '✓ Valid JSON.');
  };

  return (
    <>
      <p class="muted">Formats, minifies and validates JSON on your device.</p>
      <div class="card">
        <textarea rows={10} class="mono" placeholder="Paste JSON…" value={input} onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />
        <div class="row" style="margin-top:12px">
          <label>Indent
            <select value={indent} onChange={(e) => setIndent(Number((e.target as HTMLSelectElement).value))}>
              <option value={2}>2 spaces</option><option value={4}>4 spaces</option><option value={1}>Tab-like (1)</option>
            </select>
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
            <input type="checkbox" checked={sort} style="min-height:auto" onChange={(e) => setSort((e.target as HTMLInputElement).checked)} /> Sort keys
          </label>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="primary" onClick={() => run((t) => format(t, indent))}>Format</button>
          <button class="primary" onClick={() => run(minify)}>Minify</button>
          <button onClick={validate}>Validate</button>
        </div>
      </div>
      <div class="card">
        {error && <p class={error.startsWith('✓') ? 'result' : 'error'} role="alert">{error}</p>}
        {output && (
          <>
            <pre class="diff mono" style="max-height:400px;overflow:auto">{output}</pre>
            <div class="row" style="margin-top:8px">
              <button onClick={() => void navigator.clipboard?.writeText(output)}>Copy</button>
              <button onClick={() => setInput(output)}>Use as input</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
