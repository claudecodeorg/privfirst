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

export type Rotation = 0 | 90 | 180 | 270;

export function rotatedDims(width: number, height: number, rotation: Rotation): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/** A crop rectangle in 0..1 fractions of the (rotated) image. */
export interface CropRect { x: number; y: number; width: number; height: number }

export function cropToPixels(crop: CropRect, width: number, height: number): { x: number; y: number; width: number; height: number } {
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const x = Math.min(Math.round(clamp01(crop.x) * width), width - 1);
  const y = Math.min(Math.round(clamp01(crop.y) * height), height - 1);
  const w = Math.max(1, Math.min(Math.round(clamp01(crop.width) * width), width - x));
  const h = Math.max(1, Math.min(Math.round(clamp01(crop.height) * height), height - y));
  return { x, y, width: w, height: h };
}
