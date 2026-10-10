import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  candidateFor,
  estimateDistanceM,
  focalPx,
  hazardTypeFor,
  iou,
  isEdgeCut,
  isInPath,
  loomingTtcSeconds,
  Tracker,
  type Box,
  type FrameInfo,
  type HeightSample,
} from './motion.js';

const W = 640, H = 360;
const frame = (ts: number): FrameInfo => ({ width: W, height: H, ts });
const F = focalPx(W); // ≈ 502 px at 65° HFOV

/** Box of a 1.7 m person at distance d metres, centred horizontally, feet at ~80 % of frame height. */
function personBox(d: number, cx = W / 2): Box {
  const h = (F * 1.7) / d;
  const w = h * 0.4;
  return { x: cx - w / 2, y: H * 0.8 - h, w, h };
}

describe('geometry', () => {
  it('iou of identical, disjoint and half-overlapping boxes', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 20, y: 0, w: 10, h: 10 })).toBe(0);
    expect(iou(a, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(1 / 3, 5);
  });

  it('estimates a person at 5 m from box height', () => {
    expect(estimateDistanceM('person', personBox(5).h, W)).toBeCloseTo(5, 5);
    expect(estimateDistanceM('unknown', 100, W)).toBeUndefined();
  });

  it('bearing: centre is 0°, right edge is +HFOV/2, left is negative', () => {
    expect(bearingDeg({ x: W / 2 - 5, y: 0, w: 10, h: 10 }, frame(0))).toBeCloseTo(0, 5);
    expect(bearingDeg({ x: W - 1, y: 0, w: 2, h: 10 }, frame(0))).toBeCloseTo(32.5, 0);
    expect(bearingDeg({ x: 0, y: 0, w: 10, h: 10 }, frame(0))).toBeLessThan(-25);
  });

  it('in path = overlaps the central 40 % corridor', () => {
    expect(isInPath({ x: 300, y: 0, w: 40, h: 40 }, frame(0))).toBe(true);
    expect(isInPath({ x: 10, y: 0, w: 40, h: 40 }, frame(0))).toBe(false);
  });

  it('edge-cut boxes are flagged', () => {
    expect(isEdgeCut({ x: 100, y: 100, w: 50, h: 260 }, frame(0))).toBe(true); // touches bottom
    expect(isEdgeCut({ x: 100, y: 100, w: 50, h: 50 }, frame(0))).toBe(false);
  });

  it('maps COCO labels and ignores irrelevant ones', () => {
    expect(hazardTypeFor('person')).toBe('person');
    expect(hazardTypeFor('bicycle')).toBe('cyclist');
    expect(hazardTypeFor('car')).toBe('vehicle');
    expect(hazardTypeFor('toothbrush')).toBeNull();
  });
});

describe('loomingTtcSeconds (ADR-024)', () => {
  it('recovers time-to-contact of an approaching person within 15 %', () => {
    const v = 2.8; // both walking towards each other
    const samples: HeightSample[] = [];
    for (let i = 0; i < 8; i++) {
      const t = i * 0.1;
      samples.push({ h: personBox(10 - v * t).h, ts: t * 1000 });
    }
    const trueTtc = (10 - v * 0.7) / v; // ≈ 2.87 s
    expect(loomingTtcSeconds(samples)).toBeGreaterThan(trueTtc * 0.85);
    expect(loomingTtcSeconds(samples)).toBeLessThan(trueTtc * 1.15);
  });

  it('is Infinity with too few samples, a static object, or a receding one', () => {
    expect(loomingTtcSeconds([{ h: 50, ts: 0 }, { h: 60, ts: 100 }])).toBe(Infinity);
    const flat = Array.from({ length: 6 }, (_, i) => ({ h: 80, ts: i * 100 }));
    expect(loomingTtcSeconds(flat)).toBe(Infinity);
    const away = Array.from({ length: 6 }, (_, i) => ({ h: 80 - i * 3, ts: i * 100 }));
    expect(loomingTtcSeconds(away)).toBe(Infinity);
  });

  it('tolerates detector jitter (±3 px) without flipping to "not approaching"', () => {
    const jitter = [3, -3, 2, -2, 3, -3, 1, -1];
    const samples = jitter.map((j, i) => ({ h: personBox(8 - 2.8 * i * 0.1).h + j, ts: i * 100 }));
    const ttc = loomingTtcSeconds(samples);
    expect(Number.isFinite(ttc)).toBe(true);
    expect(ttc).toBeLessThan(4);
  });
});

