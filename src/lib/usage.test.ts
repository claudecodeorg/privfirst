import { beforeEach, describe, expect, it } from 'vitest';
import { getFavourites, getRecent, isFavourite, pushRecent, toggleFavourite } from './usage';

beforeEach(() => {
  for (const id of getFavourites()) toggleFavourite(id); // toggling an existing id off clears it
  for (let i = 0; i < 8; i++) pushRecent(`__seed_${i}__`); // fills the cap with filler, pushing old ids out
});

describe('favourites', () => {
  it('toggles on and off', () => {
    expect(isFavourite('pdf-toolkit')).toBe(false);
    toggleFavourite('pdf-toolkit');
    expect(isFavourite('pdf-toolkit')).toBe(true);
    toggleFavourite('pdf-toolkit');
    expect(isFavourite('pdf-toolkit')).toBe(false);
  });
  it('keeps other favourites when toggling one', () => {
    toggleFavourite('a'); toggleFavourite('b');
    expect(getFavourites().sort()).toEqual(['a', 'b']);
    toggleFavourite('a');
    expect(getFavourites()).toEqual(['b']);
  });
});

describe('recent', () => {
  it('puts the newest first and de-duplicates', () => {
    pushRecent('a'); pushRecent('b'); pushRecent('a');
    expect(getRecent().slice(0, 2)).toEqual(['a', 'b']);
  });
  it('caps at 8 entries', () => {
    for (let i = 0; i < 12; i++) pushRecent(`t${i}`);
    expect(getRecent()).toHaveLength(8);
    expect(getRecent()[0]).toBe('t11');
  });
});
