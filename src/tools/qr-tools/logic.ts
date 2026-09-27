import jsQR from 'jsqr';
import QRCode from 'qrcode';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export function qrSvg(text: string, ecc: Ecc): Promise<string> {
  if (!text) throw new Error('Enter some text first.');
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: ecc, margin: 2 });
}

export function qrPngDataUrl(text: string, ecc: Ecc, size = 512): Promise<string> {
  if (!text) throw new Error('Enter some text first.');
  return QRCode.toDataURL(text, { errorCorrectionLevel: ecc, margin: 2, width: size });
}

/** Decodes a data: URL locally. fetch() cannot be used: the app's CSP (connect-src 'self') blocks data: URLs. */
export function dataUrlToBytes(url: string): Uint8Array {
  const m = /^data:[^;,]*(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Not a data URL.');
  return m[1] ? Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[2]));
}

export async function qrPngBlob(text: string, ecc: Ecc, size = 1024): Promise<Blob> {
  return new Blob([dataUrlToBytes(await qrPngDataUrl(text, ecc, size)) as BlobPart], { type: 'image/png' });
}

/** Wi-Fi join payload; special characters in fields are backslash-escaped per the de-facto spec. */
export function wifiPayload(ssid: string, password: string, security: 'WPA' | 'WEP' | 'nopass', hidden: boolean): string {
  const esc = (s: string) => s.replace(/([\;,":])/g, '\\$1');
  return `WIFI:T:${security};S:${esc(ssid)};${security === 'nopass' ? '' : `P:${esc(password)};`}${hidden ? 'H:true;' : ''};`;
}

export function decodeRgba(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}
