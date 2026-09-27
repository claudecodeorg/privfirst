// Passphrase-based vault using only WebCrypto: PBKDF2-SHA256 -> AES-256-GCM.
export const DEFAULT_ITERATIONS = 600_000; // OWASP guidance for PBKDF2-HMAC-SHA256
const AAD = new TextEncoder().encode('privfirst-notes-v1');

export interface Envelope { v: 1; iter: number; salt: string; iv: string; data: string }
export interface Note { id: string; title: string; body: string; updated: number }
export interface Session { key: CryptoKey; salt: Uint8Array; iter: number }

export const b64 = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(passphrase: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function newSession(passphrase: string, iter = DEFAULT_ITERATIONS): Promise<Session> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(passphrase, salt, iter), salt, iter };
}

/** Encrypts with a fresh random IV every time. */
export async function seal(session: Session, notes: Note[]): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(notes));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, session.key, plain));
  return { v: 1, iter: session.iter, salt: b64(session.salt), iv: b64(iv), data: b64(ct) };
}

export function isEnvelope(x: unknown): x is Envelope {
  const e = x as Envelope;
  return !!e && e.v === 1 && Number.isInteger(e.iter) && e.iter > 0 && e.iter <= 10_000_000
    && typeof e.salt === 'string' && typeof e.iv === 'string' && typeof e.data === 'string';
}

/** Throws "Wrong passphrase or corrupted data" if authentication fails. */
export async function unseal(env: Envelope, passphrase: string): Promise<{ session: Session; notes: Note[] }> {
  const salt = unb64(env.salt);
  const key = await deriveKey(passphrase, salt, env.iter);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) as BufferSource, additionalData: AAD }, key, unb64(env.data) as BufferSource);
    return { session: { key, salt, iter: env.iter }, notes: JSON.parse(new TextDecoder().decode(plain)) as Note[] };
  } catch {
    throw new Error('Wrong passphrase or corrupted data.');
  }
}
