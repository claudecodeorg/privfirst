export type PageSize = 'fit' | 'a4' | 'letter';

const POINTS = { a4: [595.28, 841.89] as const, letter: [612, 792] as const };

/** The page dimensions (in PDF points) for an image of `imgW`x`imgH`, given a page-size choice. */
export function pageDimsFor(imgW: number, imgH: number, size: PageSize): { width: number; height: number } {
  if (size === 'fit') return { width: imgW, height: imgH };
  const [pw, ph] = POINTS[size];
  const portrait = imgH >= imgW;
  return portrait ? { width: pw, height: ph } : { width: ph, height: pw };
}

/** Scales `imgW`x`imgH` to fit within `pageW`x`pageH` with a margin, returning the draw rect. */
export function fitToPage(imgW: number, imgH: number, pageW: number, pageH: number, margin = 0): { x: number; y: number; width: number; height: number } {
  const availW = pageW - margin * 2, availH = pageH - margin * 2;
  const scale = Math.min(availW / imgW, availH / imgH, 1);
  const width = imgW * scale, height = imgH * scale;
  return { x: (pageW - width) / 2, y: (pageH - height) / 2, width, height };
}

export function sanitizeBaseName(name: string): string {
  const cleaned = name.replace(/\.[^./\\]+$/, '').replace(/[^\w.-]+/g, '_');
  return /^_*$/.test(cleaned) ? 'page' : cleaned;
}
