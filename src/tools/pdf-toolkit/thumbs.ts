import { openPdf } from '../../lib/pdfjs';

export interface Thumbs {
  /** Draws page `index` (zero-based) into `canvas`, fitted inside maxW x maxH CSS pixels. Resolves to the CSS size used. */
  render(index: number, canvas: HTMLCanvasElement, maxW: number, maxH: number): Promise<{ w: number; h: number }>;
  destroy(): void;
}

export async function openThumbs(data: Uint8Array): Promise<Thumbs> {
  const pdf = await openPdf(data);
  return { render: (index, canvas, maxW, maxH) => pdf.renderFit(index, canvas, maxW, maxH), destroy: () => pdf.destroy() };
}
