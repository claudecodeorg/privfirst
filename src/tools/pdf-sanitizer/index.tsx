import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { analyze, sanitize, type Analysis } from './logic';

interface Item { name: string; bytes: Uint8Array; analysis?: Analysis; error?: string }

export default function PdfSanitizer() {
  const [items, setItems] = useState<Item[]>([]);

  const add = async (files: File[]) => {
    const next: Item[] = [];
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      try { next.push({ name: f.name, bytes, analysis: await analyze(bytes) }); }
      catch (e) { next.push({ name: f.name, bytes, error: e instanceof Error ? e.message : String(e) }); }
    }
    setItems((cur) => [...cur, ...next]);
  };

  const clean = async (it: Item) => {
    const data = await sanitize(it.bytes);
    downloadBlob(new Blob([data as BlobPart], { type: 'application/pdf' }), it.name.replace(/\.pdf$/i, '') + '-clean.pdf');
  };

  const findings = (a: Analysis) => {
    const out: string[] = [];
    if (a.infoFields.length) out.push(`Document info: ${a.infoFields.join(', ')}`);
    if (a.hasXmp) out.push('XMP metadata');
    if (a.hasEmbeddedFiles) out.push('Embedded files/attachments');
    if (a.hasJavaScript) out.push('Embedded JavaScript');
    return out;
  };

  return (
    <>
      <p class="muted">Removes hidden document properties (author, software used, dates), embedded metadata, attachments and JavaScript from a PDF, without changing how the pages look.</p>
      <div class="card">
        <input type="file" accept="application/pdf" multiple
          onChange={(e) => { const el = e.target as HTMLInputElement; void add(Array.from(el.files ?? [])); el.value = ''; }} />
      </div>
      {items.map((it, i) => (
        <div class="card" key={`${it.name}-${i}`}>
          <div class="row">
            <strong style="flex:1">{it.name}</strong>
            <button class="danger" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
          </div>
          {it.error && <p class="error" role="alert">{it.error}</p>}
          {it.analysis && (
            <>
              {findings(it.analysis).length ? (
                <ul>{findings(it.analysis).map((f) => <li key={f}>{f}</li>)}</ul>
              ) : <p class="muted">No hidden metadata found.</p>}
              <button class="primary" onClick={() => void clean(it)}>Download cleaned copy</button>
            </>
          )}
        </div>
      ))}
    </>
  );
}
