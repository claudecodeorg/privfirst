import { useMemo, useState } from 'preact/hooks';
import { generatePassphrase, generatePassword, passphraseEntropy, passwordEntropy, strengthLabel, type PassphraseOptions, type PasswordOptions } from './logic';

export default function PasswordGenerator() {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [pw, setPw] = useState<PasswordOptions>({ length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false });
  const [pp, setPp] = useState<PassphraseOptions>({ words: 5, separator: '-', capitalize: true, addNumber: true });
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const { value, error } = useMemo(() => {
    try { return { value: mode === 'password' ? generatePassword(pw) : generatePassphrase(pp), error: '' }; }
    catch (e) { return { value: '', error: e instanceof Error ? e.message : String(e) }; }
  }, [mode, pw, pp, nonce]);

  const bits = mode === 'password' ? passwordEntropy(pw) : passphraseEntropy(pp);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };
  const check = (k: keyof PasswordOptions, label: string) => (
    <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
      <input type="checkbox" checked={pw[k] as boolean} onChange={(e) => setPw({ ...pw, [k]: (e.target as HTMLInputElement).checked })} style="min-height:auto" /> {label}
    </label>
  );

  return (
    <>
      <p class="muted">Generated with your device's cryptographic random source. Nothing is stored or sent.</p>
      <div class="tabs" role="group" aria-label="Mode">
        <button aria-pressed={mode === 'password'} onClick={() => setMode('password')}>Password</button>
        <button aria-pressed={mode === 'passphrase'} onClick={() => setMode('passphrase')}>Passphrase</button>
      </div>
      <div class="card">
        {error ? <p class="error" role="alert">{error}</p> : <p class="result mono" data-testid="output">{value}</p>}
        <div class="row">
          <button class="primary" onClick={() => setNonce(nonce + 1)}>Regenerate</button>
          <button onClick={copy} disabled={!value}>{copied ? 'Copied ✓' : 'Copy'}</button>
          <span class="muted">{Math.round(bits)} bits · {strengthLabel(bits)}</span>
        </div>
      </div>
      <div class="card">
        {mode === 'password' ? (
          <>
            <label class="field">Length: {pw.length}
              <input type="range" min="4" max="128" value={pw.length} onInput={(e) => setPw({ ...pw, length: Number((e.target as HTMLInputElement).value) })} />
            </label>
            <div class="row" style="margin-top:12px">
              {check('lower', 'a–z')}{check('upper', 'A–Z')}{check('digits', '0–9')}{check('symbols', 'Symbols')}{check('avoidAmbiguous', 'Avoid look-alikes (O/0, l/1)')}
            </div>
          </>
        ) : (
          <>
            <label class="field">Words: {pp.words}
              <input type="range" min="3" max="12" value={pp.words} onInput={(e) => setPp({ ...pp, words: Number((e.target as HTMLInputElement).value) })} />
            </label>
            <div class="row" style="margin-top:12px">
              <label>Separator
                <select value={pp.separator} onChange={(e) => setPp({ ...pp, separator: (e.target as HTMLSelectElement).value })}>
                  <option value="-">Hyphen (-)</option><option value=" ">Space</option><option value=".">Period (.)</option><option value="">None</option>
                </select>
              </label>
              <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
                <input type="checkbox" checked={pp.capitalize} onChange={(e) => setPp({ ...pp, capitalize: (e.target as HTMLInputElement).checked })} style="min-height:auto" /> Capitalize
              </label>
              <label style="flex-direction:row;align-items:center;gap:8px;flex:0 0 auto">
                <input type="checkbox" checked={pp.addNumber} onChange={(e) => setPp({ ...pp, addNumber: (e.target as HTMLInputElement).checked })} style="min-height:auto" /> Add a digit
              </label>
            </div>
          </>
        )}
      </div>
    </>
  );
}