describe('Tracker', () => {
  it('keeps a stable ID while an object moves and gives a new object a new ID', () => {
    const tr = new Tracker();
    let tracks = tr.update([{ box: personBox(10), label: 'person', score: 0.8 }], frame(0));
    const id = tracks[0]!.id;
    tracks = tr.update([{ box: personBox(9.7), label: 'person', score: 0.8 }], frame(100));
    expect(tracks[0]!.id).toBe(id);
    tracks = tr.update(
      [
        { box: personBox(9.4), label: 'person', score: 0.8 },
        { box: personBox(6, 60), label: 'person', score: 0.7 },
      ],
      frame(200),
    );
    expect(tracks.map((t) => t.id)).toContain(id);
    expect(new Set(tracks.map((t) => t.id)).size).toBe(2);
  });

  it('drops a track after it has been missing for more than maxMisses frames', () => {
    const tr = new Tracker({ maxMisses: 2 });
    tr.update([{ box: personBox(10), label: 'person', score: 0.8 }], frame(0));
    tr.update([], frame(100));
    tr.update([], frame(200));
    expect(tr.update([], frame(300))).toHaveLength(0);
    const fresh = tr.update([{ box: personBox(10), label: 'person', score: 0.8 }], frame(400));
    expect(fresh[0]!.id).not.toBe('t1');
  });

  it('ignores irrelevant classes but keeps a large unknown object in the path', () => {
    const tr = new Tracker();
    expect(tr.update([{ box: { x: 300, y: 10, w: 20, h: 20 }, label: 'toothbrush', score: 0.9 }], frame(0))).toHaveLength(0);
    const big = tr.update([{ box: { x: 250, y: 50, w: 140, h: 200 }, label: 'refrigerator', score: 0.6 }], frame(100));
    expect(big[0]!.type).toBe('unknown');
  });
});

describe('candidateFor', () => {
  function feed(distances: number[], cx = W / 2) {
    const tr = new Tracker();
    let tracks = [] as ReturnType<Tracker['update']>;
    distances.forEach((d, i) => {
      tracks = tr.update([{ box: personBox(d, cx), label: 'person', score: 0.8 }], frame(i * 100));
    });
    return { track: tracks[0]!, last: frame((distances.length - 1) * 100) };
  }

  it('stays silent for a track seen in fewer than 3 frames', () => {
    const { track, last } = feed([10, 9.8]);
    expect(candidateFor(track, last)).toBeNull();
  });

  it('a person approaching in the path becomes P1 at ~3 s', () => {
    const { track, last } = feed([10, 9.72, 9.44, 9.16, 8.88, 8.6, 8.32, 8.04]);
    const c = candidateFor(track, last)!;
    expect(c.tier).toBe('P1');
    expect(c.inPath).toBe(true);
    expect(c.ttcSeconds).toBeGreaterThan(2);
    expect(c.ttcSeconds).toBeLessThan(4);
  });

  it('a far person (no motion yet) stays low-tier instead of alerting at first sight (SAF-02)', () => {
    const { track, last } = feed([25, 25, 25]);
    const c = candidateFor(track, last)!;
    expect(['P2', 'P3']).toContain(c.tier);
  });

  it('the same approach off to the side is downgraded one tier', () => {
    const { track, last } = feed([10, 9.72, 9.44, 9.16, 8.88, 8.6, 8.32, 8.04], 40);
    expect(candidateFor(track, last)!.tier).toBe('P2');
  });

  it('an edge-cut object filling the path is imminent (P0)', () => {
    const tr = new Tracker();
    const big = { x: 220, y: 40, w: 200, h: H - 40 }; // touches the bottom edge, 89 % of frame height
    let tracks = [] as ReturnType<Tracker['update']>;
    for (let i = 0; i < 3; i++) tracks = tr.update([{ box: big, label: 'person', score: 0.9 }], frame(i * 100));
    expect(candidateFor(tracks[0]!, frame(200))!.tier).toBe('P0');
  });
});
