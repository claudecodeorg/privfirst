import { describe, expect, it } from 'vitest';
import { isEnvelope, newSession, seal, unseal, type Note } from './crypto';

const ITER = 1000; // fast for tests
const notes: Note[] = [{ id: '1', title: 'Secret ✓', body: 'line1\nline2 — ünïcode 🔒', updated: 1 }];

describe('vault crypto', () => {
  it('round-trips notes including unicode', async () => {
    const s = await newSession('correct horse', ITER);
    const env = await seal(s, notes);
    const out = await unseal(env, 'correct horse');
    expect(out.notes).toEqual(notes);
  });
  it('does not leak plaintext into the envelope', async () => {
    const env = await seal(await newSession('pw-pw-pw-pw', ITER), notes);
    expect(JSON.stringify(env)).not.toContain('Secret');
    expect(atob(env.data)).not.toContain('line1');
  });
  it('rejects a wrong passphrase', async () => {
    const env = await seal(await newSession('right-pass', ITER), notes);
    await expect(unseal(env, 'wrong-pass')).rejects.toThrow(/Wrong passphrase/);
  });
  it('detects tampering with the ciphertext', async () => {
    const env = await seal(await newSession('right-pass', ITER), notes);
    const bytes = Uint8Array.from(atob(env.data), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await expect(unseal({ ...env, data: btoa(String.fromCharCode(...bytes)) }, 'right-pass')).rejects.toThrow();
  });
  it('uses a fresh IV on each save while reusing the key', async () => {
    const s = await newSession('right-pass', ITER);
    const a = await seal(s, notes), b = await seal(s, notes);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect(a.salt).toBe(b.salt);
  });
  it('binds the iteration count check into validation', () => {
    expect(isEnvelope({ v: 1, iter: 1, salt: 'a', iv: 'b', data: 'c' })).toBe(true);
    expect(isEnvelope({ v: 1, iter: 1e12, salt: 'a', iv: 'b', data: 'c' })).toBe(false);
    expect(isEnvelope(null)).toBe(false);
  });
});
