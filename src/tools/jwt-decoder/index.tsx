import { useMemo, useState } from 'preact/hooks';
import { decodeJwt, verifyHs256, type DecodedJwt } from './logic';

export default function JwtDecoder() {
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [verify, setVerify] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  const { decoded, error } = useMemo<{ decoded: DecodedJwt | null; error: string }>(() => {
    if (!token.trim()) return { decoded: null, error: '' };
    try { return { decoded: decodeJwt(token), error: '' }; }
    catch (e) { return { decoded: null, error: e instanceof Error ? e.message : String(e) }; }
  }, [token]);

  const checkSecret = async () => {
    if (!decoded) return;
    setVerify('checking');
    try { setVerify(await verifyHs256(decoded, secret) ? 'valid' : 'invalid'); }
    catch { setVerify('invalid'); }
  };

  const alg = (decoded?.header as { alg?: string } | null)?.alg;

  return (
    <>
      <p class="muted">Decodes a JSON Web Token on your device. The signature is not checked unless you supply the secret below.</p>
      <div class="card">
        <label class="field">Token
          <textarea rows={4} class="mono" placeholder="eyJhbGciOi..." value={token} onInput={(e) => { setToken((e.target as HTMLTextAreaElement).value); setVerify('idle'); }} />
        </label>
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      {decoded && (
        <>
          <div class="card">
            <strong>Header</strong>
            <pre class="diff">{JSON.stringify(decoded.header, null, 2)}</pre>
          </div>
          <div class="card">
            <strong>Payload</strong>
            <pre class="diff">{JSON.stringify(decoded.payload, null, 2)}</pre>
            {decoded.exp && <p class={decoded.exp.expired ? 'error' : ''}>exp: {decoded.exp.date.toLocaleString()} {decoded.exp.expired ? '(expired)' : '(not yet expired)'}</p>}
            {decoded.nbf?.notYetValid && <p class="error">nbf: not valid until {decoded.nbf.date.toLocaleString()}</p>}
            {decoded.iat && <p class="muted">iat: {decoded.iat.toLocaleString()}</p>}
          </div>
          <div class="card">
            <strong>Verify signature</strong>
            {alg === 'HS256' ? (
              <>
                <div class="row" style="margin-top:8px">
                  <label>Shared secret<input type="password" value={secret} onInput={(e) => { setSecret((e.target as HTMLInputElement).value); setVerify('idle'); }} /></label>
                  <button class="primary" onClick={checkSecret} disabled={!secret || verify === 'checking'}>Check</button>
                </div>
                {verify === 'valid' && <p class="result" style="color:#22c55e">✓ Signature matches this secret.</p>}
                {verify === 'invalid' && <p class="error">✕ Signature does not match.</p>}
              </>
            ) : (
              <p class="muted">Verification here only supports HS256 (a shared secret). This token uses {alg ?? 'an unknown algorithm'}, which needs a public/private key pair, not just a secret.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
