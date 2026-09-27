import { parseTiff, type ExifEntry, type ExifSummary } from './exif';

export type ImageKind = 'jpeg' | 'png' | 'webp';
export interface Analysis { kind: ImageKind; found: string[]; exif: ExifSummary }
export interface StripResult { data: Uint8Array; removed: string[] }
export interface StripOptions { keepOrientation: boolean }

const ascii = (b: Uint8Array, s: number, e: number) => String.fromCharCode(...b.subarray(s, e));
const startsWith = (b: Uint8Array, off: number, text: string) => off + text.length <= b.length && ascii(b, off, off + text.length) === text;

export function detectKind(b: Uint8Array): ImageKind | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 8 && startsWith(b, 1, 'PNG') && b[0] === 0x89 && b[4] === 0x0d) return 'png';
  if (b.length > 12 && startsWith(b, 0, 'RIFF') && startsWith(b, 8, 'WEBP')) return 'webp';
  return null;
}

// ---------------------------------------------------------------- JPEG

interface JpegSegment { marker: number; start: number; end: number } // [start, end) covers marker bytes + payload
const EXIF_PREFIX = 'Exif\0\0';

/** Splits a JPEG into marker segments. Entropy-coded data is attached to its SOS segment. Stops at EOI. */
function jpegSegments(b: Uint8Array): { segs: JpegSegment[]; eoi: number } {
  const segs: JpegSegment[] = [];
  let p = 2;
  while (p < b.length) {
    if (b[p] !== 0xff) throw new Error('Corrupt JPEG: expected a marker.');
    while (b[p + 1] === 0xff) p++; // fill bytes
    const marker = b[p + 1];
    if (marker === 0xd9) return { segs, eoi: p + 2 };
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { segs.push({ marker, start: p, end: p + 2 }); p += 2; continue; }
    if (p + 4 > b.length) throw new Error('Corrupt JPEG: truncated segment.');
    let end = p + 2 + ((b[p + 2] << 8) | b[p + 3]);
    if (end > b.length) throw new Error('Corrupt JPEG: truncated segment.');
    if (marker === 0xda) { // skip entropy-coded data up to the next real marker (not stuffed 00 or RSTn)
      while (end + 1 < b.length && !(b[end] === 0xff && b[end + 1] !== 0x00 && !(b[end + 1] >= 0xd0 && b[end + 1] <= 0xd7) && b[end + 1] !== 0xff)) end++;
      if (end + 1 >= b.length) end = b.length;
    }
    segs.push({ marker, start: p, end });
    p = end;
  }
  return { segs, eoi: b.length }; // no EOI: keep everything
}

function classifyJpeg(b: Uint8Array, s: JpegSegment): { keep: boolean; label?: string } {
  const payload = s.start + 4;
  if (s.marker === 0xe0) return startsWith(b, payload, 'JFIF\0') ? { keep: true } : { keep: false, label: 'Embedded thumbnail (JFXX)' };
  if (s.marker === 0xe2) return startsWith(b, payload, 'ICC_PROFILE\0') ? { keep: true } : { keep: false, label: 'Multi-picture data (MPF)' };
  if (s.marker === 0xee) return { keep: true }; // Adobe colour transform
  if (s.marker === 0xe1) return { keep: false, label: startsWith(b, payload, EXIF_PREFIX) ? 'EXIF' : 'XMP' };
  if (s.marker === 0xed) return { keep: false, label: 'IPTC / Photoshop data' };
  if (s.marker === 0xfe) return { keep: false, label: 'Comment' };
  if (s.marker > 0xe0 && s.marker <= 0xef) return { keep: false, label: 'Vendor data (APP' + (s.marker - 0xe0) + ')' };
  return { keep: true };
}

function jpegExif(b: Uint8Array, segs: JpegSegment[]): ExifSummary {
  const s = segs.find((x) => x.marker === 0xe1 && startsWith(b, x.start + 4, EXIF_PREFIX));
  return s ? parseTiff(b.subarray(s.start + 4 + EXIF_PREFIX.length, s.end)) : { entries: [] };
}

