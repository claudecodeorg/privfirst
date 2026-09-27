import { describe, expect, it } from 'vitest';
import { findMatches } from './logic';

describe('findMatches', () => {
  it('finds all matches of a simple pattern', () => {
    const m = findMatches('\\d+', '', 'a1 b22 c333');
    expect(m.map((x) => x.match)).toEqual(['1', '22', '333']);
    expect(m[1].index).toBe(4);
  });
  it('captures numbered groups', () => {
    const [m] = findMatches('(\\w+)@(\\w+)', '', 'user@host');
    expect(m.groups).toEqual(['user', 'host']);
  });
  it('captures named groups', () => {
    const [m] = findMatches('(?<user>\\w+)@(?<host>\\w+)', '', 'user@host');
    expect(m.named).toEqual({ user: 'user', host: 'host' });
  });
  it('honours the case-insensitive flag', () => {
    expect(findMatches('HELLO', 'i', 'say hello')).toHaveLength(1);
    expect(findMatches('HELLO', '', 'say hello')).toHaveLength(0);
  });
  it('adds a global flag automatically so every occurrence is found', () => {
    expect(findMatches('a', '', 'aaa')).toHaveLength(3);
  });
  it('does not duplicate an already-present g flag', () => expect(() => findMatches('a', 'gi', 'A')).not.toThrow());
  it('terminates on zero-width matches instead of looping forever', () => {
    const m = findMatches('(?:)', '', 'abc', 10);
    expect(m.length).toBeGreaterThan(0);
    expect(m.length).toBeLessThanOrEqual(10);
  });
  it('respects the maxMatches cap', () => expect(findMatches('.', '', 'x'.repeat(100), 5)).toHaveLength(5));
  it('throws a readable error for invalid patterns', () => expect(() => findMatches('(unclosed', '', 'x')).toThrow());
});
