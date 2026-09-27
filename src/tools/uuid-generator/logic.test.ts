import { describe, expect, it } from 'vitest';
import { generate, isValidUuid, uuidV7 } from './logic';

describe('generate', () => {
  it('produces the requested count, all valid and unique', () => {
    for (const version of ['v4', 'v7'] as const) {
      const ids = generate(version, 50);
      expect(ids).toHaveLength(50);
      expect(new Set(ids).size).toBe(50);
      ids.forEach((id) => expect(isValidUuid(id)).toBe(true));
    }
  });
  it('rejects out-of-range counts', () => {
    expect(() => generate('v4', 0)).toThrow();
    expect(() => generate('v4', 1001)).toThrow();
  });
});

describe('uuidV7', () => {
  it('marks the version and variant nibbles correctly', () => {
    const id = uuidV7();
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
  });
  it('sorts chronologically with increasing timestamps', () => {
    const zero = new Uint8Array(10);
    const early = uuidV7(1_000_000, zero);
    const late = uuidV7(2_000_000, zero);
    expect(early < late).toBe(true);
  });
  it('embeds the given timestamp in the first 48 bits', () => {
    const now = 1735689600000; // 2025-01-01T00:00:00Z
    const id = uuidV7(now, new Uint8Array(10));
    const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(ms).toBe(now);
  });
});
