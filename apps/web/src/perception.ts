// Detection loop (Q2): frames → detector → tracker → alert candidates. Speaking is the alert manager's job (Q3).
import { candidateFor, Tracker, type AlertCandidate, type FrameInfo, type Track } from '@footprint/shared';
import type { OnDeviceDetector } from './detector';

export interface PerceptionStats {
  fps: number;
  inferenceMs: number;
  tracks: number;
}

export interface PerceptionOptions {
  onCandidates: (candidates: AlertCandidate[], tracks: Track[], frame: FrameInfo, stats: PerceptionStats) => void;
  /** Called when the loop throws — the caller announces it (fail loud). */
  onError: (err: unknown) => void;
}

export class PerceptionLoop {
  private running = false;
  private handle = 0;
  private tracker = new Tracker();
  private lastTs = 0;
  private fps = 0;
  private infer = 0;

  constructor(
    private readonly detector: OnDeviceDetector,
    private readonly video: HTMLVideoElement,
    private readonly opts: PerceptionOptions,
  ) {}

  start(): void {
    this.running = true;
    this.tracker = new Tracker();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private schedule(): void {
    if (!this.running) return;
    this.handle = requestAnimationFrame((now) => this.tick(now));
  }

  private tick(now: number): void {
    try {
      const v = this.video;
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && v.videoWidth > 0 && now > this.lastTs) {
        const t0 = performance.now();
        const detections = this.detector.detect(v, now);
        const t1 = performance.now();
        const frame: FrameInfo = { width: v.videoWidth, height: v.videoHeight, ts: now };
        const tracks = this.tracker.update(detections, frame);
        const candidates = tracks.flatMap((t) => candidateFor(t, frame) ?? []);
        if (this.lastTs > 0) {
          const inst = 1000 / (now - this.lastTs);
          this.fps = this.fps === 0 ? inst : 0.9 * this.fps + 0.1 * inst;
        }
        this.infer = this.infer === 0 ? t1 - t0 : 0.9 * this.infer + 0.1 * (t1 - t0);
        this.lastTs = now;
        this.opts.onCandidates(candidates, tracks, frame, { fps: this.fps, inferenceMs: this.infer, tracks: tracks.length });
      }
    } catch (err) {
      this.running = false;
      this.opts.onError(err);
      return;
    }
    this.schedule();
  }
}
