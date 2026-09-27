import { describe, expect, it } from 'vitest';
import { dateToEpoch, epochToDate, formatInZone, parseFlexible } from './logic';

describe('epochToDate / dateToEpoch', () => {
  it('converts seconds and milliseconds', () => {
    expect(epochToDate(0, 's').toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(epochToDate(1735689600, 's').toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(epochToDate(1735689600000, 'ms').toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
  it('round-trips', () => {
    const d = new Date('2024-06-15T12:34:56Z');
    expect(epochToDate(dateToEpoch(d, 's'), 's').getTime()).toBe(Math.floor(d.getTime() / 1000) * 1000);
    expect(epochToDate(dateToEpoch(d, 'ms'), 'ms').getTime()).toBe(d.getTime());
  });
  it('rejects invalid input', () => {
    expect(() => epochToDate(NaN, 's')).toThrow();
    expect(() => dateToEpoch(new Date('nope'), 's')).toThrow();
  });
});

describe('parseFlexible', () => {
  it('treats long integers as milliseconds, short ones as seconds', () => {
    expect(parseFlexible('1735689600').toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(parseFlexible('1735689600000').toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
  it('parses an ISO string', () => expect(parseFlexible('2025-01-01T00:00:00Z').toISOString()).toBe('2025-01-01T00:00:00.000Z'));
  it('throws on garbage', () => expect(() => parseFlexible('not a date')).toThrow());
});

describe('formatInZone', () => {
  it('matches known historical UTC offsets (no DST ambiguity)', () => {
    const winter = new Date('2024-01-15T12:00:00Z'); // EST, UTC-5
    expect(formatInZone(winter, 'America/New_York')).toBe('2024-01-15 07:00:00');
    const summer = new Date('2024-07-15T12:00:00Z'); // EDT, UTC-4
    expect(formatInZone(summer, 'America/New_York')).toBe('2024-07-15 08:00:00');
  });
  it('formats UTC as-is', () => expect(formatInZone(new Date('2024-01-01T00:00:00Z'), 'UTC')).toBe('2024-01-01 00:00:00'));
});
