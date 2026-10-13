// Fail-loud layer (R1.6, SAFETY.md §1–2): camera quality, orientation and the degradation ladder L0–L3. Pure and
// clock-injected — the browser layer (apps/web/src/health.ts) only measures and speaks. A state must hold for a moment
// before it is announced (no flapping), and every level change is said once.
import type { LadderLevel } from './types.js';

// ---------- Camera quality (from a small grayscale fingerprint) ----------

export interface FrameStats {
  /** Mean brightness 0..255. */
  mean: number;
  /** Standard deviation of brightness (texture / contrast). */
  std: number;
  /** Mean absolute neighbour difference (edge energy; low = blurred or featureless). */
  sharpness: number;
}

/** Brightness statistics of a grayscale image (row-major, width × height). */
export function frameStats(gray: ArrayLike<number>, width: number, height: number): FrameStats {
  const n = width * height;
  if (n === 0 || gray.length < n) return { mean: 0, std: 0, sharpness: 0 };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += gray[i]!;
  const mean = sum / n;
  let varSum = 0;
  let edge = 0;
  let edges = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x]!;
      varSum += (v - mean) ** 2;
      if (x + 1 < width) ((edge += Math.abs(v - gray[y * width + x + 1]!)), edges++);
      if (y + 1 < height) ((edge += Math.abs(v - gray[(y + 1) * width + x]!)), edges++);
    }
  }
  return { mean, std: Math.sqrt(varSum / n), sharpness: edges ? edge / edges : 0 };
}

export type CameraProblem = 'covered' | 'dark' | 'blurred' | null;

/**
 * Thresholds for a 64×36 fingerprint (tune on clips/phones). Covered: almost black and uniform. Dark: too dim for the
 * detector. Blurred / featureless: hardly any edges (lens smudged, pressed against something, heavy motion blur).
 */
export const QUALITY = { coveredMean: 22, coveredStd: 10, darkMean: 38, blurSharpness: 2.2 } as const;

export function cameraProblem(s: FrameStats): CameraProblem {
  if (s.mean < QUALITY.coveredMean && s.std < QUALITY.coveredStd) return 'covered';
  if (s.mean < QUALITY.darkMean) return 'dark';
  if (s.sharpness < QUALITY.blurSharpness) return 'blurred';
  return null;
}

// ---------- Orientation ----------

export type OrientationProblem = 'ground' | 'sky' | null;

/**
 * From DeviceOrientation `beta` (front-back tilt, degrees): held upright facing forward ≈ 90. Below 40 the camera
 * looks steeply at the ground, above 140 at the sky (50° off level; the first build used 60° and testers tilting the
 * phone didn't trigger it — test round 1). Null when unknown (no sensor / no permission).
 */
export function orientationProblem(beta: number | null | undefined): OrientationProblem {
  if (beta === null || beta === undefined || !Number.isFinite(beta)) return null;
  const b = Math.abs(beta);
  if (b < 40) return 'ground';
  if (b > 140) return 'sky';
  return null;
}

// ---------- Degradation ladder ----------

export interface HealthInputs {
  /** Detector produced results recently (heartbeat). False → pipeline failure. */
  detectorAlive: boolean;
  /** Camera frames are advancing (not frozen / lost). */
  cameraLive: boolean;
  camera: CameraProblem;
  orientation: OrientationProblem;
  /** Scene scan working (false: offline, errors, quota). Null when scanning isn't in use (e.g. still loading). */
  sceneOk: boolean | null;
}

export interface LadderState {
  level: LadderLevel;
  /** Why (most important first), e.g. ['covered'] or ['offline']. */
  reasons: string[];
}

/** Level from current inputs (no timing). L3 > L2 > L1 > L0. */
export function evaluateLadder(i: HealthInputs): LadderState {
  if (!i.detectorAlive) return { level: 'L3', reasons: ['detector'] };
  const cam: string[] = [];
  if (!i.cameraLive) cam.push('frozen');
  // Orientation before picture quality: a phone aimed at the ground often also looks "blurred", and "hold the phone
  // upright" is the instruction that fixes both (test round 1: tilting gave "Camera can't see" instead).
  if (i.orientation) cam.push(i.orientation);
  if (i.camera) cam.push(i.camera);
  if (cam.length) return { level: 'L2', reasons: cam };
  if (i.sceneOk === false) return { level: 'L1', reasons: ['scene'] };
  return { level: 'L0', reasons: [] };
}

