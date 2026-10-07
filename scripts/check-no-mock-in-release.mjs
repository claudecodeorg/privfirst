#!/usr/bin/env node
// Verifies PRIVFIRST_MOCK_BILLING_MARKER (src/lib/billing.mock.ts, the dev-only billing test
// harness) never makes it into a production build — i.e. that Vite's dead-code elimination of
// `if (import.meta.env.DEV)` actually removed it, rather than just assuming so.
// Usage: node scripts/check-no-mock-in-release.mjs <dir>   (defaults to ./dist)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const marker = 'PRIVFIRST_MOCK_BILLING_MARKER';
const dir = process.argv[2] || join(new URL('..', import.meta.url).pathname, 'dist');

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|html|mjs)$/.test(p)) yield p;
  }
}

const found = [];
for (const file of walk(dir)) {
  if (readFileSync(file, 'utf8').includes(marker)) found.push(file);
}

if (found.length) {
  console.error(`Mock billing code leaked into the release build (${dir}):`);
  found.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log(`No mock billing code in ${dir} — clean.`);
