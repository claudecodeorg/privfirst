import { describe, expect, it } from 'vitest';
import { computeDiff } from './logic';

const lines = { mode: 'lines' as const, ignoreCase: false, ignoreWhitespace: false };

describe('computeDiff', () => {
  it('detects identical text', () => expect(computeDiff('a\nb\n', 'a\nb\n', lines).identical).toBe(true));
  it('counts added/removed lines', () => {
    const r = computeDiff('one\ntwo\nthree\n', 'one\n2\nthree\nfour\n', lines);
    expect(r.removed).toBe(1);
    expect(r.added).toBe(2);
    expect(r.unchanged).toBe(2);
  });
  it('reconstructs both sides from the parts', () => {
    const a = 'alpha\nbeta\ngamma\n', b = 'alpha\nBETA\ngamma\ndelta\n';
    const r = computeDiff(a, b, lines);
    expect(r.parts.filter((p) => !p.added).map((p) => p.value).join('')).toBe(a);
    expect(r.parts.filter((p) => !p.removed).map((p) => p.value).join('')).toBe(b);
  });
  it('honours ignoreCase and ignoreWhitespace for lines', () => {
    expect(computeDiff('Hello\n', 'hello\n', { ...lines, ignoreCase: true }).identical).toBe(true);
    expect(computeDiff('a  b\n', 'a b\n', { ...lines, ignoreWhitespace: true }).identical).toBe(true);
    expect(computeDiff('a  b\n', 'a b\n', lines).identical).toBe(false);
  });
  it('diffs words and characters', () => {
    const w = computeDiff('the quick brown fox', 'the slow brown fox', { ...lines, mode: 'words' });
    expect([w.added, w.removed]).toEqual([1, 1]);
    const c = computeDiff('kitten', 'sitting', { ...lines, mode: 'chars' });
    expect(c.removed + c.added).toBeGreaterThan(0);
    expect(c.parts.filter((p) => !p.added).map((p) => p.value).join('')).toBe('kitten');
  });
});
