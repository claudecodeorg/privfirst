import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { decodeRgba, qrPngDataUrl, qrSvg, wifiPayload, type Ecc } from './logic';

type Mode = 'text' | 'wifi' | 'scan';

export default function QrTools() {
  const [mode, setMode] = useState<Mode>('text');
  return (
    <>
      <p class="muted">Create and read QR codes entirely on your device. Camera frames are never recorded or uploaded.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'text'} onClick={() => setMode('text')}>Text / URL</button>
        <button aria-pressed={mode === 'wifi'} onClick={() => setMode('wifi')}>Wi-Fi</button>
        <button aria-pressed={mode === 'scan'} onClick={() => setMode('scan')}>Scan</button>
      </div>
      {mode === 'scan' ? <Scan /> : <Generate wifi={mode === 'wifi'} />}
    </>
  );
}

function Generate({ wifi }: { wifi: boolean }) {
  const [text, setText] = useState('');
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [sec, setSec] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [hidden, setHidden] = useState(false);
  const [ecc, setEcc] = useState<Ecc>('M');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  const payload = wifi ? (ssid ? wifiPayload(ssid, pass, sec, hidden) : '') : text;

  useEffect(() => {
    if (!payload) { setSvg(''); setError(''); return; }
    let live = true;
    qrSvg(payload, ecc).then((s) => { if (live) { setSvg(s); setError(''); } })
      .catch((e) => { if (live) { setSvg(''); setError(e instanceof Error ? e.message : String(e)); } });
    return () => { live = false; };
  }, [payload, ecc]);

  const input = (v: string, set: (s: string) => void, type = 'text') =>
    <input type={type} value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} autocomplete="off" />;

  return (
    <div class="card">
      {wifi ? (
        <div class="row">
          <label>Network name (SSID){input(ssid, setSsid)}</label>
          <label>Password{input(pass, setPass, 'password')}</label>
          <label>Security
            <select value={sec} onChange={(e) => setSec((e.target as HTMLSelectElement).value as typeof sec)}>
              <option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">None</option>
            </select>
          </label>
          <label class="field" style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
            <input type="checkbox" checked={hidden} style="min-height:auto" onChange={(e) => setHidden((e.target as HTMLInputElement).checked)} /> Hidden network
          </label>
        </div>
      ) : (
        <label class="field">Text or URL
          <textarea rows={4} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        </label>
      )}
      <div class="row" style="margin-top:12px">
        <label>Error correction
          <select value={ecc} onChange={(e) => setEcc((e.target as HTMLSelectElement).value as Ecc)}>
            <option value="L">Low (7%)</option><option value="M">Medium (15%)</option><option value="Q">Quartile (25%)</option><option value="H">High (30%)</option>
          </select>
        </label>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      {svg && (
        <>
          <div class="qr" role="img" aria-label="Generated QR code" dangerouslySetInnerHTML={{ __html: svg }} />
          <div class="row">
            <button class="primary" onClick={async () => { const r = await fetch(await qrPngDataUrl(payload, ecc, 1024)); downloadBlob(await r.blob(), 'qr-code.png'); }}>Download PNG</button>
            <button onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg')}>Download SVG</button>
          </div>
        </>
      )}
    </div>
  );
}

function Scan() {
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const fromImage = async (f: File) => {
    setError(''); setResult('');
    try {
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0); bmp.close();
      const text = decodeRgba(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (text === null) setError('No QR code found in that image.'); else setResult(text);
    } catch { setError('Could not read that image.'); }
  };

  useEffect(() => {
    if (!camera) return;
    let stop = false;
    let stream: MediaStream | undefined;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stop) return;
          if (v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const text = decodeRgba(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (text !== null) { setResult(text); setCamera(false); return; }
          }
          setTimeout(() => requestAnimationFrame(tick), 100);
        };
        tick();
      } catch { setError('Camera unavailable or permission denied. You can scan from an image instead.'); setCamera(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera]);

  const isUrl = /^https?:\/\//i.test(result);
  return (
    <div class="card">
      <div class="row">
        <button class="primary" onClick={() => { setError(''); setResult(''); setCamera(!camera); }}>{camera ? 'Stop camera' : 'Scan with camera'}</button>
        <label style="flex:0 0 auto"><span class="btn">Scan from image…</span>
          <input type="file" accept="image/*" hidden onChange={(e) => { const el = e.target as HTMLInputElement; const f = el.files?.[0]; if (f) void fromImage(f); el.value = ''; }} />
        </label>
      </div>
      {camera && <video ref={video} playsInline muted style="width:100%;max-width:480px;border-radius:12px;margin-top:12px" />}
      {error && <p class="error" role="alert">{error}</p>}
      {result && (
        <div style="margin-top:12px">
          <p class="result mono" style="word-break:break-all">{result}</p>
          <div class="row">
            <button onClick={() => void navigator.clipboard?.writeText(result)}>Copy</button>
            {isUrl && <a class="btn" href={result} target="_blank" rel="noopener noreferrer">Open link</a>}
          </div>
          {isUrl && <p class="muted">Check the address before opening it.</p>}
        </div>
      )}
    </div>
  );
}
