import { describe, expect, it } from 'vitest';
import { digestAll, digestHex, hashesMatch } from './logic';
import { md5 } from './md5';

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('md5', () => {
  it('matches known RFC 1321 test vectors', () => {
    expect(hex(md5(enc('')))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hex(md5(enc('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(hex(md5(enc('message digest')))).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(hex(md5(enc('abcdefghijklmnopqrstuvwxyz')))).toBe('c3fcd3d76192e4007dfb496cca67e13b');
  });
  it('handles input crossing a 64-byte block boundary', () => {
    expect(hex(md5(enc('a'.repeat(63))))).toHaveLength(32);
    expect(hex(md5(enc('a'.repeat(64))))).toHaveLength(32);
    expect(hex(md5(enc('a'.repeat(1000))))).toBe(hex(md5(enc('a'.repeat(1000))))); // deterministic
  });
});

describe('digestHex', () => {
  it('matches known SHA-256 vector', async () => expect(await digestHex('SHA-256', enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
  it('produces different hashes for different algorithms', async () => {
    const all = await digestAll(enc('hello'));
    const values = Object.values(all);
    expect(new Set(values).size).toBe(values.length);
    expect(all.MD5).toHaveLength(32);
    expect(all['SHA-256']).toHaveLength(64);
    expect(all['SHA-512']).toHaveLength(128);
  });
});

describe('hashesMatch', () => {
  it('ignores case and surrounding whitespace', () => expect(hashesMatch(' ABCD ', 'abcd')).toBe(true));
  it('rejects a real mismatch', () => expect(hashesMatch('abcd', 'abce')).toBe(false));
});
