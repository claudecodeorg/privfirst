import { describe, expect, it } from 'vitest';
import { categories, searchTools, tools } from './registry';

describe('tools registry', () => {
  it('has unique ids', () => expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length));
  it('every tool belongs to a listed category', () => tools.forEach((t) => expect(categories).toContain(t.category)));
});

describe('searchTools', () => {
  it('returns everything for an empty query', () => expect(searchTools('')).toHaveLength(tools.length));
  it('matches by name, description or keyword', () => {
    expect(searchTools('jwt').map((t) => t.id)).toContain('jwt-decoder');
    expect(searchTools('gps').map((t) => t.id)).toContain('metadata-stripper');
  });
  it('requires every search term to match', () => expect(searchTools('pdf zzzznotaword')).toHaveLength(0));
  it('filters by category alone', () => {
    const docs = searchTools('', 'Documents');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((t) => t.category === 'Documents')).toBe(true);
  });
  it('combines a category filter with a text query', () => {
    const r = searchTools('pdf', 'Privacy');
    expect(r.every((t) => t.category === 'Privacy')).toBe(true);
  });
});
