import { describe, expect, it } from 'vitest';
import {
  batteryMessage,
  cameraProblem,
  evaluateLadder,
  frameStats,
  LadderTracker,
  orientationProblem,
  type HealthInputs,
} from './health.js';

const W = 64, H = 36;
const flat = (v: number) => new Uint8Array(W * H).fill(v);
/** A street-like image: gradient sky, textured ground. */
function street(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = y < 14 ? 180 - y * 3 : ((x * 37 + y * 53) % 90) + 60;
  return g;
}
/** The same street, box-blurred heavily (smudged lens). */
function blurred(): Uint8Array {
  const s = street();
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0, n = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const yy = Math.min(H - 1, Math.max(0, y + dy)), xx = Math.min(W - 1, Math.max(0, x + dx));
      sum += s[yy * W + xx]!; n++;
    }
    g[y * W + x] = Math.round(sum / n);
  }
  return g;
}

describe('camera quality gate', () => {
  it('a normal street frame is fine', () => {
    expect(cameraProblem(frameStats(street(), W, H))).toBeNull();
  });
  it('ST-01: a hand over the lens (black, uniform) is "covered"', () => {
    expect(cameraProblem(frameStats(flat(8), W, H))).toBe('covered');
  });
  it('ST-05: a dim night frame is "dark"', () => {
    const night = street().map((v) => Math.round(v * 0.25));
    expect(cameraProblem(frameStats(night, W, H))).toBe('dark');
  });
  it('a smudged / blurred frame is "blurred"; a white wall too (no edges)', () => {
    expect(cameraProblem(frameStats(blurred(), W, H))).toBe('blurred');
    expect(cameraProblem(frameStats(flat(200), W, H))).toBe('blurred');
  });
});

describe('orientation (ST-06)', () => {
  it('upright is fine; flat looks at the ground; tilted far back looks at the sky; unknown is no opinion', () => {
    expect(orientationProblem(85)).toBeNull();
    expect(orientationProblem(10)).toBe('ground');
    expect(orientationProblem(-5)).toBe('ground');
    expect(orientationProblem(165)).toBe('sky');
    expect(orientationProblem(null)).toBeNull();
  });
});

const ok: HealthInputs = { detectorAlive: true, cameraLive: true, camera: null, orientation: null, sceneOk: true };

describe('degradation ladder', () => {
  it('maps failures to levels, most severe first', () => {
    expect(evaluateLadder(ok).level).toBe('L0');
    expect(evaluateLadder({ ...ok, sceneOk: false })).toEqual({ level: 'L1', reasons: ['scene'] });
    expect(evaluateLadder({ ...ok, camera: 'covered', sceneOk: false })).toEqual({ level: 'L2', reasons: ['covered'] });
    expect(evaluateLadder({ ...ok, cameraLive: false }).reasons).toEqual(['frozen']);
    expect(evaluateLadder({ ...ok, detectorAlive: false, camera: 'dark' }).level).toBe('L3');
    expect(evaluateLadder({ ...ok, sceneOk: null }).level).toBe('L0');
  });

  it('ST-01: covered camera is announced within 2 s, recovery after 3 s, no flapping in between', () => {
    const t = new LadderTracker();
    const covered = evaluateLadder({ ...ok, camera: 'covered' });
    expect(t.update(covered, 0)).toBeNull();
    expect(t.update(covered, 1000)).toBeNull();
    expect(t.update(covered, 1600)).toBe("Camera can't see. No obstacle alerts. Use your cane.");
    expect(t.state.level).toBe('L2');
    expect(t.update(evaluateLadder(ok), 2000)).toBeNull();
    expect(t.update(covered, 2500)).toBeNull(); // hand back over the lens: still L2, nothing new
    expect(t.update(evaluateLadder(ok), 3000)).toBeNull();
    expect(t.update(evaluateLadder(ok), 6100)).toBe('Camera is back. Obstacle alerts on.');
  });

  it('a brief glitch shorter than the hold time is never announced', () => {
    const t = new LadderTracker();
    expect(t.update(evaluateLadder({ ...ok, camera: 'blurred' }), 0)).toBeNull();
    expect(t.update(evaluateLadder(ok), 800)).toBeNull();
    expect(t.update(evaluateLadder(ok), 5000)).toBeNull();
    expect(t.state.level).toBe('L0');
  });

  it('ST-02/03: scene scan lost → L1 message; back → "Scene descriptions are back."', () => {
    const t = new LadderTracker();
    const l1 = evaluateLadder({ ...ok, sceneOk: false });
    t.update(l1, 0);
    expect(t.update(l1, 1600)).toBe('Scene descriptions unavailable. Obstacle alerts still on.');
    t.update(evaluateLadder(ok), 2000);
    expect(t.update(evaluateLadder(ok), 5100)).toBe('Scene descriptions are back.');
  });

  it('ST-06 / ST-05: wrong angle and darkness give specific instructions', () => {
    const t = new LadderTracker();
    const ground = evaluateLadder({ ...ok, orientation: 'ground' });
    t.update(ground, 0);
    expect(t.update(ground, 1600)).toMatch(/Hold the phone upright/);
    const t2 = new LadderTracker();
    const dark = evaluateLadder({ ...ok, camera: 'dark' });
    t2.update(dark, 0);
    expect(t2.update(dark, 1600)).toBe("It's too dark for the camera. No obstacle alerts. Use your cane.");
  });

  it('L3 (detector stalled) is announced immediately', () => {
    const t = new LadderTracker();
    expect(t.update(evaluateLadder({ ...ok, detectorAlive: false }), 0)).toBe('Footprint stopped. Alerts are off.');
  });

  it('battery wording', () => {
    expect(batteryMessage(0.2)).toBe('Battery low, 20 percent.');
    expect(batteryMessage(0.05)).toMatch(/shuts down/);
  });
});

describe('test round 1 fixes', () => {
  it('a covered camera is reminded every 20 s while it stays covered; never while fine', () => {
    const t = new LadderTracker();
    const covered = { level: 'L2' as const, reasons: ['covered'] };
    expect(t.update(covered, 0)).toBeNull();
    expect(t.update(covered, 1500)).toBe("Camera can't see. No obstacle alerts. Use your cane.");
    expect(t.update(covered, 10_000)).toBeNull();
    expect(t.update(covered, 21_500)).toBe("Camera can't see. No obstacle alerts. Use your cane.");
    expect(t.update(covered, 30_000)).toBeNull();
    const fine = new LadderTracker();
    for (let ms = 0; ms <= 60_000; ms += 500) expect(fine.update({ level: 'L0', reasons: [] }, ms)).toBeNull();
  });
  it('a tilt of 50° off level is caught; the instruction to hold upright wins over "blurred"', () => {
    expect(orientationProblem(35)).toBe('ground');
    expect(orientationProblem(145)).toBe('sky');
    expect(orientationProblem(70)).toBeNull();
    const s = evaluateLadder({ detectorAlive: true, cameraLive: true, camera: 'blurred', orientation: 'ground', sceneOk: true });
    expect(s.reasons[0]).toBe('ground');
  });
});
