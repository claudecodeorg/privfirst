import { useEffect, useRef, useState } from 'preact/hooks';
import type { Match } from './logic';
import type { RegexResult } from './match.worker';

const TIMEOUT_MS = 800;
const FLAG_INFO: Record<string, string> = { i: 'ignore case', m: 'multiline ^$', s: 'dot matches newline', u: 'unicode' };

function newWorker(): Worker {
  return new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module' });
}

export default function RegexTester() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b');
  const [flags, setFlags] = useState('i');
  const [text, setText] = useState('Contact: jane@example.com or john@example.org');
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<number>();
  const watchdog = useRef<number>();

  useEffect(() => {
    worker.current = newWorker();
    return () => { worker.current?.terminate(); clearTimeout(timer.current); clearTimeout(watchdog.current); };
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!pattern) { setMatches([]); setError(''); return; }
    timer.current = window.setTimeout(() => {
      setRunning(true);
      const w = worker.current;
      if (!w) return;
      clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(() => {
        w.terminate(); // a hung regex.exec() can't be interrupted any other way
        worker.current = newWorker();
        setRunning(false);
        setError('This pattern took too long — it may be catastrophically slow on this input. Try a simpler pattern.');
        setMatches([]);
      }, TIMEOUT_MS);
      w.onmessage = (e: MessageEvent<RegexResult>) => {
        clearTimeout(watchdog.current);
        setRunning(false);
        if (e.data.ok) { setMatches(e.data.matches); setError(''); }
        else { setMatches([]); setError(e.data.error); }
      };
      w.postMessage({ pattern, flags, text });
    }, 150);
  }, [pattern, flags, text]);

  const toggleFlag = (f: string) => setFlags(flags.includes(f) ? flags.replace(f, '') : flags + f);

  const highlighted = [];
  let last = 0;
  matches.forEach((m, i) => {
    if (m.index > last) highlighted.push(<span key={`t${i}`}>{text.slice(last, m.index)}</span>);
    highlighted.push(<mark key={`m${i}`}>{m.match || '​'}</mark>);
    last = m.index + m.match.length;
  });
  if (last < text.length) highlighted.push(<span key="tail">{text.slice(last)}</span>);

  return (
    <>
      <p class="muted">Tested on your device. A watchdog stops runaway patterns so they can't freeze the tab.</p>
      <div class="card">
        <label class="field">Pattern
          <div class="row" style="margin:0">
            <span class="mono" style="align-self:center">/</span>
            <input class="mono" style="flex:1" value={pattern} onInput={(e) => setPattern((e.target as HTMLInputElement).value)} />
            <span class="mono" style="align-self:center">/{flags}</span>
          </div>
        </label>
        <div class="row" style="margin-top:8px">
          {['g', 'i', 'm', 's', 'u'].map((f) => (
            <label key={f} style="flex-direction:row;align-items:center;gap:4px;flex:0 0 auto" title={FLAG_INFO[f] ?? 'global (always on)'}>
              <input type="checkbox" checked={f === 'g' || flags.includes(f)} disabled={f === 'g'} style="min-height:auto"
                onChange={() => toggleFlag(f)} /> {f}
            </label>
          ))}
        </div>
      </div>
      <div class="card">
        <label class="field">Test text
          <textarea rows={6} class="mono" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        </label>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      {!error && (
        <div class="card">
          <p class="muted">{running ? 'Matching…' : `${matches.length} match${matches.length === 1 ? '' : 'es'}`}</p>
          <pre class="diff mono" style="white-space:pre-wrap">{highlighted}</pre>
          {matches.some((m) => m.groups.length || Object.keys(m.named).length) && (
            <div style="margin-top:12px">
              <strong>Groups</strong>
              {matches.map((m, i) => (
                <p key={i} class="mono muted">#{i}: {m.groups.map((g, j) => `[${j + 1}]=${JSON.stringify(g)}`).join(' ')} {Object.entries(m.named).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
