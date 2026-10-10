// Dev-only clip evaluator (Q2 tuning): steps through a recorded clip at a fixed sample rate, runs the same
// detector → tracker → candidate pipeline as the app, and reports every alert it would raise.
// Deterministic (seek-per-frame, not real-time playback), so runs are comparable across threshold changes.
// Served by `npm run dev` at /clip-eval.html; not part of the production build. Results stay in the browser.
import { AlertManager, candidateFor, Tracker, type AlertCandidate, type CandidateOptions, type Tier } from '@footprint/shared';
import { createDetector } from '../detector';
import { drawOverlay } from '../overlay';

export interface ClipEvalOptions {
  /** Frames analysed per second of clip (simulates phone fps). */
  sampleFps?: number;
  /** Horizontal field of view of the recording camera, degrees. */
  hfovDeg?: number;
  candidate?: CandidateOptions;
  onProgress?: (t: number, duration: number) => void;
  /** Draw each analysed frame's overlay (slower; for watching). */
  overlay?: HTMLCanvasElement;
}

export interface AlertEvent {
  t: number;
  id: string;
  type: string;
  tier: Tier;
  ttc: number;
  bearing: number;
  inPath: boolean;
  conf: number;
}

export interface ClipEvalResult {
  delegate: string;
  duration: number;
  frames: number;
  meanInferenceMs: number;
  /** One entry per track the first time it reaches each tier (what the alert manager would consider). */
  escalations: AlertEvent[];
  /** Frames containing at least one candidate of the tier. */
  framesByTier: Record<string, number>;
  /** Detected labels (including ignored classes) → frames seen. */
  labels: Record<string, number>;
  /** Q3: what the alert manager would actually say (speech time simulated at ~350 ms/word + earcon). */
  spoken: { t: number; tier: Tier; text: string }[];
  spokenPerMinute: number;
  /** Earcon-only repeats per minute. */
  cuesPerMinute: number;
}

/** Rough on-device TTS duration for simulation. */
function speechMs(text: string): number {
  return text ? 300 + text.split(/\s+/).length * 350 : 300;
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => reject(new Error('video seek failed'));
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = t;
  });
}

export async function evaluateClip(video: HTMLVideoElement, opts: ClipEvalOptions = {}): Promise<ClipEvalResult> {
  const { sampleFps = 10, hfovDeg, candidate = {}, onProgress, overlay } = opts;
  const detector = await createDetector();
  const tracker = new Tracker();
  const step = 1 / sampleFps;
  const seen = new Map<string, Set<Tier>>();
  const result: ClipEvalResult = {
    delegate: detector.delegate,
    duration: video.duration,
    frames: 0,
    meanInferenceMs: 0,
    escalations: [],
    framesByTier: {},
    labels: {},
    spoken: [],
    spokenPerMinute: 0,
    cuesPerMinute: 0,
  };
  const manager = new AlertManager();
  let busyUntil = 0;
  let inferTotal = 0;
  try {
    for (let t = 0; t < video.duration; t += step) {
      await seek(video, t);
      const ts = Math.round(t * 1000) + 1; // MediaPipe VIDEO mode needs strictly increasing timestamps
      const t0 = performance.now();
      const detections = detector.detect(video, ts);
      inferTotal += performance.now() - t0;
      for (const d of detections) result.labels[d.label] = (result.labels[d.label] ?? 0) + 1;
      const frame = { width: video.videoWidth, height: video.videoHeight, ts };
      const tracks = tracker.update(detections, frame);
      const candidates: AlertCandidate[] = tracks.flatMap(
        (tr) => candidateFor(tr, frame, { ...candidate, ...(hfovDeg ? { hfovDeg } : {}) }) ?? [],
      );
      const tiersThisFrame = new Set<Tier>();
      for (const c of candidates) {
        tiersThisFrame.add(c.tier);
        const s = seen.get(c.id) ?? new Set<Tier>();
        if (!s.has(c.tier)) {
          s.add(c.tier);
          seen.set(c.id, s);
          result.escalations.push({
            t: Math.round(t * 10) / 10,
            id: c.id,
            type: c.type,
            tier: c.tier,
            ttc: Math.round(c.ttcSeconds * 10) / 10,
            bearing: Math.round(c.bearingDeg),
            inPath: c.inPath,
            conf: Math.round(c.confidence * 100) / 100,
          });
        }
      }
      manager.update(candidates);
      const speaking = ts < busyUntil;
      if (!speaking) manager.finished();
      const u = manager.next(ts, speaking);
      if (u) {
        busyUntil = ts + speechMs(u.text);
        result.spoken.push({ t: Math.round(t * 10) / 10, tier: u.tier, text: u.text });
      }
      for (const tier of tiersThisFrame) result.framesByTier[tier] = (result.framesByTier[tier] ?? 0) + 1;
      if (overlay) drawOverlay(overlay, frame, tracks, candidates);
      result.frames++;
      onProgress?.(t, video.duration);
    }
  } finally {
    detector.close();
  }
  const minutes = Math.max(1, result.duration / 60);
  const cues = result.spoken.filter((x) => !x.text).length;
  result.spokenPerMinute = Math.round(((result.spoken.length - cues) / minutes) * 10) / 10;
  result.cuesPerMinute = Math.round((cues / minutes) * 10) / 10;
  result.meanInferenceMs = Math.round((inferTotal / Math.max(1, result.frames)) * 10) / 10;
  return result;
}

// Page wiring (clip-eval.html).
const input = document.querySelector<HTMLInputElement>('#clip');
const runBtn = document.querySelector<HTMLButtonElement>('#run');
const out = document.querySelector<HTMLPreElement>('#out');
const vid = document.querySelector<HTMLVideoElement>('#video');
const canvas = document.querySelector<HTMLCanvasElement>('#overlay');
if (input && runBtn && out && vid) {
  runBtn.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) return;
    vid.src = URL.createObjectURL(file);
    await new Promise((r) => vid.addEventListener('loadeddata', r, { once: true }));
    const fps = Number(document.querySelector<HTMLInputElement>('#fps')?.value) || 10;
    const hfov = Number(document.querySelector<HTMLInputElement>('#hfov')?.value) || undefined;
    const res = await evaluateClip(vid, {
      sampleFps: fps,
      hfovDeg: hfov,
      overlay: canvas ?? undefined,
      onProgress: (t, d) => (out.textContent = `analysing ${t.toFixed(1)} / ${d.toFixed(1)} s`),
    });
    (window as unknown as { __clipEval: ClipEvalResult }).__clipEval = res;
    out.textContent = JSON.stringify(res, null, 1);
  });
}
