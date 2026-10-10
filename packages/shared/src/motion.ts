// Motion & time-to-contact from a single camera (ADR-024). Pure functions + a small tracker; unit-tested.
// Coordinates are pixels in the analysed frame, origin top-left.
import type { AlertCandidate, HazardType } from './types.js';
import { tierFor } from './tiers.js';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  box: Box;
  /** Detector class name (COCO), e.g. "person". */
  label: string;
  score: number;
}

export interface FrameInfo {
  width: number;
  height: number;
  /** Timestamp in milliseconds. */
  ts: number;
}

/** COCO classes we act on. Anything else is ignored unless it is large and close (see `isLargeUnknown`). */
const COCO_TO_HAZARD: Readonly<Record<string, HazardType>> = {
  person: 'person',
  bicycle: 'cyclist',
  motorcycle: 'vehicle',
  car: 'vehicle',
  bus: 'vehicle',
  truck: 'vehicle',
  train: 'vehicle',
  dog: 'obstruction',
  horse: 'obstruction',
  cow: 'obstruction',
  bench: 'street_furniture',
  'fire hydrant': 'street_furniture',
  'stop sign': 'street_furniture',
  'parking meter': 'street_furniture',
  chair: 'obstruction',
  suitcase: 'obstruction',
  'potted plant': 'obstruction',
};

export function hazardTypeFor(label: string): HazardType | null {
  return COCO_TO_HAZARD[label.toLowerCase()] ?? null;
}

/** Unknown objects still matter when they fill the path (SAFETY.md §2: unknown → generic "obstacle"). */
export function isLargeUnknown(box: Box, frame: FrameInfo): boolean {
  return box.h / frame.height > 0.4 && isInPath(box, frame);
}

/** Typical real heights in metres, for the pinhole distance estimate. */
export const TYPICAL_HEIGHT_M: Readonly<Partial<Record<HazardType, number>>> = {
  person: 1.7,
  cyclist: 1.7,
  vehicle: 1.5,
  obstruction: 0.8,
  street_furniture: 0.9,
};

/** Assumed horizontal field of view of a phone main camera. Calibrate per device later (SAF-23). */
export const DEFAULT_HFOV_DEG = 65;

/** Typical walking speed (m/s) used when an object's motion isn't measured yet. */
export const WALKING_SPEED_MPS = 1.4;

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Focal length in pixels from image width and horizontal field of view (square pixels assumed). */
export function focalPx(imageWidth: number, hfovDeg = DEFAULT_HFOV_DEG): number {
  return imageWidth / 2 / Math.tan(((hfovDeg / 2) * Math.PI) / 180);
}

/** Pinhole distance estimate in metres; undefined when the type has no typical height or the box is degenerate. */
export function estimateDistanceM(type: HazardType, boxH: number, imageWidth: number, hfovDeg = DEFAULT_HFOV_DEG): number | undefined {
  const real = TYPICAL_HEIGHT_M[type];
  if (!real || !(boxH > 0)) return undefined;
  return (focalPx(imageWidth, hfovDeg) * real) / boxH;
}

/** Bearing of the box centre relative to straight ahead, degrees (negative = left). */
export function bearingDeg(box: Box, frame: FrameInfo, hfovDeg = DEFAULT_HFOV_DEG): number {
  const cx = box.x + box.w / 2;
  const offset = (cx - frame.width / 2) / (frame.width / 2); // -1..1
  return (Math.atan(offset * Math.tan(((hfovDeg / 2) * Math.PI) / 180)) * 180) / Math.PI;
}

/** In the walking path: the box overlaps the central corridor (default: middle 40 % of the frame width). */
export function isInPath(box: Box, frame: FrameInfo, corridor = 0.4): boolean {
  const left = (frame.width * (1 - corridor)) / 2;
  const right = frame.width - left;
  return box.x < right && box.x + box.w > left;
}

/** Box touches the frame edge → its size is truncated, so looming and distance are unreliable (SAF-27). */
export function isEdgeCut(box: Box, frame: FrameInfo, margin = 2): boolean {
  return box.x <= margin || box.y <= margin || box.x + box.w >= frame.width - margin || box.y + box.h >= frame.height - margin;
}

export interface HeightSample {
  h: number;
  /** milliseconds */
  ts: number;
}

/**
 * Time-to-contact from looming (box growth), seconds.
 * Box height is proportional to 1/distance, so for a constant closing speed u = 1/h falls *linearly* in time:
 * u(t) = (d0 − v·t)/k. A least-squares line through u gives TTC = u(t_last) ÷ (−du/dt) exactly — fitting h itself
 * would lag behind the accelerating growth and overestimate TTC (warn too late). The fit also smooths jitter.
 * Returns Infinity when there are too few samples or the object isn't approaching.
 */
export function loomingTtcSeconds(samples: readonly HeightSample[], minSamples = 5): number {
  if (samples.length < minSamples || samples.some((s) => !(s.h > 0))) return Infinity;
  const n = samples.length;
  const t0 = samples[0]!.ts;
  let st = 0, su = 0, stt = 0, stu = 0;
  for (const s of samples) {
    const t = (s.ts - t0) / 1000;
    const u = 1 / s.h;
    st += t;
    su += u;
    stt += t * t;
    stu += t * u;
  }
  const denom = n * stt - st * st;
  if (denom <= 1e-12) return Infinity;
  const slope = (n * stu - st * su) / denom; // du/dt, negative when approaching
  const meanT = st / n;
  const lastT = (samples[n - 1]!.ts - t0) / 1000;
  const fittedLastU = su / n + slope * (lastT - meanT);
  if (!(fittedLastU > 0) || slope >= 0) return Infinity;
  const ttc = fittedLastU / -slope;
  // Beyond 60 s the growth is indistinguishable from jitter: treat as "not approaching".
  return ttc > 60 ? Infinity : ttc;
}

