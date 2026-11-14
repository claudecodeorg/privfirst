import { concatBytes } from '../../lib/zip';

export interface FileInfo { name: string; size: number }
export interface SliceRange { start: number; end: number }
export interface SliceSource { fileIndex: number; start: number; end: number }

const END_OVERHEAD = 22; // end-of-central-directory record, once per zip
const SAFETY_MARGIN = 64; // per-entry cushion so a real build never edges over the threshold
const PART_SUFFIX_SAMPLE = '.part999of999'; // representative length for sizing a slice name's overhead

/** STORE-format zip overhead for one entry: a 30B local header and a 46B central-directory
 *  header, each carrying the (UTF-8) name once. */
export function entryOverhead(name: string): number {
  return 76 + 2 * new TextEncoder().encode(name).length;
}

/** The most raw bytes a single entry named `${name}${suffix}` can hold and still fit in one
 *  zip under `thresholdBytes`, reserving the end-of-directory record and a safety cushion. */
export function maxPayloadFor(name: string, thresholdBytes: number): number {
  const overhead = entryOverhead(name + PART_SUFFIX_SAMPLE) + SAFETY_MARGIN + END_OVERHEAD;
  const payload = thresholdBytes - overhead;
  if (payload <= 0) {
    throw new Error(`Threshold is too small to fit even one part of "${name}" (need at least ${overhead + 1} bytes).`);
  }
  return payload;
}

/** Splits a `size`-byte span into consecutive ranges of at most `maxPayload` bytes each. */
export function planSliceRanges(size: number, maxPayload: number): SliceRange[] {
  if (size <= 0) return [{ start: 0, end: 0 }];
  const ranges: SliceRange[] = [];
  for (let start = 0; start < size; start += maxPayload) {
    ranges.push({ start, end: Math.min(start + maxPayload, size) });
  }
  return ranges;
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** The in-zip entry name for one slice of a split file, e.g. "video.mp4.part01of03". */
export function partName(base: string, index: number, count: number): string {
  const width = String(count).length;
  return `${base}.part${pad(index + 1, width)}of${pad(count, width)}`;
}

/** Reverses `partName`, or null if `name` isn't one (an ordinary, unsliced file). */
export function parsePartName(name: string): { base: string; index: number; count: number } | null {
  const m = /^(.+)\.part(\d+)of(\d+)$/.exec(name);
  if (!m) return null;
  return { base: m[1], index: Number(m[2]) - 1, count: Number(m[3]) };
}

/**
 * Groups files into as few zips as possible without any zip exceeding `thresholdBytes`,
 * using first-fit in input order (not size-sorted — keeps output predictable and matches
 * the order files were picked in, at the cost of not always finding the fewest possible bins).
 *
 * Every `file` here is assumed to already fit under `thresholdBytes` on its own (see
 * `expandForSlicing`, which slices anything that doesn't first) — `oversized` is a defensive
 * fallback for the rare case something still doesn't fit, not the normal path.
 */
export function planBins(files: FileInfo[], thresholdBytes: number): { bins: number[][]; oversized: number[] } {
  if (thresholdBytes <= END_OVERHEAD + SAFETY_MARGIN) {
    throw new Error(`Threshold is too small to fit even one zip's own overhead (need at least ${END_OVERHEAD + SAFETY_MARGIN} bytes).`);
  }

  const bins: number[][] = [];
  const remaining: number[] = [];
  const oversized: number[] = [];

  files.forEach((file, i) => {
    const cost = entryOverhead(file.name) + file.size + SAFETY_MARGIN;
    if (cost + END_OVERHEAD > thresholdBytes) {
      bins.push([i]);
      remaining.push(0); // already over threshold alone; don't let more pile on
      oversized.push(i);
      return;
    }
    const fit = bins.findIndex((_, b) => remaining[b] >= cost);
    if (fit !== -1) {
      bins[fit].push(i);
      remaining[fit] -= cost;
    } else {
      bins.push([i]);
      remaining.push(thresholdBytes - END_OVERHEAD - cost);
    }
  });

  return { bins, oversized };
}

/**
 * Expands `files` so every item fits under `thresholdBytes` on its own: a file that doesn't
 * fit whole is replaced by several numbered slice entries (see `partName`) sized to fit.
 * `sources[i]` says which byte range of which original file `items[i]` is — always a real
 * range (0..size for an unsliced file), so callers can read both cases the same way via
 * `file.slice(start, end)`.
 */
export function expandForSlicing(files: FileInfo[], thresholdBytes: number): { items: FileInfo[]; sources: SliceSource[] } {
  const items: FileInfo[] = [];
  const sources: SliceSource[] = [];
  files.forEach((file, fileIndex) => {
    const wholeCost = entryOverhead(file.name) + file.size + SAFETY_MARGIN;
    if (wholeCost + END_OVERHEAD <= thresholdBytes) {
      items.push(file);
      sources.push({ fileIndex, start: 0, end: file.size });
      return;
    }
    const maxPayload = maxPayloadFor(file.name, thresholdBytes);
    const ranges = planSliceRanges(file.size, maxPayload);
    ranges.forEach((r, i) => {
      items.push({ name: partName(file.name, i, ranges.length), size: r.end - r.start });
      sources.push({ fileIndex, start: r.start, end: r.end });
    });
  });
  return { items, sources };
}

/**
 * Reassembles any slice groups found in `entries` (see `partName`/`parsePartName`) back into
 * whole files, passing ordinary (unsliced) entries through unchanged. Throws if a group is
 * missing a part or has a duplicate — reassembling a partial file would silently corrupt it.
 */
export function reassembleSlices(entries: { name: string; data: Uint8Array }[]): { name: string; data: Uint8Array }[] {
  const groups = new Map<string, { count: number; chunks: (Uint8Array | undefined)[] }>();
  const out: { name: string; data: Uint8Array }[] = [];

  for (const entry of entries) {
    const part = parsePartName(entry.name);
    if (!part) { out.push(entry); continue; }
    const key = `${part.base}\u0000${part.count}`;
    let group = groups.get(key);
    if (!group) { group = { count: part.count, chunks: new Array(part.count) }; groups.set(key, group); }
    if (group.chunks[part.index] !== undefined) throw new Error(`Duplicate part ${part.index + 1} of ${part.count} for "${part.base}".`);
    group.chunks[part.index] = entry.data;
  }

  for (const [key, group] of groups) {
    const base = key.slice(0, key.lastIndexOf('\u0000'));
    const missing = group.chunks.findIndex((c) => c === undefined);
    if (missing !== -1) throw new Error(`Missing part ${missing + 1} of ${group.count} for "${base}" — select all of its zip parts.`);
    out.push({ name: base, data: concatBytes(group.chunks as Uint8Array[]) });
  }

  return out;
}

/** Dedupes filenames that collide (e.g. after bin-packing or merging files picked from
 *  different folders), appending " (2)", " (3)"... before the last extension. */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const extMatch = /\.[^./\\]+$/.exec(name);
    const ext = extMatch ? extMatch[0] : '';
    const base = ext ? name.slice(0, name.length - ext.length) : name;
    return `${base} (${count})${ext}`;
  });
}
