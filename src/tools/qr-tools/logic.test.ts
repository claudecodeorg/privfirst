import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { dataUrlToBytes, decodeRgba, qrPngBlob, qrSvg, wifiPayload } from './logic';

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

describe('PNG export', () => {
  it('produces real PNG bytes that decode back to the input', async () => {
    const blob = await qrPngBlob('https://example.com/png', 'M', 256);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe('image/png');
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(decodeRgba(new Uint8ClampedArray(data), info.width, info.height)).toBe('https://example.com/png');
  });
  it('decodes base64 and percent-encoded data URLs, rejects others', () => {
    expect([...dataUrlToBytes('data:text/plain;base64,aGk=')]).toEqual([104, 105]);
    expect([...dataUrlToBytes('data:,hi%21')]).toEqual([104, 105, 33]);
    expect(() => dataUrlToBytes('https://x')).toThrow();
  });
});
