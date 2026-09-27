// A passphrase-locked container for one arbitrary file: PBKDF2-SHA256 -> AES-256-GCM, same primitives
// as the Encrypted Notes vault. The filename and MIME type are encrypted along with the content, so
// the .pfenc file on disk reveals nothing about what it holds.
export const MAGIC = new TextEncoder().encode('PFE1');
export const DEFAULT_ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('privfirst-file-v1');

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function packPlaintext(name: string, type: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(2 + nameBytes.length + 2 + typeBytes.length + data.length);
  const view = new DataView(out.buffer);
  let o = 0;
  view.setUint16(o, nameBytes.length); o += 2; out.set(nameBytes, o); o += nameBytes.length;
  view.setUint16(o, typeBytes.length); o += 2; out.set(typeBytes, o); o += typeBytes.length;
  out.set(data, o);
  return out;
}

function unpackPlaintext(bytes: Uint8Array): { name: string; type: string; data: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const nameLen = view.getUint16(o); o += 2;
  const name = new TextDecoder().decode(bytes.subarray(o, o + nameLen)); o += nameLen;
  const typeLen = view.getUint16(o); o += 2;
  const type = new TextDecoder().decode(bytes.subarray(o, o + typeLen)); o += typeLen;
  return { name, type, data: bytes.subarray(o) };
}

export async function encryptFile(name: string, type: string, data: Uint8Array, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plain = packPlaintext(name, type, data);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plain as BufferSource));

  const header = new Uint8Array(4 + 4 + 16 + 12);
  const hv = new DataView(header.buffer);
  header.set(MAGIC, 0);
  hv.setUint32(4, iterations);
  header.set(salt, 8);
  header.set(iv, 24);
  const out = new Uint8Array(header.length + ct.length);
  out.set(header); out.set(ct, header.length);
  return out;
}

export async function decryptFile(container: Uint8Array, passphrase: string): Promise<{ name: string; type: string; data: Uint8Array }> {
  if (container.length < 36 || !MAGIC.every((b, i) => container[i] === b)) throw new Error('Not a PrivFirst encrypted file.');
  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const iterations = view.getUint32(4);
  if (!(iterations > 0 && iterations <= 10_000_000)) throw new Error('Corrupted file (bad iteration count).');
  const salt = container.slice(8, 24);
  const iv = container.slice(24, 36);
  const ct = container.slice(36);
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: AAD }, key, ct as BufferSource));
    return unpackPlaintext(plain);
  } catch {
    throw new Error('Wrong passphrase, or the file is corrupted.');
  }
}
