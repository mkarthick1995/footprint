// Entry point. Detector (Q2) → candidates → alert output (Q3), the only speaking path.
import { AlertOutput } from './alertOutput';
import { createDetector, type OnDeviceDetector } from './detector';
import { FaceBlurrer } from './faceBlur';
import { openCamera, openClip, type FrameSource } from './frameSource';
import { drawOverlay } from './overlay';
import { PerceptionLoop } from './perception';
import { SceneScanner, type ScanStatus } from './sceneScan';
import { cameraErrorMessage, MESSAGES } from './messages';
import { currentVoiceName } from './speech';
import { ScreenWakeLock } from './wakeLock';

const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const video = document.querySelector<HTMLVideoElement>('#preview')!;
const clipInput = document.querySelector<HTMLInputElement>('#clip-file')!;
const frameInfo = document.querySelector<HTMLParagraphElement>('#frame-info');
const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!;
const blurDebug = document.querySelector<HTMLCanvasElement>('#blur-debug');
const blurInfo = document.querySelector<HTMLParagraphElement>('#blur-info');
/** ST-10: `?debug=blur` shows exactly the frame that would be uploaded, so a tester can see the faces are blurred. */
const debugBlur = new URLSearchParams(location.search).get('debug') === 'blur';

let source: FrameSource | null = null;
let frameTimer: number | undefined;
let detector: OnDeviceDetector | null = null;
let loop: PerceptionLoop | null = null;
let perfText = '';
/** Face blur (R1.8). Null until loaded, or when it failed — then nothing may be uploaded (fail closed). */
let blurrer: FaceBlurrer | null = null;

const output = new AlertOutput(statusEl);

/** Q6: Gemini scene scan — static ground hazards (potholes, drains, kerbs, footpath, crossings). */
const SCAN_MESSAGES: Record<ScanStatus, string> = {
  down: MESSAGES.scanDown,
  up: MESSAGES.scanUp,
  capped: MESSAGES.scanCapped,
};
const scanner = new SceneScanner({
  video,
  blurrer: () => blurrer,
  onStatus: (status) => announce(SCAN_MESSAGES[status]),
  onContext: (text) => output.sayModelText(text, { kind: 'context' }),
});

/** System messages (fail loud): queued as SYS in the alert manager, mirrored to the aria-live status. */
function announce(text: string): void {
  output.say(text);
}

const wakeLock = new ScreenWakeLock(announce);

document.querySelectorAll<HTMLInputElement>('input[name="source"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    clipInput.hidden = radio.value !== 'clip' || !radio.checked;
  }),
);

async function stop(message: string = MESSAGES.stopped): Promise<void> {
  window.clearInterval(frameTimer);
  loop?.stop();
  loop = null;
  scanner.stop();
  blurrer?.clearPersons();
  output.reset();
  overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
  source?.stop();
  source = null;
  await wakeLock.release();
  startBtn.textContent = 'Start walking';
  if (frameInfo) frameInfo.textContent = '';
  if (blurInfo) blurInfo.textContent = '';
  if (blurDebug) blurDebug.hidden = true;
  announce(message);
}

async function start(): Promise<void> {
  const kind = document.querySelector<HTMLInputElement>('input[name="source"]:checked')?.value;
  try {
    if (kind === 'clip') {
      const file = clipInput.files?.[0];
      if (!file) {
        announce(MESSAGES.chooseClip);
        return;
      }
      source = await openClip(video, file);
    } else {
      // While the page is hidden the browser mutes the camera itself; the visibility handler already speaks
      // "paused" / "resumed", so only announce track changes that happen while the user is in the app.
      source = await openCamera(video, {
        onLost: () => { if (!document.hidden) announce(MESSAGES.cameraLost); },
        onRestored: () => { if (!document.hidden) announce(MESSAGES.resumed); },
      });
    }
  } catch (err) {
    console.error(err);
    announce(cameraErrorMessage(err, window.isSecureContext));
    return;
  }
  startBtn.textContent = 'Stop';
  announce(MESSAGES.started);
  await wakeLock.acquire();
  await startPerception();
  scanner.start();
  // Development readout (no frame is grabbed for it). With ?debug=blur it also shows the blurred upload frame (ST-10).
  frameTimer = window.setInterval(() => {
    const v = source?.video;
    if (frameInfo) {
      frameInfo.textContent = v && v.videoWidth > 0
        ? `Video: ${v.videoWidth}×${v.videoHeight} (${source?.kind}) · voice: ${currentVoiceName()} · ${perfText} · ${scanReadout()}`
        : 'Waiting for frames…';
    }
    if (debugBlur && v && blurrer && blurDebug && blurInfo) {
      const f = blurrer.getUploadFrame(v);
      if (f) {
        blurDebug.hidden = false;
        blurDebug.width = f.canvas.width;
        blurDebug.height = f.canvas.height;
        blurDebug.getContext('2d')?.drawImage(f.canvas, 0, 0);
        blurInfo.textContent = `blur ${blurrer.delegate}: ${f.faces} face(s), ${f.heads} head area(s), ${f.ms.toFixed(0)} ms · upload ${f.canvas.width}×${f.canvas.height}`;
      } else {
        blurInfo.textContent = 'blur: no upload frame (fail closed)';
      }
    }
  }, 1000);
}

