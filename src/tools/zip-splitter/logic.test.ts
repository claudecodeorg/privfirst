import { describe, expect, it } from 'vitest';
import {
  dedupeNames, entryOverhead, expandForSlicing, maxPayloadFor, partName, parsePartName,
  planBins, planSliceRanges, reassembleSlices,
} from './logic';

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

describe('planSliceRanges', () => {
  it('covers the whole size in consecutive, non-overlapping ranges', () => {
    const ranges = planSliceRanges(37 * 1024 * 1024, 25 * 1024 * 1024);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 0, end: 25 * 1024 * 1024 });
    expect(ranges[1]).toEqual({ start: 25 * 1024 * 1024, end: 37 * 1024 * 1024 });
  });
  it('returns a single empty range for a zero-byte file', () => {
    expect(planSliceRanges(0, 1000)).toEqual([{ start: 0, end: 0 }]);
  });
});

describe('partName / parsePartName', () => {
  it('round-trips', () => {
    const name = partName('video.mp4', 1, 3);
    expect(parsePartName(name)).toEqual({ base: 'video.mp4', index: 1, count: 3 });
  });
  it('returns null for an ordinary filename', () => {
    expect(parsePartName('video.mp4')).toBeNull();
  });
});

describe('expandForSlicing', () => {
  it('passes a file that already fits straight through, unsliced', () => {
    const { items, sources } = expandForSlicing([{ name: 'small.txt', size: 1000 }], 1024 * 1024);
    expect(items).toEqual([{ name: 'small.txt', size: 1000 }]);
    expect(sources).toEqual([{ fileIndex: 0, start: 0, end: 1000 }]);
  });

  it('slices a file bigger than the threshold into parts that each fit (the reported 37MB/25MB bug)', () => {
    const thresholdBytes = 25 * 1024 * 1024;
    const { items, sources } = expandForSlicing([{ name: 'big.mp4', size: 37 * 1024 * 1024 }], thresholdBytes);
    expect(items.length).toBeGreaterThan(1); // must actually be split, not left as one oversized item
    items.forEach((item) => expect(entryOverhead(item.name) + item.size).toBeLessThan(thresholdBytes));
    // The slices reconstruct the exact original byte range with no gap or overlap.
    expect(sources[0]).toEqual({ fileIndex: 0, start: 0, end: sources[0].end });
    for (let i = 1; i < sources.length; i++) expect(sources[i].start).toBe(sources[i - 1].end);
    expect(sources[sources.length - 1].end).toBe(37 * 1024 * 1024);
    const { oversized } = planBins(items, thresholdBytes);
    expect(oversized).toEqual([]); // every slice fits on its own, so planBins never needs to flag it
  });
});

describe('maxPayloadFor', () => {
  it('throws when the threshold cannot fit even one part\'s overhead', () => {
    expect(() => maxPayloadFor('name.bin', 10)).toThrow();
  });
});

describe('reassembleSlices', () => {
  it('passes ordinary entries through unchanged', () => {
    const entries = [{ name: 'a.txt', data: new Uint8Array([1, 2, 3]) }];
    expect(reassembleSlices(entries)).toEqual(entries);
  });

  it('reconstructs a sliced file byte-for-byte, regardless of part order', () => {
    const whole = Uint8Array.from({ length: 50_000 }, (_, i) => i & 255);
    const parts = [
      { name: partName('big.bin', 1, 3), data: whole.slice(20_000, 40_000) },
      { name: partName('big.bin', 0, 3), data: whole.slice(0, 20_000) },
      { name: partName('big.bin', 2, 3), data: whole.slice(40_000, 50_000) },
    ];
    const [out] = reassembleSlices(parts);
    expect(out.name).toBe('big.bin');
    expect(out.data).toEqual(whole);
  });

  it('throws when a part is missing', () => {
    const parts = [{ name: partName('big.bin', 0, 2), data: new Uint8Array([1]) }];
    expect(() => reassembleSlices(parts)).toThrow(/missing part/i);
  });

  it('throws on a duplicate part', () => {
    const parts = [
      { name: partName('big.bin', 0, 2), data: new Uint8Array([1]) },
      { name: partName('big.bin', 0, 2), data: new Uint8Array([2]) },
    ];
    expect(() => reassembleSlices(parts)).toThrow(/duplicate/i);
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
