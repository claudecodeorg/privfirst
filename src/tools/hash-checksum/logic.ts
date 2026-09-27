import { md5 } from './md5';

export const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

const toHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function digestHex(algo: Algorithm, data: Uint8Array): Promise<string> {
  if (algo === 'MD5') return toHex(md5(data));
  return toHex(new Uint8Array(await crypto.subtle.digest(algo, data as BufferSource)));
}

export async function digestAll(data: Uint8Array): Promise<Record<Algorithm, string>> {
  const entries = await Promise.all(ALGORITHMS.map(async (a) => [a, await digestHex(a, data)] as const));
  return Object.fromEntries(entries) as Record<Algorithm, string>;
}

/** Case-insensitive, ignores surrounding whitespace, since that's how hashes are usually pasted around. */
export function hashesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
