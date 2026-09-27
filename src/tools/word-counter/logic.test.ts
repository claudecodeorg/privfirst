import { describe, expect, it } from 'vitest';
import { countStats } from './logic';

describe('countStats', () => {
  it('handles empty input', () => {
    const s = countStats('');
    expect(s).toMatchObject({ characters: 0, words: 0, sentences: 0, paragraphs: 0 });
  });
  it('counts words collapsing multiple spaces/newlines', () => {
    expect(countStats('  hello   world  \n\nfoo ').words).toBe(3);
  });
  it('counts characters with and without spaces', () => {
    const s = countStats('a b  c');
    expect(s.characters).toBe(6);
    expect(s.charactersNoSpaces).toBe(3);
  });
  it('counts sentences by terminal punctuation', () => {
    expect(countStats('One. Two! Three? Four').sentences).toBe(4);
  });
  it('counts paragraphs separated by a blank line', () => {
    expect(countStats('para one\nstill one\n\npara two\n\n\npara three').paragraphs).toBe(3);
  });
  it('estimates reading and speaking time proportional to word count', () => {
    const s = countStats(Array(200).fill('word').join(' '));
    expect(s.readingMinutes).toBeCloseTo(1, 5);
    expect(s.speakingMinutes).toBeGreaterThan(s.readingMinutes);
  });
});
