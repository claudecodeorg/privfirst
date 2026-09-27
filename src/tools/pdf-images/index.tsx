import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { zipStore } from '../../lib/zip';
import { fitToPage, pageDimsFor, sanitizeBaseName, type PageSize } from './logic';

type Mode = 'toPdf' | 'toImages';
const move = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
};

export default function PdfImages() {
  const [mode, setMode] = useState<Mode>('toPdf');
  return (
    <>
      <p class="muted">Converts between images and PDF on your device.</p>
      <div class="tabs" role="group" aria-label="Direction">
        <button aria-pressed={mode === 'toPdf'} onClick={() => setMode('toPdf')}>Images → PDF</button>
        <button aria-pressed={mode === 'toImages'} onClick={() => setMode('toImages')}>PDF → Images</button>
      </div>
      {mode === 'toPdf' ? <ToPdf /> : <ToImages />}
    </>
  );
}

function ToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('fit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const convert = async () => {
    setBusy(true); setError('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
        let embedded, w: number, h: number;
        if (isPng || file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
          embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          w = embedded.width; h = embedded.height;
        } else {
          // Other formats (e.g. WebP): re-encode to PNG via canvas first, since pdf-lib only embeds JPEG/PNG.
          const bmp = await createImageBitmap(file);
          const c = document.createElement('canvas');
          c.width = bmp.width; c.height = bmp.height;
          c.getContext('2d')!.drawImage(bmp, 0, 0);
          bmp.close();
          const png = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not convert this image.'))), 'image/png'));
          embedded = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
          w = embedded.width; h = embedded.height;
        }
        const dims = pageDimsFor(w, h, pageSize);
        const page = doc.addPage([dims.width, dims.height]);
        const rect = fitToPage(w, h, dims.width, dims.height, pageSize === 'fit' ? 0 : 24);
        page.drawImage(embedded, rect);
      }
      downloadBlob(new Blob([await doc.save() as BlobPart], { type: 'application/pdf' }), 'images.pdf');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple
        onChange={(e) => { const el = e.target as HTMLInputElement; setFiles((f) => [...f, ...Array.from(el.files ?? [])]); el.value = ''; }} />
      <ul class="file-list">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            <span class="name">{f.name}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={() => setFiles(move(files, i, i - 1))}>↑</button>
            <button aria-label="Move down" disabled={i === files.length - 1} onClick={() => setFiles(move(files, i, i + 1))}>↓</button>
            <button class="danger" aria-label="Remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ul>
      <div class="row">
        <label>Page size
          <select value={pageSize} onChange={(e) => setPageSize((e.target as HTMLSelectElement).value as PageSize)}>
            <option value="fit">Fit image (one size per page)</option><option value="a4">A4</option><option value="letter">Letter</option>
          </select>
        </label>
      </div>
      <p><button class="primary" disabled={!files.length || busy} onClick={convert}>{busy ? 'Working…' : `Convert ${files.length || ''} image${files.length === 1 ? '' : 's'} to PDF`}</button></p>
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

function ToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const convert = async () => {
    if (!file) return;
    setBusy(true); setError(''); setProgress('');
    try {
      const [{ openPdf }, bytes] = [await import('../../lib/pdfjs'), new Uint8Array(await file.arrayBuffer())];
      const renderer = await openPdf(bytes);
      const base = sanitizeBaseName(file.name);
      const ext = format === 'image/png' ? 'png' : 'jpg';
      const entries: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < renderer.pageCount; i++) {
        setProgress(`Rendering page ${i + 1} of ${renderer.pageCount}…`);
        const canvas = document.createElement('canvas');
        await renderer.renderFullSize(i, canvas, scale);
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not export this page.'))), format, 0.92));
        entries.push({ name: `${base}-page-${String(i + 1).padStart(2, '0')}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      renderer.destroy();
      setProgress('');
      if (entries.length === 1) downloadBlob(new Blob([entries[0].data as BlobPart], { type: format }), entries[0].name);
      else downloadBlob(new Blob([zipStore(entries) as BlobPart], { type: 'application/zip' }), `${base}-images.zip`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" accept="application/pdf" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
      <div class="row" style="margin-top:12px">
        <label>Format
          <select value={format} onChange={(e) => setFormat((e.target as HTMLSelectElement).value as typeof format)}>
            <option value="image/png">PNG</option><option value="image/jpeg">JPEG</option>
          </select>
        </label>
        <label>Resolution
          <select value={scale} onChange={(e) => setScale(Number((e.target as HTMLSelectElement).value))}>
            <option value={1}>1× (screen)</option><option value={2}>2× (sharp)</option><option value={4}>4× (print)</option>
          </select>
        </label>
      </div>
      <p><button class="primary" disabled={!file || busy} onClick={convert}>{busy ? 'Working…' : 'Convert to images'}</button></p>
      {progress && <p class="muted">{progress}</p>}
      {error && <p class="error" role="alert">{error}</p>}
      <p class="muted">A single-page PDF downloads as one image; multiple pages download together as a .zip.</p>
    </div>
  );
}
