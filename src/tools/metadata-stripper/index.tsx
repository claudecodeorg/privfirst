import { useState } from 'preact/hooks';
import { downloadBytes, formatBytes } from '../../lib/download';
import { analyze, stripMetadata, type Analysis } from './logic';

interface Item { name: string; data: Uint8Array; analysis?: Analysis; error?: string }

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' } as const;

export default function MetadataStripper() {
  const [items, setItems] = useState<Item[]>([]);
  const [keepOrientation, setKeepOrientation] = useState(true);

  const add = async (files: File[]) => {
    const next: Item[] = [];
    for (const f of files) {
      const data = new Uint8Array(await f.arrayBuffer());
      try { next.push({ name: f.name, data, analysis: analyze(data) }); }
      catch (e) { next.push({ name: f.name, data, error: e instanceof Error ? e.message : String(e) }); }
    }
    setItems((cur) => [...cur, ...next]);
  };

  const clean = (it: Item) => {
    const { data, removed } = stripMetadata(it.data, { keepOrientation });
    const kind = it.analysis!.kind;
    const base = it.name.replace(/\.[^.]+$/, '');
    downloadBytes(data, `${base}-clean.${EXT[kind]}`, MIME[kind]);
    return removed;
  };

  return (
    <>
      <p class="muted">Removes EXIF (including GPS location), XMP, comments and other hidden data without re-encoding, so image quality is untouched. Everything happens on your device.</p>
      <div class="card">
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple
          onChange={(e) => { const el = e.target as HTMLInputElement; void add(Array.from(el.files ?? [])); el.value = ''; }} />
        <label style="flex-direction:row;align-items:center;gap:8px;margin-top:12px" class="field">
          <input type="checkbox" checked={keepOrientation} style="min-height:auto"
            onChange={(e) => setKeepOrientation((e.target as HTMLInputElement).checked)} />
          Keep the rotation flag (so photos don't turn sideways)
        </label>
      </div>
      {items.map((it, i) => (
        <div class="card" key={`${it.name}-${i}`}>
          <div class="row">
            <strong class="name" style="flex:1">{it.name} <span class="muted">({formatBytes(it.data.length)})</span></strong>
            <button class="danger" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
          </div>
          {it.error && <p class="error" role="alert">{it.error}</p>}
          {it.analysis && (
            <>
              {it.analysis.exif.gps && <p class="error">⚠ Contains GPS location: {it.analysis.exif.gps.lat.toFixed(5)}, {it.analysis.exif.gps.lon.toFixed(5)}</p>}
              {it.analysis.found.length || it.analysis.exif.entries.length ? (
                <ul>
                  {it.analysis.found.map((f) => <li key={f}>{f}</li>)}
                  {it.analysis.exif.entries.map((e, k) => <li key={k} class="muted">{e.label}: {e.value}</li>)}
                </ul>
              ) : <p class="muted">No hidden metadata found.</p>}
              <button class="primary" onClick={() => clean(it)}>Download cleaned copy</button>
            </>
          )}
        </div>
      ))}
    </>
  );
}
