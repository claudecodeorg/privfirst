import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analyze, detectKind, stripMetadata } from './logic';

const text = (b: Uint8Array) => Buffer.from(b).toString('latin1');
const EXIF = {
  IFD0: { Make: 'SecretCam', Model: 'PrivacyLeak 9000', Software: 'EditorPro', Orientation: '6' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '0/1 7/1 30/1' },
} as never;

async function base() {
  // Noisy gradient so the codec has real data to encode.
  const raw = Buffer.alloc(64 * 48 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + (i >> 3)) & 255;
  return sharp(raw, { raw: { width: 64, height: 48, channels: 3 } });
}
const pixels = async (b: Uint8Array) => (await sharp(Buffer.from(b)).raw().toBuffer());

describe('JPEG', () => {
  it('finds and reports EXIF incl. GPS, then removes it losslessly', async () => {
    const jpeg = new Uint8Array(await (await base()).jpeg({ quality: 90 }).withExif(EXIF).toBuffer());
    const a = analyze(jpeg);
    expect(a.kind).toBe('jpeg');
    expect(a.found).toContain('EXIF');
    expect(a.exif.entries.find((e) => e.label === 'Camera make')?.value).toBe('SecretCam');
    expect(a.exif.gps?.lat).toBeCloseTo(51.5, 4);
    expect(a.exif.gps?.lon).toBeCloseTo(-0.125, 4);

    const { data } = stripMetadata(jpeg, { keepOrientation: false });
    expect(text(data)).not.toMatch(/SecretCam|PrivacyLeak|EditorPro|Exif/);
    expect(analyze(data).found).toEqual([]);
    expect(Buffer.compare(await pixels(data), await pixels(jpeg))).toBe(0); // identical decoded pixels
    expect(data.length).toBeLessThan(jpeg.length);
  });
  it('keeps only the orientation tag when asked', async () => {
    // sharp overwrites Orientation from withExif with the image's own, so set it via withMetadata.
    const jpeg = new Uint8Array(await (await base()).jpeg().withExif(EXIF).withMetadata({ orientation: 6 }).toBuffer());
    expect(analyze(jpeg).exif.orientation).toBe(6);
    const { data } = stripMetadata(jpeg, { keepOrientation: true });
    expect(text(data)).not.toMatch(/SecretCam|PrivacyLeak/);
    const a = analyze(data);
    expect(a.exif.orientation).toBe(6);
    expect(a.exif.entries).toEqual([]);
    expect(a.found).toEqual(['Rotation flag only (no personal data)']);
    expect((await sharp(Buffer.from(data)).metadata()).orientation).toBe(6);
    expect(Buffer.compare(await pixels(data), await pixels(jpeg))).toBe(0);
  });
  it('removes comments, XMP and trailing data', async () => {
    const jpeg = new Uint8Array(await (await base()).jpeg().toBuffer());
    const com = Buffer.from('FFFE0010' + Buffer.from('my secret note').toString('hex'), 'hex'); // length 16 = 2 + 14
    const xmpBody = Buffer.from('http://ns.adobe.com/xap/1.0/\0');
    const xmp = Buffer.concat([Buffer.from('FFE1', 'hex'), Buffer.from([0x00, xmpBody.length + 2]), xmpBody]);
    const dirty = Buffer.concat([jpeg.subarray(0, 2), com, xmp, jpeg.subarray(2), Buffer.from('TRAILING-SECRET')]);
    expect(analyze(dirty).found).toEqual(expect.arrayContaining(['Comment', 'XMP', 'Trailing data after image']));
    const { data } = stripMetadata(dirty);
    expect(text(data)).not.toMatch(/secret|SECRET|adobe/i);
    expect(Buffer.compare(await pixels(data), await pixels(jpeg))).toBe(0);
  });
  it('handles progressive JPEGs (multiple scans)', async () => {
    const jpeg = new Uint8Array(await (await base()).jpeg({ progressive: true }).withExif(EXIF).toBuffer());
    const { data } = stripMetadata(jpeg, { keepOrientation: false });
    expect(Buffer.compare(await pixels(data), await pixels(jpeg))).toBe(0);
  });
  it('rejects truncated input instead of hanging', () => {
    expect(() => stripMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]))).toThrow(/Corrupt/);
  });
});

describe('PNG', () => {
  it('drops EXIF and text chunks but preserves pixels', async () => {
    const png = new Uint8Array(await (await base()).png().withExif(EXIF).toBuffer());
    // Inject a tEXt chunk right after IHDR (CRC is not validated by the stripper or by sharp's libspng on ancillary chunks).
    const body = Buffer.from('parameters\0secret prompt text');
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const chunk = Buffer.concat([len, Buffer.from('tEXt'), body, Buffer.alloc(4)]);
    const dirty = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
    const a = analyze(dirty);
    expect(a.found).toEqual(expect.arrayContaining(['EXIF', 'Text metadata']));
    expect(a.exif.entries.some((e) => e.value.includes('secret prompt'))).toBe(true);
    const { data } = stripMetadata(dirty);
    expect(text(data)).not.toMatch(/tEXt|eXIf|SecretCam|secret prompt/);
    expect(detectKind(data)).toBe('png');
    expect(Buffer.compare(await pixels(data), await pixels(png))).toBe(0);
  });
});

describe('WebP', () => {
  it('drops EXIF chunk, fixes header, preserves pixels', async () => {
    const webp = new Uint8Array(await (await base()).webp({ lossless: true }).withExif(EXIF).toBuffer());
    const a = analyze(webp);
    expect(a.found).toContain('EXIF');
    expect(a.exif.entries.find((e) => e.label === 'Camera model')?.value).toBe('PrivacyLeak 9000');
    const { data } = stripMetadata(webp);
    expect(text(data)).not.toMatch(/EXIF|SecretCam/);
    expect(new DataView(data.buffer).getUint32(4, true)).toBe(data.length - 8);
    expect(analyze(data).found).toEqual([]);
    expect(Buffer.compare(await pixels(data), await pixels(webp))).toBe(0);
  });
});

describe('detectKind', () => {
  it('returns null for unknown data', () => {
    expect(detectKind(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(() => stripMetadata(new Uint8Array([1, 2, 3, 4]))).toThrow(/Unsupported/);
  });
});