/** Dev readout for the scene scan: counts, last round trip, cost so far and per walking hour (REL-06). */
function scanReadout(): string {
  const s = scanner.stats;
  const hours = Math.max(1 / 60, (performance.now() - s.startedAt) / 3_600_000);
  return `scan ${s.ok}/${s.sent} ok · ${s.stale} stale · ${s.failed} failed · ${s.unchanged} unchanged · ${s.lastRoundTripMs} ms (prep ${s.lastPrepMs}, model ${s.lastServerMs}) · $${s.costUsd.toFixed(4)} ($${(s.costUsd / hours).toFixed(2)}/h)`;
}

/** R1.8: load the face-blur model in the background. If it fails, say so; uploads stay off (no raw frames, ever). */
async function loadBlurrer(): Promise<void> {
  try {
    blurrer ??= await FaceBlurrer.create();
  } catch (err) {
    console.error(err);
    blurrer = null;
    announce(MESSAGES.blurUnavailable);
  }
}

/** Q2: load the detector once (model is cached by the browser) and run the perception loop. Fail loud on errors. */
async function startPerception(): Promise<void> {
  if (!source) return;
  void loadBlurrer(); // in parallel; does not delay obstacle detection
  try {
    perfText = 'loading detector…';
    detector ??= await createDetector();
  } catch (err) {
    console.error(err);
    perfText = 'detector failed';
    announce(MESSAGES.detectorFailed);
    return;
  }
  if (!source) return; // stopped while loading
  loop = new PerceptionLoop(detector, source.video, {
    onCandidates: (candidates, tracks, frame, stats) => {
      drawOverlay(overlay, frame, tracks, candidates);
      output.update([...candidates, ...scanner.candidates()], frame.ts);
      // Head-area backstop for the face blur: people and riders as seen by the object detector.
      blurrer?.setPersons(tracks.filter((t) => t.type === 'person' || t.type === 'cyclist').map((t) => t.box), frame);
      const top = [...candidates].sort((a, b) => a.ttcSeconds - b.ttcSeconds)[0];
      perfText = `${stats.fps.toFixed(1)} fps · ${stats.inferenceMs.toFixed(0)} ms · ${detector?.delegate} · ${stats.tracks} tracked` +
        (top ? ` · top: ${top.type} ${top.tier}` : '');
    },
    onError: (err) => {
      console.error(err);
      perfText = 'detector error';
      announce(MESSAGES.detectorStopped);
    },
  });
  loop.start();
}

startBtn.addEventListener('click', () => {
  // Must run synchronously inside the tap, before any await (camera prompt), or mobile Chrome stays silent.
  if (!source) output.unlock();
  void (source ? stop() : start());
});

// ST-04: leaving the app or locking the screen stops protection — say so; say so again on return.
document.addEventListener('visibilitychange', () => {
  if (!source) return;
  if (document.hidden) {
    announce(MESSAGES.paused);
  } else {
    void wakeLock.reacquireIfNeeded();
    announce(MESSAGES.resumed);
  }
});
window.addEventListener('pagehide', () => {
  if (source) announce(MESSAGES.paused);
});
