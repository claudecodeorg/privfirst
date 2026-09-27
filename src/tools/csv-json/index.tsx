import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { csvToJson, jsonToCsv } from './logic';

export default function CsvJson() {
  const [mode, setMode] = useState<'toJson' | 'toCsv'>('toJson');
  const [delimiter, setDelimiter] = useState(',');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const convert = () => {
    try {
      if (mode === 'toJson') setOutput(JSON.stringify(csvToJson(input, delimiter), null, 2));
      else {
        const data = JSON.parse(input);
        if (!Array.isArray(data)) throw new Error('Expected a JSON array of objects.');
        setOutput(jsonToCsv(data, delimiter));
      }
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setOutput(''); }
  };

  return (
    <>
      <p class="muted">Converts CSV and JSON on your device.</p>
      <div class="tabs" role="group" aria-label="Direction">
        <button aria-pressed={mode === 'toJson'} onClick={() => { setMode('toJson'); setOutput(''); setError(''); }}>CSV → JSON</button>
        <button aria-pressed={mode === 'toCsv'} onClick={() => { setMode('toCsv'); setOutput(''); setError(''); }}>JSON → CSV</button>
      </div>
      <div class="card">
        <label class="field">{mode === 'toJson' ? 'CSV input (first row is the header)' : 'JSON input (an array of objects)'}
          <textarea rows={8} class="mono" value={input} onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="row" style="margin-top:12px">
          <label>Delimiter
            <select value={delimiter} onChange={(e) => setDelimiter((e.target as HTMLSelectElement).value)}>
              <option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value={'\t'}>Tab</option>
            </select>
          </label>
          <button class="primary" onClick={convert}>Convert</button>
        </div>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      {output && (
        <div class="card">
          <pre class="diff mono" style="max-height:400px;overflow:auto">{output}</pre>
          <div class="row" style="margin-top:8px">
            <button onClick={() => void navigator.clipboard?.writeText(output)}>Copy</button>
            <button onClick={() => downloadBlob(new Blob([output]), mode === 'toJson' ? 'data.json' : 'data.csv')}>Download</button>
          </div>
        </div>
      )}
    </>
  );
}
