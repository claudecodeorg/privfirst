export interface City { zone: string; label: string }

// A representative, alphabetized-by-region spread of IANA zones; enough to cover most meetings
// without shipping the full ~400-zone tz database as UI clutter.
export const CITIES: City[] = [
  { zone: 'Pacific/Honolulu', label: 'Honolulu' }, { zone: 'America/Anchorage', label: 'Anchorage' },
  { zone: 'America/Los_Angeles', label: 'Los Angeles' }, { zone: 'America/Denver', label: 'Denver' },
  { zone: 'America/Chicago', label: 'Chicago' }, { zone: 'America/New_York', label: 'New York' },
  { zone: 'America/Sao_Paulo', label: 'São Paulo' }, { zone: 'UTC', label: 'UTC' },
  { zone: 'Europe/London', label: 'London' }, { zone: 'Europe/Paris', label: 'Paris' },
  { zone: 'Europe/Berlin', label: 'Berlin' }, { zone: 'Europe/Moscow', label: 'Moscow' },
  { zone: 'Africa/Cairo', label: 'Cairo' }, { zone: 'Africa/Johannesburg', label: 'Johannesburg' },
  { zone: 'Asia/Dubai', label: 'Dubai' }, { zone: 'Asia/Kolkata', label: 'Mumbai / Delhi' },
  { zone: 'Asia/Dhaka', label: 'Dhaka' }, { zone: 'Asia/Bangkok', label: 'Bangkok' },
  { zone: 'Asia/Singapore', label: 'Singapore' }, { zone: 'Asia/Shanghai', label: 'Shanghai' },
  { zone: 'Asia/Tokyo', label: 'Tokyo' }, { zone: 'Asia/Seoul', label: 'Seoul' },
  { zone: 'Australia/Perth', label: 'Perth' }, { zone: 'Australia/Sydney', label: 'Sydney' },
  { zone: 'Pacific/Auckland', label: 'Auckland' },
];

export function localZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone; }

export function offsetMinutes(date: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(name);
  if (!m) return 0;
  const sign = m[1].startsWith('-') ? -1 : 1;
  return sign * (Math.abs(Number(m[1])) * 60 + Number(m[2] ?? 0));
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60), m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** Local wall-clock hour in `zone` for the given instant, used to flag night/day for meeting planning. */
export function localHour(date: Date, zone: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(date));
}

export function isReasonableHour(hour: number): boolean { return hour >= 8 && hour < 20; }
