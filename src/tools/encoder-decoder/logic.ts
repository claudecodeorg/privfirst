export type Mode = 'base64' | 'base64url' | 'url' | 'hex';

const b64 = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function encodeBase64(text: string, url: boolean): string {
  const s = b64(new TextEncoder().encode(text));
  return url ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s;
}
function decodeBase64(text: string, url: boolean): string {
  let s = text.trim();
  if (url) s = s.replace(/-/g, '+').replace(/_/g, '/');
  s = s.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 === 1) throw new Error('Not valid Base64.');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  try { return new TextDecoder('utf-8', { fatal: true }).decode(unb64(s + pad)); }
  catch { throw new Error('Not valid Base64 (or not valid UTF-8 text once decoded).'); }
}

function encodeHex(text: string): string {
  return [...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function decodeHex(text: string): string {
  const s = text.trim().replace(/\s+/g, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2) throw new Error('Not valid hex (needs an even number of hex digits).');
  const bytes = Uint8Array.from({ length: s.length / 2 }, (_, i) => parseInt(s.slice(i * 2, i * 2 + 2), 16));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Not valid hex (or not valid UTF-8 text once decoded).'); }
}

export function encode(mode: Mode, text: string): string {
  if (mode === 'base64') return encodeBase64(text, false);
  if (mode === 'base64url') return encodeBase64(text, true);
  if (mode === 'hex') return encodeHex(text);
  return encodeURIComponent(text);
}

export function decode(mode: Mode, text: string): string {
  if (mode === 'base64') return decodeBase64(text, false);
  if (mode === 'base64url') return decodeBase64(text, true);
  if (mode === 'hex') return decodeHex(text);
  try { return decodeURIComponent(text); } catch { throw new Error('Not validly percent-encoded.'); }
}