/** APP1 segment containing nothing but the Orientation tag. */
const ORIENTATION_SEGMENT_SIZE = 2 + 2 + 6 + 8 + 18;
function orientationSegment(o: number): Uint8Array {
  const seg = new Uint8Array(ORIENTATION_SEGMENT_SIZE);
  seg.set([0xff, 0xe1, 0x00, 0x22]);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  seg.set([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8], 10); // big-endian TIFF header, IFD at 8
  seg.set([0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0], 18); // 1 entry: Orientation SHORT
  return seg;
}

function analyzeJpeg(b: Uint8Array): Analysis {
  const { segs, eoi } = jpegSegments(b);
  const found = new Set<string>();
  for (const s of segs) { const c = classifyJpeg(b, s); if (!c.keep && c.label) found.add(c.label); }
  if (eoi < b.length) found.add('Trailing data after image');
  const exif = jpegExif(b, segs);
  // A segment no bigger than the one we write ourselves can hold nothing but the rotation flag.
  const exifSeg = segs.find((x) => x.marker === 0xe1 && startsWith(b, x.start + 4, EXIF_PREFIX));
  if (exifSeg && exifSeg.end - exifSeg.start <= ORIENTATION_SEGMENT_SIZE && exif.orientation !== undefined && !exif.entries.length && !exif.gps) {
    found.delete('EXIF');
    found.add('Rotation flag only (no personal data)');
  }
  return { kind: 'jpeg', found: [...found], exif };
}

function stripJpeg(b: Uint8Array, o: StripOptions): StripResult {
  const { segs, eoi } = jpegSegments(b);
  const exif = jpegExif(b, segs);
  const removed = new Set<string>();
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let pendingOrientation = o.keepOrientation && exif.orientation && exif.orientation >= 2 && exif.orientation <= 8 ? exif.orientation : 0;
  for (const s of segs) {
    if (s.marker === 0xd8) continue;
    const c = classifyJpeg(b, s);
    if (!c.keep) { if (c.label) removed.add(c.label); continue; }
    if (pendingOrientation && s.marker !== 0xe0) { parts.push(orientationSegment(pendingOrientation)); pendingOrientation = 0; }
    parts.push(b.subarray(s.start, s.end));
  }
  if (eoi < b.length) removed.add('Trailing data after image');
  parts.push(b.subarray(eoi - 2, eoi)); // EOI (FFD9); if absent, eoi === length and this repeats the last two bytes
  const hasEoi = eoi >= 2 && b[eoi - 2] === 0xff && b[eoi - 1] === 0xd9;
  if (!hasEoi) parts.pop();
  if (removed.has('EXIF') && pendingOrientation === 0 && o.keepOrientation && exif.orientation && exif.orientation > 1) removed.add('EXIF (orientation kept)');
  return { data: concat(parts), removed: [...removed] };
}

// ---------------------------------------------------------------- PNG

interface PngChunk { type: string; start: number; end: number; dataStart: number; dataEnd: number }

function pngChunks(b: Uint8Array): PngChunk[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: PngChunk[] = [];
  let p = 8;
  while (p + 12 <= b.length) {
    const len = v.getUint32(p);
    const end = p + 12 + len;
    if (end > b.length) throw new Error('Corrupt PNG: truncated chunk.');
    const type = ascii(b, p + 4, p + 8);
    out.push({ type, start: p, end, dataStart: p + 8, dataEnd: p + 8 + len });
    p = end;
    if (type === 'IEND') break;
  }
  return out;
}

const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt']);
function pngDrop(c: PngChunk): string | null {
  if (PNG_TEXT.has(c.type)) return 'Text metadata';
  if (c.type === 'eXIf') return 'EXIF';
  if (c.type === 'tIME') return 'Modification time';
  if (c.type === 'dSIG') return 'Digital signature';
  if (c.type.charCodeAt(1) >= 0x41 && c.type.charCodeAt(1) <= 0x5a && c.type.charCodeAt(0) >= 0x61) return 'Private data chunk'; // ancillary + private
  return null;
}

