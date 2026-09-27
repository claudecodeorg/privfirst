import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBytes } from '../../lib/download';
import { consumeLaunchFiles } from '../../lib/launchFiles';
import { editPdf, mergePdfs, pageCount, parseRanges, type PageEdit } from './logic';
import type { Thumbs } from './thumbs';

type Mode = 'merge' | 'pages';

async function readFile(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

const download = (data: Uint8Array, name: string) => downloadBytes(data, name, 'application/pdf');

const move = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
};

export default function PdfToolkit() {
  const [mode, setMode] = useState<Mode>('merge');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [launchedFile, setLaunchedFile] = useState<File | null>(null);

  useEffect(() => consumeLaunchFiles('pdf-toolkit', (files) => {
    if (files[0]) { setLaunchedFile(files[0]); setMode('pages'); }
  }), []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <p class="muted">Processed locally in your browser. Nothing is uploaded.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'merge'} onClick={() => { setMode('merge'); setError(''); }}>Merge</button>
        <button aria-pressed={mode === 'pages'} onClick={() => { setMode('pages'); setError(''); }}>Split / reorder / rotate</button>
      </div>
      {mode === 'merge' ? <Merge run={run} busy={busy} /> : <Pages run={run} busy={busy} initialFile={launchedFile} />}
      {error && <p class="error" role="alert">{error}</p>}
    </>
  );
}

const BOX_W = 100;
const BOX_H = 124;

/** Renders one page preview on demand (when scrolled near the viewport); falls back to an icon if it can't. */
function Thumb({ thumbs, index, rotate }: { thumbs: Thumbs | null; index: number; rotate: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!thumbs || !holder.current) return;
    let live = true;
    const start = () => thumbs.render(index, canvas.current!, BOX_W, BOX_H).then((s) => { if (live) setSize(s); }).catch(() => { /* keep the icon */ });
    if (typeof IntersectionObserver === 'undefined') { start(); return () => { live = false; }; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(holder.current);
    return () => { live = false; io.disconnect(); };
  }, [thumbs, index]);

  const sideways = Math.abs(rotate) % 180 !== 0;
  const fit = size && sideways ? Math.min(1, BOX_W / size.h, BOX_H / size.w) : 1; // keep a rotated page inside the tile
  return (
    <div class="box" ref={holder}>
      {!size && <span style={`transform:rotate(${rotate}deg)`}>📄</span>}
      <canvas ref={canvas} role="img" aria-label={`Preview of page ${index + 1}`}
        style={size ? `width:${size.w}px;height:${size.h}px;transform:rotate(${rotate}deg) scale(${fit})` : 'display:none'} />
    </div>
  );
}

interface PanelProps { run: (fn: () => Promise<void>) => Promise<void>; busy: boolean }

function Merge({ run, busy }: PanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div class="card">
      <input type="file" accept="application/pdf" multiple
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
      <button class="primary" disabled={busy || files.length < 2}
        onClick={() => run(async () => download(await mergePdfs(await Promise.all(files.map(readFile))), 'merged.pdf'))}>
        {busy ? 'Working…' : 'Merge & download'}
      </button>
      {files.length < 2 && <span class="muted"> Add at least two PDFs.</span>}
    </div>
  );
}

function Pages({ run, busy, initialFile }: PanelProps & { initialFile?: File | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Uint8Array | null>(null);
  const [edits, setEdits] = useState<PageEdit[]>([]);
  const [range, setRange] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [thumbs, setThumbs] = useState<Thumbs | null>(null);
  const thumbsRef = useRef<Thumbs | null>(null);
  const openId = useRef(0);

  useEffect(() => () => { openId.current++; thumbsRef.current?.destroy(); }, []);

  const openPreviews = (d: Uint8Array) => {
    const id = ++openId.current;
    thumbsRef.current?.destroy(); thumbsRef.current = null; setThumbs(null);
    // Previews are optional: the page list works immediately and upgrades when pdf.js is ready.
    import('./thumbs').then((m) => m.openThumbs(d)).then((t) => {
      if (id !== openId.current) { t.destroy(); return; }
      thumbsRef.current = t; setThumbs(t);
    }).catch(() => { /* unsupported or encrypted: keep the icons */ });
  };

  const update = (i: number, patch: Partial<PageEdit>) =>
    setEdits(edits.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const keepOnly = () => {
    try {
      const wanted = new Set(parseRanges(range, edits.length));
      setEdits(edits.map((e) => ({ ...e, keep: wanted.has(e.index) })));
      setRangeError('');
    } catch (e) { setRangeError(e instanceof Error ? e.message : String(e)); }
  };

  const openFile = (f: File) => run(async () => {
    const d = await readFile(f);
    const n = await pageCount(d);
    setFile(f); setData(d); openPreviews(d);
    setEdits(Array.from({ length: n }, (_, index) => ({ index, rotate: 0, keep: true })));
  });

  useEffect(() => { if (initialFile) void openFile(initialFile); }, [initialFile]);

  return (
    <div class="card">
      <input type="file" accept="application/pdf" onChange={(e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) void openFile(f);
      }} />
      {data && file && (
        <>
          <div class="row" style="margin:12px 0">
            <label>Keep only pages (e.g. 1-3, 5)
              <input value={range} placeholder="1-3, 5, 8-" onInput={(e) => setRange((e.target as HTMLInputElement).value)} />
            </label>
            <button onClick={keepOnly}>Apply</button>
            <button onClick={() => setEdits(edits.map((e) => ({ ...e, keep: true })))}>Restore all</button>
          </div>
          {rangeError && <p class="error">{rangeError}</p>}
          <div class="pages">
            {edits.map((e, i) => (
              <div class={`page${e.keep ? '' : ' off'}`} key={e.index}>
                <Thumb thumbs={thumbs} index={e.index} rotate={e.rotate} />
                Page {e.index + 1}
                <div class="acts">
                  <button aria-label="Move earlier" onClick={() => setEdits(move(edits, i, i - 1))}>←</button>
                  <button aria-label="Rotate left" onClick={() => update(i, { rotate: e.rotate - 90 })}>⟲</button>
                  <button aria-label="Rotate right" onClick={() => update(i, { rotate: e.rotate + 90 })}>⟳</button>
                  <button aria-label="Move later" onClick={() => setEdits(move(edits, i, i + 1))}>→</button>
                  <button class="danger" aria-label={e.keep ? 'Delete page' : 'Restore page'} onClick={() => update(i, { keep: !e.keep })}>
                    {e.keep ? '✕' : '↩'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p>
            <button class="primary" disabled={busy || !edits.some((e) => e.keep)}
              onClick={() => run(async () => download(await editPdf(data, edits), file.name.replace(/\.pdf$/i, '') + '-edited.pdf'))}>
              {busy ? 'Working…' : `Download (${edits.filter((e) => e.keep).length} pages)`}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
