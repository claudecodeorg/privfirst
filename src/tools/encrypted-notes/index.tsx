import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBytes } from '../../lib/download';
import { isEnvelope, newSession, seal, unseal, type Envelope, type Note, type Session } from './crypto';

const STORAGE_KEY = 'privfirst.notes.vault';
const IDLE_MS = 5 * 60_000;
const MIN_PASSPHRASE = 10;

const load = (): Envelope | null => {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); return isEnvelope(v) ? v : null; } catch { return null; }
};
const persist = (env: Envelope) => localStorage.setItem(STORAGE_KEY, JSON.stringify(env));

export default function EncryptedNotes() {
  const [vault, setVault] = useState<Envelope | null>(load);
  const [notes, setNotes] = useState<Note[] | null>(null); // null = locked
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<Session | null>(null);
  const saveTimer = useRef<number>();
  const idleTimer = useRef<number>();

  const lock = () => {
    clearTimeout(saveTimer.current);
    session.current = null;
    setNotes(null); setActiveId(null); setStatus('');
  };

  // Auto-lock after inactivity or when the tab is hidden for a while.
  useEffect(() => {
    if (!notes) return;
    const reset = () => { clearTimeout(idleTimer.current); idleTimer.current = window.setTimeout(lock, IDLE_MS); };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => addEventListener(e, reset));
    reset();
    return () => { events.forEach((e) => removeEventListener(e, reset)); clearTimeout(idleTimer.current); };
  }, [notes !== null]);

  useEffect(() => () => { clearTimeout(saveTimer.current); }, []);

  const save = async (next: Note[]) => {
    if (!session.current) return;
    const env = await seal(session.current, next);
    persist(env); setVault(env); setStatus('Saved (encrypted)');
  };
  const update = (next: Note[], immediate = false) => {
    setNotes(next); setStatus('Saving…');
    clearTimeout(saveTimer.current);
    if (immediate) void save(next);
    else saveTimer.current = window.setTimeout(() => void save(next), 600);
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const create = (pass: string) => guard(async () => {
    const s = await newSession(pass);
    session.current = s;
    const first: Note[] = [{ id: crypto.randomUUID(), title: 'Welcome', body: 'Everything here is encrypted with your passphrase before it is stored.', updated: Date.now() }];
    const env = await seal(s, first);
    persist(env); setVault(env); setNotes(first); setActiveId(first[0].id);
    void navigator.storage?.persist?.();
  });

  const unlock = (pass: string) => guard(async () => {
    const { session: s, notes: n } = await unseal(vault!, pass);
    session.current = s; setNotes(n); setActiveId(n[0]?.id ?? null);
  });

  const changePassphrase = (pass: string) => guard(async () => {
    const s = await newSession(pass);
    session.current = s;
    const env = await seal(s, notes!);
    persist(env); setVault(env); setStatus('Passphrase changed');
  });

  const importBackup = (file: File) => guard(async () => {
    const parsed = JSON.parse(await file.text());
    if (!isEnvelope(parsed)) throw new Error('Not a valid PrivFirst backup file.');
    if (vault && !confirm('This replaces the vault stored on this device. Continue?')) return;
    persist(parsed); setVault(parsed); lock();
  });

  const reset = () => {
    if (!confirm('Permanently delete ALL notes on this device? This cannot be undone without a backup.')) return;
    localStorage.removeItem(STORAGE_KEY); setVault(null); lock();
  };

  if (!vault) return <Setup busy={busy} error={error} onCreate={create} onImport={importBackup} />;
  if (!notes) return <Unlock busy={busy} error={error} onUnlock={unlock} onImport={importBackup} onReset={reset} />;

  const active = notes.find((n) => n.id === activeId) ?? null;
  const edit = (patch: Partial<Note>) => update(notes.map((n) => (n.id === activeId ? { ...n, ...patch, updated: Date.now() } : n)));

  return (
    <>
      <div class="row" style="margin-bottom:12px">
        <button class="primary" onClick={() => { const n = { id: crypto.randomUUID(), title: 'Untitled', body: '', updated: Date.now() }; update([n, ...notes], true); setActiveId(n.id); }}>+ New note</button>
        <button onClick={lock}>🔒 Lock</button>
        <span class="muted">{status}</span>
      </div>
      <div class="notes">
        <ul class="file-list note-list">
          {notes.map((n) => (
            <li key={n.id}><button style="flex:1;text-align:left" aria-pressed={n.id === activeId} class={n.id === activeId ? 'primary' : ''} onClick={() => setActiveId(n.id)}>
              <span class="name" style="display:block">{n.title || 'Untitled'}</span>
            </button></li>
          ))}
        </ul>
        {active ? (
          <div class="card" style="margin:0">
            <input class="mono" style="width:100%;margin-bottom:8px" value={active.title} placeholder="Title" onInput={(e) => edit({ title: (e.target as HTMLInputElement).value })} />
            <textarea class="mono" style="width:100%" rows={14} value={active.body} placeholder="Write something private…" onInput={(e) => edit({ body: (e.target as HTMLTextAreaElement).value })} />
            <button class="danger" onClick={() => { if (!confirm('Delete this note?')) return; const rest = notes.filter((n) => n.id !== activeId); update(rest, true); setActiveId(rest[0]?.id ?? null); }}>Delete note</button>
          </div>
        ) : <p class="muted">No note selected.</p>}
      </div>
      <details class="card">
        <summary>Backup &amp; security</summary>
        <div class="row" style="margin-top:12px">
          <button onClick={() => downloadBytes(new TextEncoder().encode(JSON.stringify(vault)), `privfirst-notes-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>Export encrypted backup</button>
          <label style="flex:0 0 auto"><span class="btn">Import backup…</span><input type="file" accept="application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void importBackup(f); }} /></label>
          <button class="danger" onClick={reset}>Delete everything</button>
        </div>
        <ChangePassphrase busy={busy} onChange={changePassphrase} />
        <p class="muted">Auto-locks after 5 minutes of inactivity. Notes live only in this browser’s storage; clearing site data deletes them, so export backups.</p>
        {error && <p class="error" role="alert">{error}</p>}
      </details>
    </>
  );
}

function PassForm({ label, confirmField, busy, onSubmit }: { label: string; confirmField: boolean; busy: boolean; onSubmit: (p: string) => void }) {
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const problem = confirmField ? (p.length < MIN_PASSPHRASE ? `Use at least ${MIN_PASSPHRASE} characters (a few random words works well).` : p !== c ? 'Passphrases do not match.' : '') : (p ? '' : 'Enter your passphrase.');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!problem) onSubmit(p); }}>
      <div class="row">
        <label>Passphrase<input type="password" autocomplete={confirmField ? 'new-password' : 'current-password'} value={p} onInput={(e) => setP((e.target as HTMLInputElement).value)} /></label>
        {confirmField && <label>Confirm passphrase<input type="password" autocomplete="new-password" value={c} onInput={(e) => setC((e.target as HTMLInputElement).value)} /></label>}
        <button class="primary" type="submit" disabled={busy || !!problem}>{busy ? 'Working…' : label}</button>
      </div>
      {p && problem && confirmField && <p class="muted">{problem}</p>}
    </form>
  );
}

function ChangePassphrase({ busy, onChange }: { busy: boolean; onChange: (p: string) => void }) {
  return <div style="margin-top:16px"><strong>Change passphrase</strong><PassForm label="Change" confirmField busy={busy} onSubmit={onChange} /></div>;
}

function ImportButton({ onImport }: { onImport: (f: File) => void }) {
  return <label><span class="btn">Restore from backup…</span><input type="file" accept="application/json" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onImport(f); }} /></label>;
}

function Setup({ busy, error, onCreate, onImport }: { busy: boolean; error: string; onCreate: (p: string) => void; onImport: (f: File) => void }) {
  return (
    <div class="card">
      <h2>Create your private vault</h2>
      <p class="muted">Notes are encrypted on this device with AES-256-GCM using a key derived from your passphrase. <strong>There is no recovery: if you forget it, the notes are gone.</strong></p>
      <PassForm label="Create vault" confirmField busy={busy} onSubmit={onCreate} />
      <ImportButton onImport={onImport} />
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

function Unlock({ busy, error, onUnlock, onImport, onReset }: { busy: boolean; error: string; onUnlock: (p: string) => void; onImport: (f: File) => void; onReset: () => void }) {
  return (
    <div class="card">
      <h2>🔒 Vault locked</h2>
      <PassForm label="Unlock" confirmField={false} busy={busy} onSubmit={onUnlock} />
      {error && <p class="error" role="alert">{error}</p>}
      <div class="row" style="margin-top:12px"><ImportButton onImport={onImport} /><button class="danger" onClick={onReset}>Forgot passphrase? Delete vault</button></div>
    </div>
  );
}
