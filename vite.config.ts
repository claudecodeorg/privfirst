import { defineConfig } from 'vite';
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

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    cspPlugin,
    VitePWA({
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
      },
      workbox: {
        // Precache every built asset (including lazy tool chunks) so all tools work offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: { target: 'es2022' },
});
