import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { openPdf, type PdfHandle } from '../../lib/pdfjs';
import { embedSignature, type PlacedSignature } from './logic';

const PREVIEW_MAX = 480;
const DEFAULT_PLACED: PlacedSignature = { xFrac: 0.55, yFrac: 0.8, widthFrac: 0.3 };

export default function PdfSign() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pdf, setPdf] = useState<PdfHandle | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pagePreview, setPagePreview] = useState<{ url: string; w: number; h: number } | null>(null);
  const [sig, setSig] = useState<{ bytes: Uint8Array; url: string; aspect: number } | null>(null);
  const [placed, setPlaced] = useState<PlacedSignature | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => () => { pdf?.destroy(); }, [pdf]);

  const openFile = async (f: File) => {
    setFile(f); setError(''); setPlaced(null); setPagePreview(null);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      setBytes(b);
      const handle = await openPdf(b);
      pdf?.destroy();
      setPdf(handle);
      setPageIndex(0);
      await renderPage(handle, 0);
    } catch { setError('Could not open that PDF.'); }
  };

  const renderPage = async (handle: PdfHandle, index: number) => {
    const canvas = document.createElement('canvas');
    const { w, h } = await handle.renderFit(index, canvas, PREVIEW_MAX, PREVIEW_MAX * 1.6);
    setPagePreview({ url: canvas.toDataURL('image/png'), w, h });
  };

  const startPad = (e: PointerEvent) => {
    const c = pad.current!;
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = c.getContext('2d')!;
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const movePad = (e: PointerEvent) => {
    if (!drawing.current) return;
    const c = pad.current!;
    const ctx = c.getContext('2d')!;
    const r = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a8a';
    ctx.stroke();
  };
  const endPad = () => { drawing.current = false; };
  const clearPad = () => { const c = pad.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSig(null); setPlaced(null); };

  const useSignature = async () => {
    const c = pad.current!;
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!blob) return;
    if (sig) URL.revokeObjectURL(sig.url);
    setSig({ bytes: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob), aspect: c.width / c.height });
    setPlaced(DEFAULT_PLACED);
  };

  const onOverlayDown = (e: PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const overlay = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - overlay.left, dy: e.clientY - overlay.top };
  };
  const onOverlayMove = (e: PointerEvent) => {
    if (!drag.current || !placed) return;
    const r = box.current!.getBoundingClientRect();
    const x = (e.clientX - drag.current.dx - r.left) / r.width;
    const y = (e.clientY - drag.current.dy - r.top) / r.height;
    setPlaced({ ...placed, xFrac: Math.min(1 - placed.widthFrac, Math.max(0, x)), yFrac: Math.min(0.98, Math.max(0, y)) });
  };
  const onOverlayUp = () => { drag.current = null; };

  const apply = async () => {
    if (!bytes || !file || !sig || !placed) return;
    setBusy(true); setError('');
    try {
      const out = await embedSignature(bytes, pageIndex, sig.bytes, placed);
      downloadBlob(new Blob([out as BlobPart], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-signed.pdf');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <p class="muted">Draws a signature on your device and places it on a PDF page.</p>
      <div class="card">
        <input type="file" accept="application/pdf" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void openFile(f); }} />
        {pdf && pdf.pageCount > 1 && (
          <label style="margin-top:12px;display:inline-block">Page
            <select value={pageIndex} onChange={(e) => { const i = Number((e.target as HTMLSelectElement).value); setPageIndex(i); setPlaced(null); void renderPage(pdf, i); }}>
              {Array.from({ length: pdf.pageCount }, (_, i) => <option value={i} key={i}>{i + 1}</option>)}
            </select>
          </label>
        )}
      </div>
      <div class="card">
        <strong>1. Draw your signature</strong>
        <div style="margin-top:8px">
          <canvas ref={pad} width={400} height={140} style="width:100%;max-width:400px;background:#fff;border-radius:8px;touch-action:none;display:block"
            onPointerDown={startPad} onPointerMove={movePad} onPointerUp={endPad} onPointerLeave={endPad} />
        </div>
        <div class="row" style="margin-top:8px">
          <button onClick={clearPad}>Clear</button>
          <button class="primary" onClick={useSignature}>Use this signature</button>
        </div>
      </div>
      {pagePreview && sig && placed && (
        <div class="card">
          <strong>2. Place it on the page</strong>
          <p class="muted" style="margin:4px 0 8px">Drag the signature into position.</p>
          <div ref={box} style={`position:relative;display:inline-block;width:${pagePreview.w}px;max-width:100%`}>
            <img src={pagePreview.url} alt="" draggable={false} style="display:block;width:100%;border-radius:8px" />
            <img src={sig.url} alt="Signature" draggable={false}
              style={`position:absolute;left:${placed.xFrac * 100}%;top:${placed.yFrac * 100}%;width:${placed.widthFrac * 100}%;cursor:move`}
              onPointerDown={onOverlayDown} onPointerMove={onOverlayMove} onPointerUp={onOverlayUp} />
          </div>
          <label class="field" style="margin-top:8px;max-width:300px">Size
            <input type="range" min="0.1" max="0.7" step="0.01" value={placed.widthFrac} onInput={(e) => setPlaced({ ...placed, widthFrac: Number((e.target as HTMLInputElement).value) })} />
          </label>
          <p style="margin-top:12px"><button class="primary" disabled={busy} onClick={apply}>{busy ? 'Working…' : 'Place & Download'}</button></p>
          {error && <p class="error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
