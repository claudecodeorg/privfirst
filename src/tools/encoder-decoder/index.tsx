import { useState } from 'preact/hooks';
import { decode, encode, type Mode } from './logic';

const LABELS: Record<Mode, string> = { base64: 'Base64', base64url: 'Base64 (URL-safe)', url: 'URL / percent-encoding', hex: 'Hex' };

export default function EncoderDecoder() {
  const [mode, setMode] = useState<Mode>('base64');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const run = (fn: typeof encode | typeof decode) => {
    try { setOutput(fn(mode, input)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setOutput(''); }
  };

  return (
    <>
      <p class="muted">Converts text on your device. Nothing is sent anywhere.</p>
      <div class="card">
        <div class="row">
          <label>Format
            <select value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
              {(Object.keys(LABELS) as Mode[]).map((m) => <option value={m} key={m}>{LABELS[m]}</option>)}
            </select>
          </label>
        </div>
        <label class="field" style="margin-top:12px">Input
          <textarea rows={5} class="mono" value={input} onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="row" style="margin-top:12px">
          <button class="primary" onClick={() => run(encode)}>Encode →</button>
          <button class="primary" onClick={() => run(decode)}>Decode →</button>
          <button onClick={() => { setInput(output); setOutput(''); setError(''); }} disabled={!output}>Use output as input</button>
        </div>
      </div>
      <div class="card">
        {error ? <p class="error" role="alert">{error}</p> : (
          <>
            <p class="result mono" style="word-break:break-all" data-testid="output">{output || <span class="muted">Output appears here.</span>}</p>
            <button onClick={() => void navigator.clipboard?.writeText(output)} disabled={!output}>Copy</button>
          </>
        )}
      </div>
    </>
  );
}
