export type OutFormat = 'image/jpeg' | 'image/webp' | 'image/png';

/** Scales (w, h) down to fit inside maxSide on the longest edge; never upscales. maxSide 0 = no limit. */
export function fitSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  if (!(w > 0 && h > 0)) throw new RangeError('Invalid image size');
  if (!maxSide || Math.max(w, h) <= maxSide) return { width: w, height: h };
  const s = maxSide / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

export function extensionFor(type: OutFormat): string {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
}

export function savings(before: number, after: number): string {
  if (!before) return '';
  const pct = Math.round((1 - after / before) * 100);
  return pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`;
}
