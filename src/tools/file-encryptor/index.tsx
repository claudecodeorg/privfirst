import { useState } from 'preact/hooks';
import { downloadBlob, formatBytes } from '../../lib/download';
import { decryptFile, encryptFile } from './logic';

export default function FileEncryptor() {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  return (
    <>
      <p class="muted">Locks any file with a passphrase, entirely on your device. AES-256-GCM, key derived with PBKDF2 (600,000 iterations).</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'encrypt'} onClick={() => setMode('encrypt')}>Encrypt</button>
        <button aria-pressed={mode === 'decrypt'} onClick={() => setMode('decrypt')}>Decrypt</button>
      </div>
      {mode === 'encrypt' ? <Encrypt /> : <Decrypt />}
    </>
  );
}

function Encrypt() {
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const problem = pass.length < 10 ? 'Use at least 10 characters (a few random words works well).' : pass !== confirm ? 'Passphrases do not match.' : '';

  const run = async () => {
    if (!file || problem) return;
    setBusy(true); setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const out = await encryptFile(file.name, file.type || 'application/octet-stream', bytes, pass);
      downloadBlob(new Blob([out as BlobPart]), file.name + '.pfenc');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
      {file && <p class="muted">{formatBytes(file.size)}</p>}
      <div class="row" style="margin-top:12px">
        <label>Passphrase<input type="password" autocomplete="new-password" value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} /></label>
        <label>Confirm passphrase<input type="password" autocomplete="new-password" value={confirm} onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} /></label>
      </div>
      {pass && problem && <p class="muted">{problem}</p>}
      <p class="error" style="margin-top:8px">There is no recovery: if you forget the passphrase, the file is unrecoverable.</p>
      <button class="primary" disabled={!file || !!problem || busy} onClick={run}>{busy ? 'Working…' : 'Encrypt & Download'}</button>
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

function Decrypt() {
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!file || !pass) return;
    setBusy(true); setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { name, type, data } = await decryptFile(bytes, pass);
      downloadBlob(new Blob([data as BlobPart], { type }), name);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div class="card">
      <input type="file" accept=".pfenc" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
      <div class="row" style="margin-top:12px">
        <label>Passphrase<input type="password" autocomplete="current-password" value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} /></label>
        <button class="primary" disabled={!file || !pass || busy} onClick={run}>{busy ? 'Working…' : 'Decrypt & Download'}</button>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}
