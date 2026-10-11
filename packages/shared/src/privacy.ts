// Face-blur geometry (ADR-013, R1.8): which pixel regions of an outgoing frame get pixelated.
// Pure functions so they can be unit-tested without a browser. Coordinates are pixels, origin top-left.
import { iou, type Box, type FrameInfo } from './motion.js';

/** Extra margin around a detected face, as a fraction of the face box (detectors crop tightly; hair and chin leak). */
export const FACE_PAD = 0.3;

/**
 * Top share of a person box treated as "head" when the face detector found nothing there. Costs nothing (we already have
 * person boxes from the object detector) and covers profiles, hats and small faces the face model misses.
 */
export const HEAD_FRACTION = 0.35;

/**
 * Margin around the head band (fraction of the person box): faces of people leaning, turning or partly outside the
 * box leaked with a tight band (Q6 leak audit, Singapore clip, 2026-10-12).
 */
export const HEAD_PAD_X = 0.15;
export const HEAD_PAD_Y = 0.08;

/** Pixelation grid: the longer side of a blurred region is reduced to about this many blocks. */
export const BLUR_CELLS = 6;

/** Regions smaller than this (px) in either direction are dropped — nothing identifiable fits in them. */
const MIN_REGION_PX = 2;

/** Intersect a box with the frame; null when nothing is left. */
export function clampBox(box: Box, frame: Pick<FrameInfo, 'width' | 'height'>): Box | null {
  const x1 = Math.max(0, box.x);
  const y1 = Math.max(0, box.y);
  const x2 = Math.min(frame.width, box.x + box.w);
  const y2 = Math.min(frame.height, box.y + box.h);
  if (!(x2 - x1 > 0) || !(y2 - y1 > 0)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Grow a box by `pad` × its size on every side, then clamp to the frame. */
export function padBox(box: Box, frame: Pick<FrameInfo, 'width' | 'height'>, pad = FACE_PAD): Box | null {
  const dx = box.w * pad;
  const dy = box.h * pad;
  return clampBox({ x: box.x - dx, y: box.y - dy, w: box.w + 2 * dx, h: box.h + 2 * dy }, frame);
}

/** The head area of a person (or rider) box: its top `fraction` plus a margin on the sides and above, clamped. */
export function headRegion(person: Box, frame: Pick<FrameInfo, 'width' | 'height'>, fraction = HEAD_FRACTION): Box | null {
  const dx = person.w * HEAD_PAD_X;
  const dy = person.h * HEAD_PAD_Y;
  return clampBox({ x: person.x - dx, y: person.y - dy, w: person.w + 2 * dx, h: person.h * fraction + dy }, frame);
}

/** Map a box from one frame size to another (e.g. video pixels → the 640 px upload canvas). */
export function scaleBox(box: Box, sx: number, sy: number): Box {
  return { x: box.x * sx, y: box.y * sy, w: box.w * sx, h: box.h * sy };
}

/** Round outwards to whole pixels so a region never shrinks when drawn (EPS absorbs floating-point noise like 76.00000000000001). */
const EPS = 1e-6;
function outward(b: Box): Box {
  const x = Math.floor(b.x + EPS);
  const y = Math.floor(b.y + EPS);
  return { x, y, w: Math.ceil(b.x + b.w - EPS) - x, h: Math.ceil(b.y + b.h - EPS) - y };
}

export interface BlurInput {
  /** Face detector boxes, in `frame` pixels. */
  faces: readonly Box[];
  /** Person / rider boxes from the object detector, in `frame` pixels (head heuristic). */
  persons?: readonly Box[];
  frame: Pick<FrameInfo, 'width' | 'height'>;
}

/** Every region to pixelate: padded faces plus person head areas. Degenerate regions are dropped. */
export function blurRegions({ faces, persons = [], frame }: BlurInput): Box[] {
  const out: Box[] = [];
  for (const f of faces) {
    const r = padBox(f, frame);
    if (r) out.push(r);
  }
  for (const p of persons) {
    const r = headRegion(p, frame);
    if (r) out.push(r);
  }
  return out.map(outward).filter((r) => r.w >= MIN_REGION_PX && r.h >= MIN_REGION_PX);
}

/** Pixelation block size (px) for a region: coarse enough that identity cannot be recovered. */
export function pixelBlock(region: Box, cells = BLUR_CELLS): number {
  return Math.max(4, Math.ceil(Math.max(region.w, region.h) / cells));
}

/** One perception frame's person boxes, in that frame's pixels. */
export interface PersonSnapshot {
  boxes: readonly Box[];
  frame: Pick<FrameInfo, 'width' | 'height'>;
  /** ms, same clock as `now` below. */
  at: number;
}

/** How long person boxes keep protecting a face after the detector last saw that person. */
export const PERSON_HOLD_MS = 1000;

/**
 * Person boxes from every snapshot of the last `holdMs`, scaled to `target` pixels. The detector misses people for a frame
 * or two (motion blur, occlusion); using only the newest frame left faces unblurred in those gaps (owner review,
 * Singapore clip, 2026-10-12). Holding recent boxes over-blurs a little — the safe direction. Newest snapshot first;
 * an older box that overlaps one already kept (IoU ≥ 0.5, the same person) is skipped so regions don't pile up.
 */
export function heldPersonBoxes(
  history: readonly PersonSnapshot[],
  now: number,
  target: Pick<FrameInfo, 'width' | 'height'>,
  holdMs = PERSON_HOLD_MS,
): Box[] {
  const out: Box[] = [];
  for (const snap of [...history].sort((a, b) => b.at - a.at)) {
    if (now - snap.at > holdMs || !(snap.frame.width > 0) || !(snap.frame.height > 0)) continue;
    const sx = target.width / snap.frame.width;
    const sy = target.height / snap.frame.height;
    for (const b of snap.boxes) {
      const s = scaleBox(b, sx, sy);
      if (!out.some((k) => iou(k, s) >= 0.5)) out.push(s);
    }
  }
  return out;
}
