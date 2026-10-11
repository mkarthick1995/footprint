import { describe, expect, it } from 'vitest';
import { blurRegions, clampBox, headRegion, padBox, pixelBlock, scaleBox } from './privacy.js';

const frame = { width: 640, height: 360 };

describe('clampBox', () => {
  it('keeps a box that is inside the frame', () => {
    expect(clampBox({ x: 10, y: 20, w: 30, h: 40 }, frame)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
  it('cuts a box that hangs over the edges', () => {
    expect(clampBox({ x: -10, y: -5, w: 50, h: 30 }, frame)).toEqual({ x: 0, y: 0, w: 40, h: 25 });
    expect(clampBox({ x: 620, y: 350, w: 50, h: 50 }, frame)).toEqual({ x: 620, y: 350, w: 20, h: 10 });
  });
  it('returns null when nothing is left or the box is degenerate', () => {
    expect(clampBox({ x: 700, y: 10, w: 20, h: 20 }, frame)).toBeNull();
    expect(clampBox({ x: 10, y: 10, w: 0, h: 20 }, frame)).toBeNull();
    expect(clampBox({ x: Number.NaN, y: 0, w: 10, h: 10 }, frame)).toBeNull();
  });
});

describe('padBox', () => {
  it('grows each side by 30 % of the box by default', () => {
    expect(padBox({ x: 100, y: 100, w: 50, h: 60 }, frame)).toEqual({ x: 85, y: 82, w: 80, h: 96 });
  });
  it('never leaves the frame', () => {
    expect(padBox({ x: 0, y: 0, w: 40, h: 40 }, frame)).toEqual({ x: 0, y: 0, w: 52, h: 52 });
  });
});

describe('headRegion', () => {
  it('takes the top share of a person box, full width', () => {
    expect(headRegion({ x: 200, y: 40, w: 100, h: 250 }, frame)).toEqual({ x: 200, y: 40, w: 100, h: 70 });
  });
  it('is clamped when the person box runs off the frame', () => {
    const r = headRegion({ x: 600, y: -50, w: 100, h: 200 }, frame)!;
    expect([r.x, r.y, r.w]).toEqual([600, 0, 40]);
    expect(r.h).toBeCloseTo(6, 6); // 200 × 0.28 − 50: floating-point, not exactly 6
  });
});

describe('blurRegions', () => {
  it('combines padded faces and head areas', () => {
    const r = blurRegions({
      faces: [{ x: 100, y: 100, w: 50, h: 60 }],
      persons: [{ x: 300, y: 20, w: 80, h: 200 }],
      frame,
    });
    expect(r).toEqual([
      { x: 85, y: 82, w: 80, h: 96 },
      { x: 300, y: 20, w: 80, h: 56 },
    ]);
  });
  it('rounds outwards so a region never shrinks', () => {
    const [r] = blurRegions({ faces: [{ x: 10.5, y: 10.5, w: 10, h: 10 }], frame });
    expect(r).toEqual({ x: 7, y: 7, w: 17, h: 17 });
  });
  it('drops regions with no area inside the frame', () => {
    expect(blurRegions({ faces: [{ x: 900, y: 900, w: 20, h: 20 }], frame })).toEqual([]);
  });
  it('drops slivers too small to hold a face', () => {
    expect(blurRegions({ faces: [], persons: [{ x: 0, y: 0, w: 1, h: 3 }], frame })).toEqual([]);
  });
  it('returns nothing when nothing was detected (no spurious blur)', () => {
    expect(blurRegions({ faces: [], frame })).toEqual([]);
  });
});

describe('pixelBlock', () => {
  it('reduces the longer side to about six blocks', () => {
    expect(pixelBlock({ x: 0, y: 0, w: 120, h: 60 })).toBe(20);
  });
  it('never goes below a 4 px block', () => {
    expect(pixelBlock({ x: 0, y: 0, w: 10, h: 10 })).toBe(4);
  });
});

describe('scaleBox', () => {
  it('maps video pixels to the upload canvas', () => {
    expect(scaleBox({ x: 1000, y: 500, w: 200, h: 400 }, 0.5, 0.5)).toEqual({ x: 500, y: 250, w: 100, h: 200 });
  });
});
