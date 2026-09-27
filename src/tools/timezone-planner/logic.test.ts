import { describe, expect, it } from 'vitest';
import { formatOffset, isReasonableHour, localHour, offsetMinutes } from './logic';

describe('offsetMinutes', () => {
  it('matches known historical offsets (no DST ambiguity)', () => {
    expect(offsetMinutes(new Date('2024-01-15T12:00:00Z'), 'America/New_York')).toBe(-300); // EST
    expect(offsetMinutes(new Date('2024-07-15T12:00:00Z'), 'America/New_York')).toBe(-240); // EDT
    expect(offsetMinutes(new Date('2024-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(330); // fixed +5:30
    expect(offsetMinutes(new Date('2024-01-15T12:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('formatOffset', () => {
  it('formats positive, negative, and half-hour offsets', () => {
    expect(formatOffset(0)).toBe('UTC+0');
    expect(formatOffset(-300)).toBe('UTC-5');
    expect(formatOffset(330)).toBe('UTC+5:30');
  });
});

describe('localHour / isReasonableHour', () => {
  it('reads the wall-clock hour in a given zone', () => {
    expect(localHour(new Date('2024-06-01T12:00:00Z'), 'UTC')).toBe(12);
    expect(localHour(new Date('2024-06-01T12:00:00Z'), 'Asia/Kolkata')).toBe(17); // +5:30
  });
  it('flags 8am-8pm as reasonable, outside that as not', () => {
    expect(isReasonableHour(9)).toBe(true);
    expect(isReasonableHour(19)).toBe(true);
    expect(isReasonableHour(7)).toBe(false);
    expect(isReasonableHour(20)).toBe(false);
    expect(isReasonableHour(2)).toBe(false);
  });
});
