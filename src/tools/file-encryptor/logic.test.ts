import { describe, expect, it } from 'vitest';
import { decryptFile, encryptFile } from './logic';

const ITER = 1000; // fast for tests

describe('encryptFile / decryptFile', () => {
  it('round-trips name, type and binary content exactly', async () => {
    const data = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) & 255);
    const enc = await encryptFile('report.pdf', 'application/pdf', data, 'correct horse battery staple', ITER);
    const out = await decryptFile(enc, 'correct horse battery staple');
    expect(out.name).toBe('report.pdf');
    expect(out.type).toBe('application/pdf');
    expect(out.data).toEqual(data);
  });
  it('handles unicode filenames', async () => {
    const enc = await encryptFile('résumé 简历 🔒.txt', 'text/plain', new TextEncoder().encode('hi'), 'pw-pw-pw-pw', ITER);
    expect((await decryptFile(enc, 'pw-pw-pw-pw')).name).toBe('résumé 简历 🔒.txt');
  });
  it('does not leak the filename or content into the encrypted bytes', async () => {
    const enc = await encryptFile('super-secret-name.txt', 'text/plain', new TextEncoder().encode('the secret payload'), 'right-pass', ITER);
    const text = Buffer.from(enc).toString('latin1');
    expect(text).not.toMatch(/super-secret-name|the secret payload/);
  });
  it('rejects a wrong passphrase', async () => {
    const enc = await encryptFile('a.txt', 'text/plain', new TextEncoder().encode('x'), 'right', ITER);
    await expect(decryptFile(enc, 'wrong')).rejects.toThrow(/Wrong passphrase/);
  });
  it('detects tampering with the ciphertext', async () => {
    const enc = await encryptFile('a.txt', 'text/plain', new TextEncoder().encode('x'), 'right', ITER);
    const tampered = enc.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptFile(tampered, 'right')).rejects.toThrow();
  });
  it('rejects a file that is not one of ours', async () => {
    await expect(decryptFile(new TextEncoder().encode('not encrypted at all'), 'pw')).rejects.toThrow(/Not a PrivFirst/);
  });
  it('uses a fresh salt and IV each time, so identical inputs produce different output', async () => {
    const data = new TextEncoder().encode('same content');
    const a = await encryptFile('a.txt', 'text/plain', data, 'pw', ITER);
    const b = await encryptFile('a.txt', 'text/plain', data, 'pw', ITER);
    expect(a).not.toEqual(b);
  });
});
