export type Unit = 's' | 'ms';

export function epochToDate(value: number, unit: Unit): Date {
  const ms = unit === 's' ? value * 1000 : value;
  if (!Number.isFinite(ms)) throw new Error('Not a valid number.');
  return new Date(ms);
}

export function dateToEpoch(date: Date, unit: Unit): number {
  if (Number.isNaN(date.getTime())) throw new Error('Not a valid date.');
  return unit === 's' ? Math.floor(date.getTime() / 1000) : date.getTime();
}

export function parseFlexible(text: string): Date {
  const s = text.trim();
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // Treat 13+ digit integers as milliseconds, shorter ones as seconds (a common convention).
    return epochToDate(n, Math.abs(n) >= 1e12 ? 'ms' : 's');
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Could not parse that as a date or epoch value.');
  return d;
}

export const COMMON_ZONES = [
  'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
];

export function formatInZone(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', // hour12:false alone can yield 24:00 instead of 00:00
  }).format(date).replace(',', '');
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
