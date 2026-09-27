import { describe, expect, it } from 'vitest';
import { crc32, unzipStore, zipStore } from './zip';

describe('crc32', () => {
  it('matches the standard CRC-32 check value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('is 0 for empty input', () => expect(crc32(new Uint8Array())).toBe(0));
});

describe('zipStore / unzipStore', () => {
  it('round-trips multiple files, including binary content', () => {
    const entries = [
      { name: 'a.txt', data: new TextEncoder().encode('hello world') },
      { name: 'sub/b.bin', data: Uint8Array.from({ length: 300 }, (_, i) => i & 255) },
      { name: 'empty.txt', data: new Uint8Array() },
    ];
    const back = unzipStore(zipStore(entries));
    expect(back.map((e) => e.name)).toEqual(entries.map((e) => e.name));
    back.forEach((e, i) => expect(e.data).toEqual(entries[i].data));
  });
  it('produces a valid local-file-header signature', () => {
    const zip = zipStore([{ name: 'x', data: new Uint8Array([1, 2, 3]) }]);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
  });
});
