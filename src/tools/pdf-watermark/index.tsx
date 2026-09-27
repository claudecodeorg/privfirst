import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { addPageNumbers, addWatermark, type Anchor } from './logic';

const ANCHORS: Anchor[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

export default function PdfWatermark() {
  const [mode, setMode] = useState<'watermark' | 'numbers'>('watermark');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('DRAFT');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [format, setFormat] = useState('Page {page} of {total}');
  const [anchor, setAnchor] = useState<Anchor>('bottom-right');
  const [startAt, setStartAt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const out = mode === 'watermark'
        ? await addWatermark(bytes, { text, fontSize, opacity: opacity / 100, rotationDeg: rotation, color: { r: 0.5, g: 0.5, b: 0.5 } })
        : await addPageNumbers(bytes, { format, anchor, fontSize: 12, startAt });
      downloadBlob(new Blob([out as BlobPart], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + (mode === 'watermark' ? '-watermarked.pdf' : '-numbered.pdf'));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <p class="muted">Stamps every page of a PDF, on your device.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'watermark'} onClick={() => setMode('watermark')}>Watermark</button>
        <button aria-pressed={mode === 'numbers'} onClick={() => setMode('numbers')}>Page numbers</button>
      </div>
      <div class="card">
        <input type="file" accept="application/pdf" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
        {mode === 'watermark' ? (
          <div class="row" style="margin-top:12px">
            <label>Text<input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} /></label>
            <label class="field">Size: {fontSize}<input type="range" min="12" max="120" value={fontSize} onInput={(e) => setFontSize(Number((e.target as HTMLInputElement).value))} /></label>
            <label class="field">Opacity: {opacity}%<input type="range" min="5" max="100" value={opacity} onInput={(e) => setOpacity(Number((e.target as HTMLInputElement).value))} /></label>
            <label class="field">Rotation: {rotation}°<input type="range" min="-90" max="90" value={rotation} onInput={(e) => setRotation(Number((e.target as HTMLInputElement).value))} /></label>
          </div>
        ) : (
          <div class="row" style="margin-top:12px">
            <label>Format<input value={format} onInput={(e) => setFormat((e.target as HTMLInputElement).value)} /></label>
            <label>Position
              <select value={anchor} onChange={(e) => setAnchor((e.target as HTMLSelectElement).value as Anchor)}>
                {ANCHORS.map((a) => <option value={a} key={a}>{a.replace('-', ' ')}</option>)}
              </select>
            </label>
            <label>Start at<input type="number" value={startAt} onInput={(e) => setStartAt(Number((e.target as HTMLInputElement).value) || 1)} /></label>
          </div>
        )}
        <p style="margin-top:12px"><button class="primary" disabled={!file || busy} onClick={apply}>{busy ? 'Working…' : 'Apply & Download'}</button></p>
        {error && <p class="error" role="alert">{error}</p>}
      </div>
    </>
  );
}
