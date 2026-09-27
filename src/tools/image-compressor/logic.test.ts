import { describe, expect, it } from 'vitest';
import { extensionFor, fitSize, savings } from './logic';

describe('fitSize', () => {
  it('keeps small images as-is', () => expect(fitSize(800, 600, 1024)).toEqual({ width: 800, height: 600 }));
  it('treats 0 as unlimited', () => expect(fitSize(8000, 6000, 0)).toEqual({ width: 8000, height: 6000 }));
  it('scales by the longest edge preserving aspect ratio', () => {
    expect(fitSize(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitSize(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });
  it('never returns a zero dimension', () => expect(fitSize(10000, 1, 100).height).toBe(1));
  it('rejects invalid sizes', () => expect(() => fitSize(0, 5, 10)).toThrow());
});

describe('helpers', () => {
  it('maps extensions', () => { expect(extensionFor('image/jpeg')).toBe('jpg'); expect(extensionFor('image/webp')).toBe('webp'); });
  it('describes savings', () => {
    expect(savings(1000, 250)).toBe('75% smaller');
    expect(savings(100, 150)).toBe('50% larger');
  });
});
