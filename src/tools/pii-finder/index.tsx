import { useMemo, useState } from 'preact/hooks';
import { findPii, redact, type PiiType, type RedactStyle } from './logic';

const LABEL: Record<PiiType, string> = { email: 'Email addresses', phone: 'Phone numbers', 'credit-card': 'Card numbers', ip: 'IP addresses', ssn: 'SSNs' };

export default function PiiFinder() {
  const [text, setText] = useState('');
  const [style, setStyle] = useState<RedactStyle>('placeholder');
  const findings = useMemo(() => findPii(text), [text]);

  const counts = useMemo(() => {
    const c: Partial<Record<PiiType, number>> = {};
    for (const f of findings) c[f.type] = (c[f.type] ?? 0) + 1;
    return c;
  }, [findings]);

  const highlighted = useMemo(() => {
    const parts = [];
    let last = 0;
    findings.forEach((f, i) => {
      if (f.start > last) parts.push(<span key={`t${i}`}>{text.slice(last, f.start)}</span>);
      parts.push(<mark key={`m${i}`} title={f.type}>{f.text}</mark>);
      last = f.end;
    });
    if (last < text.length) parts.push(<span key="tail">{text.slice(last)}</span>);
    return parts;
  }, [text, findings]);

  return (
    <>
      <p class="muted">Finds emails, phone numbers, card numbers and other personal data in text, entirely on your device. Regex-based detection can miss unusual formats or occasionally flag something that isn't PII — check before relying on it.</p>
      <div class="card">
        <textarea rows={8} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Paste text to scan…" />
      </div>
      {text && (
        <div class="card">
          {findings.length ? (
            <>
              <ul>{(Object.keys(counts) as PiiType[]).map((t) => <li key={t}>{LABEL[t]}: {counts[t]}</li>)}</ul>
              <pre class="diff" style="white-space:pre-wrap">{highlighted}</pre>
            </>
          ) : <p class="muted">No obvious personal data found.</p>}
        </div>
      )}
      {findings.length > 0 && (
        <div class="card">
          <div class="row">
            <label>Redaction style
              <select value={style} onChange={(e) => setStyle((e.target as HTMLSelectElement).value as RedactStyle)}>
                <option value="placeholder">Labeled placeholder ([EMAIL])</option><option value="mask">Same-length mask (••••)</option>
              </select>
            </label>
            <button class="primary" onClick={() => void navigator.clipboard?.writeText(redact(text, findings, style))}>Copy redacted text</button>
          </div>
        </div>
      )}
    </>
  );
}