/** Spoken on entering each level (SAFETY.md §2 approved wording). */
export function ladderMessage(s: LadderState, from: LadderLevel): string {
  switch (s.level) {
    case 'L3':
      return 'Footprint stopped. Alerts are off.';
    case 'L2': {
      const why = s.reasons[0];
      if (why === 'ground') return 'Camera points at the ground. Hold the phone upright, facing forward. No obstacle alerts.';
      if (why === 'sky') return 'Camera points up. Hold the phone upright, facing forward. No obstacle alerts.';
      if (why === 'dark') return "It's too dark for the camera. No obstacle alerts. Use your cane.";
      return "Camera can't see. No obstacle alerts. Use your cane.";
    }
    case 'L1':
      return 'Scene descriptions unavailable. Obstacle alerts still on.';
    case 'L0':
      if (from === 'L1') return 'Scene descriptions are back.';
      return from === 'L3' ? 'Obstacle alerts are back.' : 'Camera is back. Obstacle alerts on.';
  }
}

/** How long a worse state must persist before it is announced, and a better one before recovery is announced. */
export const LADDER_HOLD_MS = { worse: 1500, better: 3000 } as const;
/**
 * While alerts are off (L2/L3) the warning is repeated this often — said only once, a user who missed it would assume
 * protection is on (test round 1: camera covered for a long time, warned once).
 */
export const LADDER_REMIND_MS = 20_000;

const RANK: Record<LadderLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

/**
 * Tracks the announced level with hysteresis. Worse states are announced after `worse` ms (ST-01: covered camera
 * within 2 s), recoveries after `better` ms, so a hand passing over the lens doesn't cause a burst of messages.
 * L3 is announced immediately.
 */
export class LadderTracker {
  private current: LadderState = { level: 'L0', reasons: [] };
  private candidate: LadderState | null = null;
  private since = 0;
  private spokenAt = 0;

  get state(): LadderState {
    return this.current;
  }

  /** Feed the latest evaluation; returns a message to speak when the announced level (or L2 reason) changes. */
  update(next: LadderState, now: number): string | null {
    const same = next.level === this.current.level && (next.level !== 'L2' || next.reasons[0] === this.current.reasons[0]);
    if (same) {
      this.candidate = null;
      if (RANK[this.current.level] >= RANK.L2 && now - this.spokenAt >= LADDER_REMIND_MS) {
        this.spokenAt = now;
        return ladderMessage(this.current, this.current.level); // reminder: alerts are still off
      }
      return null;
    }
    if (!this.candidate || this.candidate.level !== next.level || this.candidate.reasons[0] !== next.reasons[0]) {
      this.candidate = next;
      this.since = now;
    }
    const worse = RANK[next.level] > RANK[this.current.level];
    const hold = next.level === 'L3' ? 0 : worse ? LADDER_HOLD_MS.worse : LADDER_HOLD_MS.better;
    if (now - this.since < hold) return null;
    const from = this.current.level;
    // A same-level L2 reason change (e.g. dark → covered) re-announces only if the instruction differs.
    const before = ladderMessage(this.current, from);
    this.current = next;
    this.candidate = null;
    const msg = ladderMessage(next, from);
    if (msg === before) return null;
    this.spokenAt = now;
    return msg;
  }

  reset(): void {
    this.current = { level: 'L0', reasons: [] };
    this.candidate = null;
    this.spokenAt = 0;
  }
}

// ---------- Battery / performance warnings ----------

/** Battery levels (fraction) at which a warning is spoken once each per walk. */
export const BATTERY_WARN = [0.2, 0.1, 0.05] as const;

export function batteryMessage(level: number): string {
  const pct = Math.round(level * 100);
  if (level <= 0.05) return `Battery ${pct} percent. Footprint will stop when the phone shuts down.`;
  return `Battery low, ${pct} percent.`;
}

/** Detector below this rate for a while → the phone is overloaded or hot: alerts may be late (SAF-17). */
export const SLOW_FPS = 5;
export const SLOW_MESSAGE = 'Obstacle detection is slow. Alerts may be late. The phone may be too hot.';
export const HOT_MESSAGE = 'The phone is very hot. Alerts may be late.';
