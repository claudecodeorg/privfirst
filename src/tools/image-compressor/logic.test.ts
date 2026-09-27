import { describe, expect, it } from 'vitest';
import { cropToPixels, extensionFor, fitSize, rotatedDims, savings } from './logic';

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

describe('rotatedDims', () => {
  it('swaps width and height for 90/270, keeps them for 0/180', () => {
    expect(rotatedDims(800, 600, 90)).toEqual({ width: 600, height: 800 });
    expect(rotatedDims(800, 600, 270)).toEqual({ width: 600, height: 800 });
    expect(rotatedDims(800, 600, 0)).toEqual({ width: 800, height: 600 });
    expect(rotatedDims(800, 600, 180)).toEqual({ width: 800, height: 600 });
  });
});

describe('cropToPixels', () => {
  it('converts a fractional rect to pixels', () => expect(cropToPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 1000, 800)).toEqual({ x: 250, y: 400, width: 500, height: 200 }));
  it('clamps a crop that runs past the edge', () => {
    expect(cropToPixels({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, 1000, 1000)).toEqual({ x: 900, y: 900, width: 100, height: 100 });
  });
  it('clamps negative or over-1 fractions', () => {
    const r = cropToPixels({ x: -0.5, y: 2, width: 2, height: -1 }, 1000, 1000);
    expect(r.x).toBe(0);
    expect(r.y).toBe(999);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
  it('never returns a zero-size rectangle', () => {
    expect(cropToPixels({ x: 0, y: 0, width: 0, height: 0 }, 1000, 1000)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
