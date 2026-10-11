// Face blur before upload (ADR-013, R1.8, PRI-01). The ONLY sanctioned way to get a frame that may leave the phone:
// downscale → detect faces → pixelate faces and person head areas. Fail closed: any problem returns null, never a
// raw frame. Later steps (Q6 scene scan, Q10 live Q&A) must use getUploadFrame / getUploadJpeg — enforced by
// uploadGuard.test.ts.
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { blurRegions, heldPersonBoxes, iou, pixelBlock, PERSON_HOLD_MS, type Box, type FrameInfo, type PersonSnapshot } from '@footprint/shared';
import { frameToJpeg, grabFrame } from './frameSource';

/** Self-hosted runtime (copied by scripts/copy-mediapipe.mjs), same as the object detector. */
const WASM_BASE = '/mediapipe/wasm';
/** Google-hosted BlazeFace short-range model (cached by the browser after first load; self-host: FOLLOWUPS #2). */
export const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/** Uploads are never wider than this (ADR-013: downscale ≤ 640 px). */
export const UPLOAD_MAX_WIDTH = 640;

export interface UploadFrame {
  /** Blurred frame, ≤ UPLOAD_MAX_WIDTH wide. Owned by the blurrer: encode or copy it before the next call. */
  canvas: HTMLCanvasElement;
  /** Face-detector hits that were pixelated. */
  faces: number;
  /** Head areas pixelated from person boxes (includes ones overlapping a detected face). */
  heads: number;
  /** Time spent on detection + blur, ms (fps-impact measurement, DoD). */
  ms: number;
}

export class FaceBlurrer {
  private readonly canvas = document.createElement('canvas');
  private readonly scratch = document.createElement('canvas');
  private readonly tile = document.createElement('canvas');
  /** Recent person snapshots (≤ PERSON_HOLD_MS): a one-frame detector miss must not leave a face unblurred. */
  private persons: PersonSnapshot[] = [];

  private constructor(
    private readonly detector: FaceDetector,
    readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(): Promise<FaceBlurrer> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
        runningMode: 'IMAGE',
        // Low threshold on purpose: a false blur costs a little detail, a missed face costs privacy.
        minDetectionConfidence: 0.3,
      });
    try {
      return new FaceBlurrer(await make('GPU'), 'GPU');
    } catch {
      return new FaceBlurrer(await make('CPU'), 'CPU');
    }
  }

  /** Latest person / rider boxes from the perception loop (video pixels); used for the head-area backstop. */
  setPersons(boxes: readonly Box[], frame: FrameInfo): void {
    const now = performance.now();
    this.persons = this.persons.filter((s) => now - s.at <= PERSON_HOLD_MS);
    const snap = { boxes: [...boxes], frame: { width: frame.width, height: frame.height }, at: now };
    // ≤ 10 snapshots per second: replace the newest one while it is < 100 ms old, so the history stays small.
    const last = this.persons[this.persons.length - 1];
    if (last && now - last.at < 100 && this.persons.length > 1) this.persons[this.persons.length - 1] = { ...snap, at: last.at };
    else this.persons.push(snap);
  }

  clearPersons(): void {
    this.persons = [];
  }

  /** A blurred, downscaled copy of the current video frame — or null (fail closed). Never returns raw pixels. */
  getUploadFrame(video: HTMLVideoElement): UploadFrame | null {
    const t0 = performance.now();
    const c = grabFrame(video, UPLOAD_MAX_WIDTH, this.canvas);
    if (!c) return null;
    try {
      const faces = this.detectFaces(c);
      const frame = { width: c.width, height: c.height };
      const persons = heldPersonBoxes(this.persons, performance.now(), frame);
      const faceRegions = blurRegions({ faces, frame });
      const regions = blurRegions({ faces, persons, frame });
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      for (const r of regions) this.pixelate(ctx, r);
      return { canvas: c, faces: faceRegions.length, heads: regions.length - faceRegions.length, ms: performance.now() - t0 };
    } catch (err) {
      console.error('face blur failed; frame discarded', err);
      this.discard();
      return null;
    }
  }

  /** getUploadFrame + JPEG encoding. The canvas is wiped afterwards so no frame lingers in memory. */
  async getUploadJpeg(video: HTMLVideoElement, quality = 0.7): Promise<{ blob: Blob; faces: number; heads: number; ms: number } | null> {
    const f = this.getUploadFrame(video);
    if (!f) return null;
    try {
      const blob = await frameToJpeg(f.canvas, quality);
      return blob ? { blob, faces: f.faces, heads: f.heads, ms: f.ms } : null;
    } finally {
      this.discard();
    }
  }

  close(): void {
    this.discard();
    this.detector.close();
  }

  /**
   * Faces on the whole frame plus 4 overlapping tiles (60 % of each side). BlazeFace resizes its input to 128 px, so a
   * face 3–8 m away is a few pixels on the whole frame; inside a tile it is ~1.7× larger and gets found (Q6 leak audit).
   * Costs 5 detections per upload frame (~1 every 2–3 s), not per camera frame.
   */
  private detectFaces(c: HTMLCanvasElement): Box[] {
    const found: Box[] = [];
    const add = (canvas: HTMLCanvasElement, ox: number, oy: number) => {
      for (const d of this.detector.detect(canvas).detections) {
        const b = d.boundingBox;
        if (!b) continue;
        const box = { x: b.originX + ox, y: b.originY + oy, w: b.width, h: b.height };
        if (!found.some((f) => iou(f, box) >= 0.3)) found.push(box);
      }
    };
    add(c, 0, 0);
    const tw = Math.round(c.width * 0.6);
    const th = Math.round(c.height * 0.6);
    this.tile.width = tw;
    this.tile.height = th;
    const t = this.tile.getContext('2d');
    if (!t) throw new Error('no tile 2d context');
    for (const [ox, oy] of [[0, 0], [c.width - tw, 0], [0, c.height - th], [c.width - tw, c.height - th]] as const) {
      t.drawImage(c, ox, oy, tw, th, 0, 0, tw, th);
      add(this.tile, ox, oy);
    }
    this.tile.width = 1; // wipe
    return found;
  }

  /** Pixelate one region: average it down to a few blocks, then draw it back up without smoothing. */
  private pixelate(ctx: CanvasRenderingContext2D, r: Box): void {
    const block = pixelBlock(r);
    const w = Math.max(1, Math.ceil(r.w / block));
    const h = Math.max(1, Math.ceil(r.h / block));
    this.scratch.width = w;
    this.scratch.height = h;
    const s = this.scratch.getContext('2d');
    if (!s) throw new Error('no scratch 2d context');
    s.imageSmoothingEnabled = true;
    s.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.scratch, 0, 0, w, h, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
  }

  /** Wipe the working canvas (resizing clears it). */
  private discard(): void {
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
