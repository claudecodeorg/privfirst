import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`);
}
// Maskable: full-bleed background with the logo inside the safe zone.
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0f172a' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile('public/icon-maskable-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons written');
