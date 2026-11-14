import { useState } from 'preact/hooks';
import { downloadBlob, formatBytes } from '../../lib/download';
import { unzipStore, zipStore, type ZipEntry } from '../../lib/zip';
import { dedupeNames, planBins } from './logic';

type Mode = 'split' | 'merge';
const remove = <T,>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function ZipSplitter() {
  const [mode, setMode] = useState<Mode>('split');
  return (
    <>
      <p class="muted">Bundles files into zip archives capped at a size you choose (handy for email or upload limits), or merges several zips back into one.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'split'} onClick={() => setMode('split')}>Split into zips</button>
        <button aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>Merge zips</button>
      </div>
      {mode === 'split' ? <Split /> : <Merge />}
    </>
  );
}

function Split() {
  const [files, setFiles] = useState<File[]>([]);
  const [maxMb, setMaxMb] = useState(25);
  const [archiveName, setArchiveName] = useState('archive');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError(''); setWarning(''); setProgress('');
    try {
      const thresholdBytes = Math.round(maxMb * 1024 * 1024);
      const infos = files.map((f) => ({ name: f.name, size: f.size }));
      const { bins, oversized } = planBins(infos, thresholdBytes);
      if (oversized.length) {
        setWarning(`${oversized.map((i) => files[i].name).join(', ')} ${oversized.length === 1 ? 'is' : 'are'} bigger than the threshold on its own, so that zip will go over it.`);
      }
      const pad = String(bins.length).length;
      const base = archiveName.trim() || 'archive';
      for (let b = 0; b < bins.length; b++) {
        const bin = bins[b];
        setProgress(`Zipping part ${b + 1} of ${bins.length} (${bin.length} file${bin.length === 1 ? '' : 's'})…`);
        const names = dedupeNames(bin.map((i) => files[i].name));
        const entries: ZipEntry[] = await Promise.all(
          bin.map(async (i, j) => ({ name: names[j], data: new Uint8Array(await files[i].arrayBuffer()) })),
        );
        const zip = zipStore(entries);
        const part = String(b + 1).padStart(pad, '0');
        const total = String(bins.length).padStart(pad, '0');
        downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${base}-part${part}-of-${total}.zip`);
        if (b < bins.length - 1) await delay(400); // gives the browser a beat between downloads
      }
      setProgress('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" multiple
        onChange={(e) => { const el = e.target as HTMLInputElement; setFiles((f) => [...f, ...Array.from(el.files ?? [])]); el.value = ''; }} />
      <ul class="file-list">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            <span class="name">{f.name}</span>
            <span class="muted">{formatBytes(f.size)}</span>
            <button class="danger" aria-label="Remove" onClick={() => setFiles(remove(files, i))}>✕</button>
          </li>
        ))}
      </ul>
      <div class="row" style="margin-top:12px">
        <label>Max size per zip (MB)<input type="number" min="1" step="1" value={maxMb} onInput={(e) => setMaxMb(Number((e.target as HTMLInputElement).value) || 1)} /></label>
        <label>Archive name<input type="text" value={archiveName} onInput={(e) => setArchiveName((e.target as HTMLInputElement).value)} /></label>
      </div>
      <p class="muted">Your browser may ask to allow multiple downloads from this site if the split produces more than one zip — that's expected, allow it to get every part.</p>
      <p><button class="primary" disabled={!files.length || busy} onClick={run}>{busy ? 'Working…' : `Split ${files.length || ''} file${files.length === 1 ? '' : 's'} into zips`}</button></p>
      {progress && <p class="muted">{progress}</p>}
      {warning && <p class="muted">{warning}</p>}
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

function Merge() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError('');
    try {
      const allEntries: ZipEntry[] = [];
      for (const file of files) {
        const entries = unzipStore(new Uint8Array(await file.arrayBuffer()));
        if (!entries.length) throw new Error(`"${file.name}" doesn't look like a valid zip file.`);
        allEntries.push(...entries);
      }
      const names = dedupeNames(allEntries.map((e) => e.name));
      const merged = zipStore(allEntries.map((e, i) => ({ name: names[i], data: e.data })));
      downloadBlob(new Blob([merged as BlobPart], { type: 'application/zip' }), 'merged.zip');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" multiple accept=".zip,application/zip"
        onChange={(e) => { const el = e.target as HTMLInputElement; setFiles((f) => [...f, ...Array.from(el.files ?? [])]); el.value = ''; }} />
      <ul class="file-list">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            <span class="name">{f.name}</span>
            <span class="muted">{formatBytes(f.size)}</span>
            <button class="danger" aria-label="Remove" onClick={() => setFiles(remove(files, i))}>✕</button>
          </li>
        ))}
      </ul>
      <p><button class="primary" disabled={files.length < 2 || busy} onClick={run}>{busy ? 'Working…' : `Merge ${files.length || ''} zips into one`}</button></p>
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}
