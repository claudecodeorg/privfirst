// Minimal, bounds-checked EXIF/TIFF reader: only the fields that matter for privacy.
export interface ExifEntry { label: string; value: string }
export interface ExifSummary { entries: ExifEntry[]; orientation?: number; gps?: { lat: number; lon: number } }

const IFD0_TAGS: Record<number, string> = {
  0x010e: 'Description', 0x010f: 'Camera make', 0x0110: 'Camera model', 0x0131: 'Software', 0x0132: 'Date modified',
  0x013b: 'Artist', 0x8298: 'Copyright',
};
const EXIF_TAGS: Record<number, string> = {
  0x9003: 'Date taken', 0xa430: 'Camera owner', 0xa431: 'Camera serial number', 0xa433: 'Lens make', 0xa434: 'Lens model', 0xa435: 'Lens serial number',
};
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

class Reader {
  constructor(private v: DataView, private le: boolean) {}
  ok(off: number, n: number) { return off >= 0 && n >= 0 && off + n <= this.v.byteLength; }
  u16(o: number) { return this.v.getUint16(o, this.le); }
  u32(o: number) { return this.v.getUint32(o, this.le); }
}

interface RawEntry { tag: number; type: number; count: number; valueOff: number }

function readIfd(r: Reader, off: number): RawEntry[] {
  if (!r.ok(off, 2)) return [];
  const n = r.u16(off);
  const out: RawEntry[] = [];
  for (let i = 0; i < n && i < 512; i++) {
    const e = off + 2 + i * 12;
    if (!r.ok(e, 12)) break;
    const type = r.u16(e + 2), count = r.u32(e + 4), size = (TYPE_SIZE[type] ?? 0) * count;
    out.push({ tag: r.u16(e), type, count, valueOff: size <= 4 ? e + 8 : r.u32(e + 8) });
  }
  return out;
}

function ascii(r: Reader, e: RawEntry, bytes: Uint8Array): string {
  if (!r.ok(e.valueOff, e.count)) return '';
  return new TextDecoder().decode(bytes.subarray(e.valueOff, e.valueOff + e.count)).replace(/\0.*$/s, '').trim();
}

function rationals(r: Reader, e: RawEntry): number[] {
  if (e.type !== 5 || !r.ok(e.valueOff, e.count * 8)) return [];
  return Array.from({ length: e.count }, (_, i) => {
    const den = r.u32(e.valueOff + i * 8 + 4);
    return den ? r.u32(e.valueOff + i * 8) / den : 0;
  });
}

/** `tiff` starts at the TIFF header ("II*\0" or "MM\0*"), i.e. after the "Exif\0\0" prefix. */
export function parseTiff(tiff: Uint8Array): ExifSummary {
  const summary: ExifSummary = { entries: [] };
  try {
    if (tiff.length < 8) return summary;
    const v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
    const le = tiff[0] === 0x49 && tiff[1] === 0x49;
    if (!le && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return summary;
    const r = new Reader(v, le);
    if (r.u16(2) !== 42) return summary;

    const ifd0 = readIfd(r, r.u32(4));
    let exifPtr = 0, gpsPtr = 0;
    for (const e of ifd0) {
      if (e.tag === 0x0112 && e.type === 3 && r.ok(e.valueOff, 2)) summary.orientation = r.u16(e.valueOff);
      else if (e.tag === 0x8769) exifPtr = r.u32(e.valueOff);
      else if (e.tag === 0x8825) gpsPtr = r.u32(e.valueOff);
      else if (IFD0_TAGS[e.tag] && e.type === 2) { const s = ascii(r, e, tiff); if (s) summary.entries.push({ label: IFD0_TAGS[e.tag], value: s }); }
    }
    if (exifPtr) for (const e of readIfd(r, exifPtr)) {
      if (EXIF_TAGS[e.tag] && e.type === 2) { const s = ascii(r, e, tiff); if (s) summary.entries.push({ label: EXIF_TAGS[e.tag], value: s }); }
    }
    if (gpsPtr) {
      const g = readIfd(r, gpsPtr);
      const get = (t: number) => g.find((e) => e.tag === t);
      const latRef = get(1), lat = get(2), lonRef = get(3), lon = get(4);
      if (lat && lon && latRef && lonRef) {
        const toDeg = (p: number[]) => (p[0] ?? 0) + (p[1] ?? 0) / 60 + (p[2] ?? 0) / 3600;
        const la = toDeg(rationals(r, lat)) * (ascii(r, latRef, tiff).startsWith('S') ? -1 : 1);
        const lo = toDeg(rationals(r, lon)) * (ascii(r, lonRef, tiff).startsWith('W') ? -1 : 1);
        summary.gps = { lat: la, lon: lo };
        summary.entries.unshift({ label: 'GPS location', value: `${la.toFixed(5)}, ${lo.toFixed(5)}` });
      } else summary.entries.unshift({ label: 'GPS data', value: 'present' });
    }
  } catch { /* malformed EXIF: return whatever was parsed */ }
  return summary;
}
