import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Privacy guarantee enforced by the browser: the built app can only talk to its own origin.
// Injected for builds only, since the dev server needs inline scripts and a websocket for HMR.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const cspPlugin = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml: () => [
    { tag: 'meta', injectTo: 'head-prepend' as const, attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP } },
  ],
};

// pdf.js needs its standard-font data to draw text in PDFs that don't embed Helvetica/Times/Courier.
// Served from our own origin so it works offline and under the CSP (connect-src 'self').
const FONT_DIR = 'node_modules/pdfjs-dist/standard_fonts';
const pdfFonts: Plugin = {
  name: 'pdfjs-standard-fonts',
  configureServer(server) {
    server.middlewares.use('/standard_fonts', (req, res, next) => {
      try { res.end(readFileSync(join(FONT_DIR, basename((req.url ?? '').split('?')[0])))); } catch { next(); }
    });
  },
  generateBundle() {
    for (const f of readdirSync(FONT_DIR).filter((n) => /\.(pfb|ttf)$/.test(n))) {
      this.emitFile({ type: 'asset', fileName: `standard_fonts/${f}`, source: readFileSync(join(FONT_DIR, f)) });
    }
  },
};

// Native Android (Capacitor) builds bundle all assets into the app itself, so a service worker /
// precache would just be redundant (and the PWA's own update mechanism makes no sense inside a
// native shell that updates via Play Store app updates instead).
const isCapBuild = process.env.CAP_BUILD === '1';

// src/lib/billing.mock.ts is a dev-only harness for exercising Paywall UI states (?mockBilling=...)
// without a real device. It must never ship in a release build (web or native) — relying on the
// minifier's dead-code elimination to drop it turned out NOT to hold (verified empirically: a
// `import.meta.env.DEV`-gated dynamic import of it still produced a reachable chunk in the output).
// This plugin instead deterministically swaps it for an inert stub for any `vite build`, so its
// absence doesn't depend on bundler internals. scripts/check-no-mock-in-release.mjs re-verifies it.
const stripMockBilling: Plugin = {
  name: 'strip-mock-billing-in-build',
  apply: 'build',
  enforce: 'pre',
  resolveId(source, importer) {
    if (importer && /\/billing\.native\.ts$/.test(importer) && /\.\/billing\.mock$/.test(source)) {
      return '\0virtual:billing-mock-stub';
    }
  },
  load(id) {
    if (id === '\0virtual:billing-mock-stub') {
      return [
        'export function readMockState() { return null; }',
        'export function mockQueryPurchases() { return { owned: false }; }',
        'export function mockProductDetails() { return { found: false }; }',
        'export function mockPurchase() { return { status: "error" }; }',
      ].join('\n');
    }
  },
};

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    cspPlugin,
    pdfFonts,
    stripMockBilling,
    ...(isCapBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PrivFirst',
        short_name: 'PrivFirst',
        description: 'Privacy-first tools that run entirely on your device.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Lets an installed desktop PWA appear in the OS "Open with" menu for these file types
        // (Chrome/Edge only). src/lib/launchFiles.ts routes the opened file to the right tool.
        file_handlers: [
          { action: './#/pdf-toolkit', accept: { 'application/pdf': ['.pdf'] } },
          { action: './#/image-compressor', accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] } },
        ],
      },
      workbox: {
        // Precache every built asset (including lazy tool chunks) so all tools work offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,pfb,ttf}'],
        navigateFallback: 'index.html',
      },
    })]),
  ],
  build: { target: 'es2022' },
});