export interface Track {
  id: string;
  type: HazardType;
  label: string;
  box: Box;
  /** Recent heights (smoothed) for looming. */
  heights: HeightSample[];
  scores: number[];
  hits: number;
  misses: number;
  edgeCut: boolean;
}

export interface TrackerOptions {
  iouThreshold?: number;
  maxMisses?: number;
  history?: number;
  /** Exponential smoothing factor for box height (0..1; higher = more responsive). */
  smoothing?: number;
}

/** Greedy IoU tracker: stable IDs across frames, drops tracks after `maxMisses` missed frames. */
export class Tracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly opts: Required<TrackerOptions>;

  constructor(opts: TrackerOptions = {}) {
    this.opts = { iouThreshold: 0.3, maxMisses: 5, history: 12, smoothing: 0.6, ...opts };
  }

  update(detections: readonly Detection[], frame: FrameInfo): Track[] {
    const unmatched = new Set(this.tracks.map((_, i) => i));
    const pairs: { t: number; d: number; v: number }[] = [];
    detections.forEach((det, d) => {
      this.tracks.forEach((tr, t) => {
        if (tr.label !== det.label) return;
        const v = iou(tr.box, det.box);
        if (v >= this.opts.iouThreshold) pairs.push({ t, d, v });
      });
    });
    pairs.sort((a, b) => b.v - a.v);
    const usedDet = new Set<number>();
    for (const p of pairs) {
      if (!unmatched.has(p.t) || usedDet.has(p.d)) continue;
      unmatched.delete(p.t);
      usedDet.add(p.d);
      this.refresh(this.tracks[p.t]!, detections[p.d]!, frame);
    }
    for (const t of unmatched) this.tracks[t]!.misses++;
    detections.forEach((det, d) => {
      if (usedDet.has(d)) return;
      const type = hazardTypeFor(det.label) ?? (isLargeUnknown(det.box, frame) ? 'unknown' : null);
      if (!type) return;
      this.tracks.push({
        id: `t${this.nextId++}`,
        type,
        label: det.label,
        box: det.box,
        heights: [{ h: det.box.h, ts: frame.ts }],
        scores: [det.score],
        hits: 1,
        misses: 0,
        edgeCut: isEdgeCut(det.box, frame),
      });
    });
    this.tracks = this.tracks.filter((t) => t.misses <= this.opts.maxMisses);
    return this.tracks.filter((t) => t.misses === 0);
  }

  private refresh(track: Track, det: Detection, frame: FrameInfo): void {
    const prev = track.heights[track.heights.length - 1]!.h;
    const h = this.opts.smoothing * det.box.h + (1 - this.opts.smoothing) * prev;
    track.box = det.box;
    track.heights.push({ h, ts: frame.ts });
    if (track.heights.length > this.opts.history) track.heights.shift();
    track.scores.push(det.score);
    if (track.scores.length > this.opts.history) track.scores.shift();
    track.hits++;
    track.misses = 0;
    track.edgeCut = isEdgeCut(det.box, frame);
  }
}

export interface CandidateOptions {
  /** Hits before a track is announced at all (filters one-frame false positives). */
  minHits?: number;
  /** Hits before motion (TTC) is trusted. ADR-024: ≥ 5 frames. */
  minMotionHits?: number;
  hfovDeg?: number;
}

/** Turn a track into an alert candidate (ADR-022 tiers). Returns null while the track is too young. */
export function candidateFor(track: Track, frame: FrameInfo, opts: CandidateOptions = {}): AlertCandidate | null {
  const { minHits = 3, minMotionHits = 5, hfovDeg = DEFAULT_HFOV_DEG } = opts;
  if (track.hits < minHits) return null;
  const inPath = isInPath(track.box, frame);
  const fillsFrame = track.box.h / frame.height > 0.6;
  // Edge-cut boxes have truncated sizes: no looming, no distance → cautious NaN tier, unless it fills the path (very close).
  const distance = track.edgeCut ? undefined : estimateDistanceM(track.type, track.box.h, frame.width, hfovDeg);
  let ttc = track.edgeCut || track.hits < minMotionHits ? Number.NaN : loomingTtcSeconds(track.heights);
  // Motion not known yet → assume the user walks towards it (distance ÷ walking speed), so far objects stay low-tier
  // (SAF-02); only when distance is also unknown does the cautious NaN tier apply (SAFETY.md §2).
  if (Number.isNaN(ttc) && distance !== undefined) ttc = distance / WALKING_SPEED_MPS;
  let tier = tierFor(ttc, inPath, distance);
  if (track.edgeCut && fillsFrame && inPath) tier = 'P0';
  const confidence = track.scores.reduce((a, b) => a + b, 0) / track.scores.length;
  return {
    id: track.id,
    type: track.type,
    tier,
    ttcSeconds: Number.isNaN(ttc) ? Infinity : ttc,
    bearingDeg: bearingDeg(track.box, frame, hfovDeg),
    inPath,
    confidence,
    source: 'on_device',
    observedAt: frame.ts,
  };
}
