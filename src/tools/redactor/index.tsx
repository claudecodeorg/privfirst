import { useRef, useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { openPdf } from '../../lib/pdfjs';
import { buildRedactedPdf, paintRedactions, type Box, type RasterPage } from './logic';

/** Drag-to-draw rectangles over a background image. Boxes are stored as 0..1 fractions. */
function BoxCanvas({ src, boxes, onAdd, onRemove }: { src: string; boxes: Box[]; onAdd: (b: Box) => void; onRemove: (i: number) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = useState<Box | null>(null);

  const frac = (e: PointerEvent) => {
    const r = holder.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = frac(e); setLive({ ...drag.current, width: 0, height: 0 }); };
  const move = (e: PointerEvent) => {
    if (!drag.current) return;
    const p = frac(e);
    setLive({ x: Math.min(drag.current.x, p.x), y: Math.min(drag.current.y, p.y), width: Math.abs(p.x - drag.current.x), height: Math.abs(p.y - drag.current.y) });
  };
  const up = () => { drag.current = null; if (live && live.width > 0.01 && live.height > 0.01) onAdd(live); setLive(null); };

  return (
    <div ref={holder} data-testid="redact-canvas" style="position:relative;display:inline-block;max-width:100%;touch-action:none"
      onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <img src={src} alt="" draggable={false} style="display:block;max-width:100%;max-height:520px;border-radius:8px" />
      {boxes.map((b, i) => (
        <div key={i} style={`position:absolute;left:${b.x * 100}%;top:${b.y * 100}%;width:${b.width * 100}%;height:${b.height * 100}%;background:#000;cursor:pointer`}
          title="Click to remove" onClick={() => onRemove(i)} />
      ))}
      {live && <div style={`position:absolute;left:${live.x * 100}%;top:${live.y * 100}%;width:${live.width * 100}%;height:${live.height * 100}%;background:rgba(0,0,0,.5);pointer-events:none`} />}
    </div>
  );
}

export default function Redactor() {
  const [mode, setMode] = useState<'image' | 'pdf'>('image');
  return (
    <>
      <p class="muted">Draws black boxes onto a flattened copy — never just an overlay — so hidden text or pixels underneath cannot be recovered.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'image'} onClick={() => setMode('image')}>Image</button>
        <button aria-pressed={mode === 'pdf'} onClick={() => setMode('pdf')}>PDF</button>
      </div>
      {mode === 'image' ? <ImageRedactor /> : <PdfRedactor />}
    </>
  );
}

function ImageRedactor() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = async (f: File) => {
    setFile(f); setBoxes([]); setError('');
    try {
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      bmp.close();
      setSize({ w: c.width, h: c.height });
      setPreviewUrl(c.toDataURL('image/png'));
    } catch { setError('Could not read that image.'); }
  };

  const apply = async () => {
    if (!file || !previewUrl) return;
    setBusy(true); setError('');
    try {
      const img = new Image();
      img.src = previewUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = size.w; c.height = size.h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      paintRedactions(ctx, size.w, size.h, boxes);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.92));
      if (!blob) throw new Error('Could not export this image.');
      downloadBlob(blob, file.name.replace(/\.[^.]+$/, '') + '-redacted.' + (type === 'image/png' ? 'png' : 'jpg'));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" accept="image/*" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void open(f); }} />
      {previewUrl && (
        <>
          <p class="muted" style="margin:8px 0">Drag to draw a box. Click a box to remove it.</p>
          <BoxCanvas src={previewUrl} boxes={boxes} onAdd={(b) => setBoxes([...boxes, b])} onRemove={(i) => setBoxes(boxes.filter((_, j) => j !== i))} />
          <p style="margin-top:12px"><button class="primary" disabled={!boxes.length || busy} onClick={apply}>{busy ? 'Working…' : `Redact ${boxes.length || ''} area${boxes.length === 1 ? '' : 's'} & Download`}</button></p>
        </>
      )}
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

function PdfRedactor() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [preview, setPreview] = useState('');
  const [boxesByPage, setBoxesByPage] = useState<Record<number, Box[]>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const showPage = async (b: Uint8Array, index: number) => {
    // Opens (and destroys) its own handle rather than sharing one across calls: simpler than
    // threading a live handle through state, at the cost of re-parsing the PDF on every page switch.
    const pdf = await openPdf(b);
    try {
      const canvas = document.createElement('canvas');
      await pdf.renderFullSize(index, canvas, 1.5);
      setPreview(canvas.toDataURL('image/png'));
    } finally { pdf.destroy(); }
  };

  const open = async (f: File) => {
    setFile(f); setBoxesByPage({}); setError(''); setPageIndex(0);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      setBytes(b);
      const pdf = await openPdf(b); // one handle for both the page count and the first preview
      setPageCount(pdf.pageCount);
      try {
        const canvas = document.createElement('canvas');
        await pdf.renderFullSize(0, canvas, 1.5);
        setPreview(canvas.toDataURL('image/png'));
      } finally { pdf.destroy(); }
    } catch (e) { setError(e instanceof Error ? `Could not open that PDF: ${e.message}` : 'Could not open that PDF.'); }
  };

  const boxes = boxesByPage[pageIndex] ?? [];
  const setBoxes = (next: Box[]) => setBoxesByPage({ ...boxesByPage, [pageIndex]: next });

  const apply = async () => {
    if (!bytes || !file) return;
    setBusy(true); setError('');
    try {
      const pdf = await openPdf(bytes);
      const pages: RasterPage[] = [];
      for (let i = 0; i < pdf.pageCount; i++) {
        setProgress(`Flattening page ${i + 1} of ${pdf.pageCount}…`);
        const canvas = document.createElement('canvas');
        await pdf.renderFullSize(i, canvas, 2);
        const ctx = canvas.getContext('2d')!;
        paintRedactions(ctx, canvas.width, canvas.height, boxesByPage[i] ?? []);
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not export a page.'))), 'image/png'));
        pages.push({ png: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
      }
      pdf.destroy();
      setProgress('');
      const out = await buildRedactedPdf(pages);
      downloadBlob(new Blob([out as BlobPart], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-redacted.pdf');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const totalBoxes = Object.values(boxesByPage).reduce((n, b) => n + b.length, 0);

  return (
    <div class="card">
      <input type="file" accept="application/pdf" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void open(f); }} />
      {preview && (
        <>
          {pageCount > 1 && (
            <label style="margin:12px 0;display:inline-block">Page
              <select value={pageIndex} onChange={(e) => { const i = Number((e.target as HTMLSelectElement).value); setPageIndex(i); if (bytes) void showPage(bytes, i); }}>
                {Array.from({ length: pageCount }, (_, i) => <option value={i} key={i}>{i + 1}</option>)}
              </select>
            </label>
          )}
          <p class="muted" style="margin:8px 0">Drag to draw a box on this page. Click a box to remove it.</p>
          <BoxCanvas src={preview} boxes={boxes} onAdd={(b) => setBoxes([...boxes, b])} onRemove={(i) => setBoxes(boxes.filter((_, j) => j !== i))} />
          <p class="muted" style="margin-top:8px">Every page is flattened to an image on export, whether or not it has redactions, so no hidden text survives anywhere in the file.</p>
          <p style="margin-top:8px"><button class="primary" disabled={!totalBoxes || busy} onClick={apply}>{busy ? 'Working…' : `Redact ${totalBoxes} area${totalBoxes === 1 ? '' : 's'} & Download`}</button></p>
          {progress && <p class="muted">{progress}</p>}
        </>
      )}
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}
