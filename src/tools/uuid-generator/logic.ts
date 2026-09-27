export type Version = 'v4' | 'v7';

const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const dashed = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

export function uuidV4(): string {
  return crypto.randomUUID();
}

/** RFC 9562 UUIDv7: a 48-bit millisecond timestamp followed by random bits, so IDs sort chronologically. */
export function uuidV7(now: number = Date.now(), randomBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(10))): string {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Math.floor(now / 2 ** 16));
  view.setUint16(4, now % 2 ** 16);
  bytes.set(randomBytes.subarray(0, 10), 6);
  bytes[6] = 0x70 | (bytes[6] & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10
  return dashed(toHex(bytes));
}

export function generate(version: Version, count: number): string[] {
  if (count < 1 || count > 1000) throw new RangeError('Count must be between 1 and 1000.');
  return Array.from({ length: count }, () => (version === 'v4' ? uuidV4() : uuidV7()));
}

export function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
