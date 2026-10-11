import { describe, expect, it } from 'vitest';
import { blurRegions, clampBox, headRegion, heldPersonBoxes, padBox, pixelBlock, scaleBox } from './privacy.js';

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
  it('takes the top 35 % of a person box plus a margin (15 % each side, 8 % above)', () => {
    expect(headRegion({ x: 200, y: 40, w: 100, h: 250 }, frame)).toEqual({ x: 185, y: 20, w: 130, h: 107.5 });
  });
  it('is clamped when the person box runs off the frame', () => {
    const r = headRegion({ x: 600, y: -50, w: 100, h: 200 }, frame)!;
    expect([r.x, r.y, r.w]).toEqual([585, 0, 55]);
    expect(r.h).toBeCloseTo(20, 6); // −66 + 86, clamped at the top edge
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
      { x: 288, y: 4, w: 104, h: 86 },
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
    expect(blurRegions({ faces: [], persons: [{ x: 639.6, y: 0, w: 0.3, h: 3 }], frame })).toEqual([]); // < 1 px wide even after padding
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

describe('heldPersonBoxes (detector gaps must not unblur a face)', () => {
  const video = { width: 1280, height: 720 };
  const p = { x: 100, y: 50, w: 80, h: 200 };
  it('keeps a person seen 600 ms ago even if the newest frame has nobody', () => {
    const history = [
      { boxes: [p], frame: video, at: 400 },
      { boxes: [], frame: video, at: 1000 },
    ];
    expect(heldPersonBoxes(history, 1000, frame)).toEqual([{ x: 50, y: 25, w: 40, h: 100 }]);
  });
  it('keeps one region per person across many snapshots (newest position wins)', () => {
    const moved = { ...p, x: 104 };
    const history = Array.from({ length: 60 }, (_, i) => ({ boxes: [i === 59 ? moved : p], frame: video, at: 1000 + i * 16 }));
    expect(heldPersonBoxes(history, 1960, frame)).toEqual([{ x: 52, y: 25, w: 40, h: 100 }]);
  });
  it('drops boxes older than the hold window', () => {
    expect(heldPersonBoxes([{ boxes: [p], frame: video, at: 0 }], 1500, frame)).toEqual([]);
  });
  it('ignores snapshots with an unknown frame size', () => {
    expect(heldPersonBoxes([{ boxes: [p], frame: { width: 0, height: 0 }, at: 1000 }], 1000, frame)).toEqual([]);
  });
});