function analyzePng(b: Uint8Array): Analysis {
  const chunks = pngChunks(b);
  const found = new Set<string>();
  let exif: ExifSummary = { entries: [] };
  const texts: ExifEntry[] = [];
  for (const c of chunks) {
    const label = pngDrop(c);
    if (label) found.add(label);
    if (c.type === 'eXIf') exif = parseTiff(b.subarray(c.dataStart, c.dataEnd));
    if (c.type === 'tEXt') {
      const raw = ascii(b, c.dataStart, Math.min(c.dataEnd, c.dataStart + 200));
      const nul = raw.indexOf('\0');
      if (nul > 0) texts.push({ label: `Text “${raw.slice(0, nul)}”`, value: raw.slice(nul + 1, nul + 81) });
    }
  }
  exif.entries.push(...texts);
  const last = chunks[chunks.length - 1];
  if (last && last.end < b.length) found.add('Trailing data after image');
  return { kind: 'png', found: [...found], exif };
}

function stripPng(b: Uint8Array): StripResult {
  const chunks = pngChunks(b);
  const removed = new Set<string>();
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  for (const c of chunks) {
    const label = pngDrop(c);
    if (label) removed.add(label); else parts.push(b.subarray(c.start, c.end));
  }
  const last = chunks[chunks.length - 1];
  if (last && last.end < b.length) removed.add('Trailing data after image');
  return { data: concat(parts), removed: [...removed] };
}

// ---------------------------------------------------------------- WebP

interface WebpChunk { fourcc: string; start: number; end: number; dataStart: number; size: number }

function webpChunks(b: Uint8Array): WebpChunk[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: WebpChunk[] = [];
  let p = 12;
  while (p + 8 <= b.length) {
    const size = v.getUint32(p + 4, true);
    const end = p + 8 + size + (size & 1);
    if (p + 8 + size > b.length) throw new Error('Corrupt WebP: truncated chunk.');
    out.push({ fourcc: ascii(b, p, p + 4), start: p, end: Math.min(end, b.length), dataStart: p + 8, size });
    p = end;
  }
  return out;
}

function analyzeWebp(b: Uint8Array): Analysis {
  const chunks = webpChunks(b);
  const found: string[] = [];
  let exif: ExifSummary = { entries: [] };
  for (const c of chunks) {
    if (c.fourcc === 'EXIF') {
      found.push('EXIF');
      const off = startsWith(b, c.dataStart, EXIF_PREFIX) ? EXIF_PREFIX.length : 0;
      exif = parseTiff(b.subarray(c.dataStart + off, c.dataStart + c.size));
    } else if (c.fourcc === 'XMP ') found.push('XMP');
  }
  return { kind: 'webp', found, exif };
}

function stripWebp(b: Uint8Array): StripResult {
  const chunks = webpChunks(b);
  const removed: string[] = [];
  const parts: Uint8Array[] = [b.slice(0, 12)];
  for (const c of chunks) {
    if (c.fourcc === 'EXIF') { removed.push('EXIF'); continue; }
    if (c.fourcc === 'XMP ') { removed.push('XMP'); continue; }
    const chunk = b.slice(c.start, c.end);
    if (c.fourcc === 'VP8X') chunk[8] &= ~(0x08 | 0x04); // clear EXIF + XMP flags
    parts.push(chunk);
  }
  const data = concat(parts);
  new DataView(data.buffer).setUint32(4, data.length - 8, true);
  return { data, removed };
}

// ---------------------------------------------------------------- public API

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function analyze(b: Uint8Array): Analysis {
  const kind = detectKind(b);
  if (kind === 'jpeg') return analyzeJpeg(b);
  if (kind === 'png') return analyzePng(b);
  if (kind === 'webp') return analyzeWebp(b);
  throw new Error('Unsupported format. JPEG, PNG and WebP can be cleaned without re-encoding.');
}

export function stripMetadata(b: Uint8Array, o: StripOptions = { keepOrientation: true }): StripResult {
  const kind = detectKind(b);
  if (kind === 'jpeg') return stripJpeg(b, o);
  if (kind === 'png') return stripPng(b);
  if (kind === 'webp') return stripWebp(b);
  throw new Error('Unsupported format. JPEG, PNG and WebP can be cleaned without re-encoding.');
}
