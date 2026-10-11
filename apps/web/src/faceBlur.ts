// Face blur before upload (ADR-013, R1.8, PRI-01). The ONLY sanctioned way to get a frame that may leave the phone:
// downscale → detect faces → pixelate faces and person head areas. Fail closed: any problem returns null, never a
// raw frame. Later steps (Q6 scene scan, Q10 live Q&A) must use getUploadFrame / getUploadJpeg — enforced by
// uploadGuard.test.ts.
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { blurRegions, pixelBlock, scaleBox, type Box, type FrameInfo } from '@footprint/shared';
import { frameToJpeg, grabFrame } from './frameSource';

/** Self-hosted runtime (copied by scripts/copy-mediapipe.mjs), same as the object detector. */
const WASM_BASE = '/mediapipe/wasm';
/** Google-hosted BlazeFace short-range model (cached by the browser after first load; self-host: FOLLOWUPS #2). */
export const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/** Uploads are never wider than this (ADR-013: downscale ≤ 640 px). */
export const UPLOAD_MAX_WIDTH = 640;
/** Person boxes older than this are not used for head areas (the perception loop updates them every frame). */
const PERSON_MAX_AGE_MS = 1000;

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
  private persons: { boxes: Box[]; frame: FrameInfo; at: number } | null = null;

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
    this.persons = { boxes: [...boxes], frame, at: performance.now() };
  }

  clearPersons(): void {
    this.persons = null;
  }

  /** A blurred, downscaled copy of the current video frame — or null (fail closed). Never returns raw pixels. */
  getUploadFrame(video: HTMLVideoElement): UploadFrame | null {
    const t0 = performance.now();
    const c = grabFrame(video, UPLOAD_MAX_WIDTH, this.canvas);
    if (!c) return null;
    try {
      const faces = this.detector.detect(c).detections.flatMap((d) => {
        const b = d.boundingBox;
        return b ? [{ x: b.originX, y: b.originY, w: b.width, h: b.height }] : [];
      });
      const frame = { width: c.width, height: c.height };
      let persons: Box[] = [];
      const p = this.persons;
      if (p && performance.now() - p.at <= PERSON_MAX_AGE_MS && p.frame.width > 0) {
        const sx = c.width / p.frame.width;
        const sy = c.height / p.frame.height;
        persons = p.boxes.map((b) => scaleBox(b, sx, sy));
      }
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
