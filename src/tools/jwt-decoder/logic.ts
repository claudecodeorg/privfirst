const unb64url = (s: string): Uint8Array => {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  return Uint8Array.from(atob(norm + pad), (c) => c.charCodeAt(0));
};
const b64url = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export interface DecodedJwt {
  header: unknown;
  payload: unknown;
  signatureB64: string;
  signingInput: string; // "header.payload", needed to verify
  exp?: { date: Date; expired: boolean };
  iat?: Date;
  nbf?: { date: Date; notYetValid: boolean };
}

function decodeJsonSegment(segment: string, label: string): unknown {
  let bytes: Uint8Array;
  try { bytes = unb64url(segment); } catch { throw new Error(`${label} is not valid Base64URL.`); }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error(`${label} is not valid JSON once decoded.`); }
}

export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('A JWT has three dot-separated parts (header.payload.signature).');
  const [h, p, s] = parts;
  const header = decodeJsonSegment(h, 'Header');
  const payload = decodeJsonSegment(p, 'Payload');
  const now = Date.now() / 1000;
  const claim = (payload as Record<string, unknown>) ?? {};
  const out: DecodedJwt = { header, payload, signatureB64: s, signingInput: `${h}.${p}` };
  if (typeof claim.exp === 'number') out.exp = { date: new Date(claim.exp * 1000), expired: claim.exp < now };
  if (typeof claim.iat === 'number') out.iat = new Date(claim.iat * 1000);
  if (typeof claim.nbf === 'number') out.nbf = { date: new Date(claim.nbf * 1000), notYetValid: claim.nbf > now };
  return out;
}

/** Verifies an HS256 (HMAC-SHA256) signature with a shared secret. Other algorithms need a key pair, not just a secret. */
export async function verifyHs256(decoded: DecodedJwt, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(decoded.signingInput));
  return b64url(new Uint8Array(mac)) === decoded.signatureB64;
}
