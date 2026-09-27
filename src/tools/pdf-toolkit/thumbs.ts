import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';

// The legacy build runs on older Safari/iOS. Worker and library load lazily, only when a PDF is opened.
let lib: Promise<typeof PdfJs> | undefined;
function loadLib(): Promise<typeof PdfJs> {
  return (lib ??= (async () => {
    const [pdfjs, { default: Worker }] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'),
    ]);
    pdfjs.GlobalWorkerOptions.workerPort = new Worker();
    return pdfjs;
  })());
}

export interface Thumbs {
  /** Draws page `index` (zero-based) into `canvas`, fitted inside maxW x maxH CSS pixels. Resolves to the CSS size used. */
  render(index: number, canvas: HTMLCanvasElement, maxW: number, maxH: number): Promise<{ w: number; h: number }>;
  destroy(): void;
}

export async function openThumbs(data: Uint8Array): Promise<Thumbs> {
  const pdfjs = await loadLib();
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    isEvalSupported: false, // the app's CSP forbids eval
    disableFontFace: true, // draw glyphs as paths instead of injecting @font-face (also CSP-friendly)
    standardFontDataUrl: new URL(`${import.meta.env.BASE_URL}standard_fonts/`, location.href).href, // bundled by vite.config.ts
  }).promise;

  // One page at a time keeps memory flat on large documents.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    render(index, canvas, maxW, maxH) {
      const job = queue.then(async () => {
        const page = await doc.getPage(index + 1);
        try {
          const base = page.getViewport({ scale: 1 });
          const fit = Math.min(maxW / base.width, maxH / base.height);
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: fit * dpr });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          return { w: base.width * fit, h: base.height * fit };
        } finally { page.cleanup(); }
      });
      queue = job.catch(() => undefined);
      return job;
    },
    destroy() { void doc.destroy(); },
  };
}
