import { describe, expect, it } from 'vitest';
import { dedupeNames, entryOverhead, planBins } from './logic';

describe('entryOverhead', () => {
  it('matches the hand-computed STORE-format overhead', () => {
    // 76 fixed bytes (30B local header + 46B central header) + name counted in both.
    expect(entryOverhead('a.txt')).toBe(76 + 2 * 5);
  });
  it('grows with name length', () => {
    expect(entryOverhead('a-much-longer-filename.txt')).toBeGreaterThan(entryOverhead('a.txt'));
  });
});

describe('planBins', () => {
  const files = (sizes: number[]): { name: string; size: number }[] =>
    sizes.map((size, i) => ({ name: `f${i}.bin`, size }));

  it('packs several same-size files greedily into as few bins as fit', () => {
    const tenMb = 10 * 1024 * 1024;
    const { bins, oversized } = planBins(files([tenMb, tenMb, tenMb]), 25 * 1024 * 1024);
    expect(oversized).toEqual([]);
    expect(bins).toHaveLength(2);
    expect(bins[0]).toEqual([0, 1]);
    expect(bins[1]).toEqual([2]);
  });

  it('covers every original index exactly once, across varied fixtures', () => {
    const cases = [
      files([1, 2, 3, 4, 5].map((n) => n * 1024 * 1024)),
      files(Array.from({ length: 20 }, (_, i) => (i + 1) * 100_000)),
      files([0, 0, 500_000]),
    ];
    for (const fs of cases) {
      const { bins } = planBins(fs, 1024 * 1024);
      const seen = bins.flat().slice().sort((a, b) => a - b);
      expect(seen).toEqual(fs.map((_, i) => i));
    }
  });

  it('gives an oversized file its own bin and flags it', () => {
    const threshold = 1024 * 1024;
    const big = threshold * 3;
    const { bins, oversized } = planBins(files([1000, big, 2000]), threshold);
    const bigBinIndex = bins.findIndex((b) => b.includes(1));
    expect(bins[bigBinIndex]).toEqual([1]);
    expect(oversized).toEqual([1]);
  });

  it('throws when the threshold cannot fit even one entry\'s overhead', () => {
    expect(() => planBins(files([10]), 10)).toThrow();
  });

  it('returns no bins for an empty file list', () => {
    expect(planBins([], 1024)).toEqual({ bins: [], oversized: [] });
  });
});

describe('dedupeNames', () => {
  it('leaves non-colliding names unchanged', () => {
    expect(dedupeNames(['a.txt', 'b.txt'])).toEqual(['a.txt', 'b.txt']);
  });
  it('appends a counter before the last extension on collision', () => {
    expect(dedupeNames(['a.txt', 'a.txt', 'b.txt', 'a.txt'])).toEqual(['a.txt', 'a (2).txt', 'b.txt', 'a (3).txt']);
  });
  it('splits only the last extension, like "archive.tar.gz"', () => {
    expect(dedupeNames(['archive.tar.gz', 'archive.tar.gz'])).toEqual(['archive.tar.gz', 'archive.tar (2).gz']);
  });
  it('handles extension-less names', () => {
    expect(dedupeNames(['README', 'README'])).toEqual(['README', 'README (2)']);
  });
});
