import { useState } from 'preact/hooks';
import { downloadBlob, formatBytes } from '../../lib/download';
import { extensionFor, fitSize, savings, type OutFormat } from './logic';

interface Result { blob: Blob; url: string; width: number; height: number }

export default function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutFormat>('image/jpeg');
  const [quality, setQuality] = useState(80);
  const [maxSide, setMaxSide] = useState(2048);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const compress = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const bmp = await createImageBitmap(file); // honours EXIF rotation
      const { width, height } = fitSize(bmp.width, bmp.height, maxSide);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); } // JPEG has no alpha
      ctx.drawImage(bmp, 0, 0, width, height);
      bmp.close();
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, format, quality / 100));
      if (!blob) throw new Error('This browser cannot encode that format.');
      if (blob.type !== format) throw new Error(`This browser cannot encode ${format.split('/')[1].toUpperCase()}; try another format.`);
      if (result) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), width, height });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <p class="muted">Shrinks images on your device. Re-encoding also drops all hidden metadata (EXIF, GPS).</p>
      <div class="card">
        <input type="file" accept="image/*" onChange={(e) => { setFile((e.target as HTMLInputElement).files?.[0] ?? null); setResult(null); setError(''); }} />
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
