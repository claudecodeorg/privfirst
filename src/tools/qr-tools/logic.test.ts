import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { decodeRgba, qrSvg, wifiPayload } from './logic';

/** Rasterise a QR matrix to RGBA with a quiet zone so jsQR can decode it. */
function raster(text: string, scale = 6, quiet = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, dim = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(x, y)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * dim + (x + quiet) * scale + dx) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  return { px, dim };
}

describe('QR round trip', () => {
  it.each(['hello', 'https://example.com/a?b=c&d=e', 'Ünïcödé ✓ 日本語'])('decodes %s', (text) => {
    const { px, dim } = raster(text);
    expect(decodeRgba(px, dim, dim)).toBe(text);
  });
  it('returns null when there is no code', () => expect(decodeRgba(new Uint8ClampedArray(50 * 50 * 4).fill(255), 50, 50)).toBeNull());
});

describe('generation', () => {
  it('produces SVG', async () => expect(await qrSvg('hi', 'M')).toMatch(/^<svg/));
  it('rejects empty text', () => expect(() => qrSvg('', 'M')).toThrow());
});

describe('wifiPayload', () => {
  it('escapes special characters', () => expect(wifiPayload('My;Net', 'p:a"ss', 'WPA', false)).toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:a\\"ss;;'));
  it('omits password for open networks and flags hidden', () => expect(wifiPayload('Cafe', 'ignored', 'nopass', true)).toBe('WIFI:T:nopass;S:Cafe;H:true;;'));
});
