import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { downloadBlob, formatBytes } from '../../lib/download';
import { consumeLaunchFiles } from '../../lib/launchFiles';
import { cropToPixels, extensionFor, fitSize, rotatedDims, savings, type CropRect, type OutFormat, type Rotation } from './logic';

interface Result { blob: Blob; url: string; width: number; height: number }

/** Draws `bmp` rotated by `rotation` degrees onto a new canvas sized to fit. */
function drawRotated(bmp: ImageBitmap, rotation: Rotation): HTMLCanvasElement {
  const { width, height } = rotatedDims(bmp.width, bmp.height, rotation);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return c;
}

export default function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null);
  const [format, setFormat] = useState<OutFormat>('image/jpeg');
  const [quality, setQuality] = useState(80);
  const [maxSide, setMaxSide] = useState(2048);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => consumeLaunchFiles('image-compressor', (files) => {
    if (files[0]) { setFile(files[0]); setResult(null); setError(''); setRotation(0); }
  }), []);

  // Re-render the (rotated) preview whenever the source file or rotation changes; crop resets since
  // it's defined in the rotated image's coordinate space.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    let url: string | undefined;
    let live = true;
    createImageBitmap(file).then((bmp) => {
      const c = drawRotated(bmp, rotation);
      bmp.close();
      url = c.toDataURL('image/png');
      if (live) { setPreview({ url, width: c.width, height: c.height }); setCrop(null); }
    }).catch(() => { if (live) setError('Could not read that image.'); });
    return () => { live = false; };
  }, [file, rotation]);

  const pointToFraction = (e: PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const onPointerDown = (e: PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = pointToFraction(e); setCrop({ x: drag.current.x, y: drag.current.y, width: 0, height: 0 }); };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const p = pointToFraction(e);
    const x = Math.min(drag.current.x, p.x), y = Math.min(drag.current.y, p.y);
    setCrop({ x, y, width: Math.abs(p.x - drag.current.x), height: Math.abs(p.y - drag.current.y) });
  };
  const onPointerUp = () => { drag.current = null; if (crop && (crop.width < 0.02 || crop.height < 0.02)) setCrop(null); };

  const compress = async () => {
    if (!file || !preview) return;
    setBusy(true); setError('');
    try {
      const src = new Image();
      src.src = preview.url;
      await src.decode();
      const source = crop ? cropToPixels(crop, preview.width, preview.height) : { x: 0, y: 0, width: preview.width, height: preview.height };
      const { width, height } = fitSize(source.width, source.height, maxSide);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
      ctx.drawImage(src, source.x, source.y, source.width, source.height, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, format, quality / 100));
      if (!blob) throw new Error('This browser cannot encode that format.');
      if (blob.type !== format) throw new Error(`This browser cannot encode ${format.split('/')[1].toUpperCase()}; try another format.`);
      if (result) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), width, height });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally { setBusy(false); }
  };

  const cropBoxStyle = useMemo(() => crop ? `left:${crop.x * 100}%;top:${crop.y * 100}%;width:${crop.width * 100}%;height:${crop.height * 100}%` : '', [crop]);

  return (
    <>
      <p class="muted">Crops, rotates and shrinks images on your device. Re-encoding also drops all hidden metadata (EXIF, GPS).</p>
      <div class="card">
        <input type="file" accept="image/*" onChange={(e) => { setFile((e.target as HTMLInputElement).files?.[0] ?? null); setResult(null); setError(''); setRotation(0); }} />
        {preview && (
          <>
            <div class="row" style="margin-top:12px">
              <button onClick={() => setRotation(((rotation + 270) % 360) as Rotation)}>⟲ Rotate left</button>
              <button onClick={() => setRotation(((rotation + 90) % 360) as Rotation)}>⟳ Rotate right</button>
              {crop && <button onClick={() => setCrop(null)}>Reset crop</button>}
            </div>
            <p class="muted" style="margin:8px 0 4px">Drag on the image to crop.</p>
            <div style="position:relative;display:inline-block;max-width:100%;touch-action:none">
              <img ref={imgRef} src={preview.url} alt="" draggable={false} style="display:block;max-width:100%;max-height:420px;border-radius:8px"
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
              {crop && <div style={`position:absolute;border:2px solid #38bdf8;background:rgba(56,189,248,.2);pointer-events:none;${cropBoxStyle}`} />}
            </div>
          </>
        )}
        <div class="row" style="margin-top:12px">
          <label>Format
            <select value={format} onChange={(e) => setFormat((e.target as HTMLSelectElement).value as OutFormat)}>
              <option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG (lossless)</option>
            </select>
          </label>
          <label>Longest side
            <select value={maxSide} onChange={(e) => setMaxSide(Number((e.target as HTMLSelectElement).value))}>
              <option value="0">Original size</option><option value="3840">3840 px</option><option value="2048">2048 px</option><option value="1280">1280 px</option><option value="800">800 px</option>
            </select>
          </label>
          <label class="field">Quality: {quality}
            <input type="range" min="10" max="100" value={quality} disabled={format === 'image/png'} onInput={(e) => setQuality(Number((e.target as HTMLInputElement).value))} />
          </label>
        </div>
        <p><button class="primary" disabled={!file || busy} onClick={compress}>{busy ? 'Working…' : 'Compress'}</button></p>
        {error && <p class="error" role="alert">{error}</p>}
      </div>
      {result && file && (
        <div class="card">
          <p class="result">{formatBytes(file.size)} → {formatBytes(result.blob.size)} <span class="muted">({savings(file.size, result.blob.size)}, {result.width}×{result.height})</span></p>
          <img src={result.url} alt="Compressed preview" style="max-width:100%;max-height:320px;border-radius:10px" />
          <p><button class="primary" onClick={() => downloadBlob(result.blob, `${file.name.replace(/\.[^.]+$/, '')}-compressed.${extensionFor(format)}`)}>Download</button></p>
        </div>
      )}
    </>
  );
}
