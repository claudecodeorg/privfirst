export interface FileInfo { name: string; size: number }

const END_OVERHEAD = 22; // end-of-central-directory record, once per zip
const SAFETY_MARGIN = 64; // per-entry cushion so a real build never edges over the threshold

/** STORE-format zip overhead for one entry: a 30B local header and a 46B central-directory
 *  header, each carrying the (UTF-8) name once. */
export function entryOverhead(name: string): number {
  return 76 + 2 * new TextEncoder().encode(name).length;
}

/**
 * Groups files into as few zips as possible without any zip exceeding `thresholdBytes`,
 * using first-fit in input order (not size-sorted — keeps output predictable and matches
 * the order files were picked in, at the cost of not always finding the fewest possible bins).
 *
 * A file whose own size + overhead already exceeds the threshold can't be split further here
 * (this bins whole files, it doesn't slice bytes) — it still gets its own bin, and its index
 * is also returned in `oversized` so callers can warn about it.
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
