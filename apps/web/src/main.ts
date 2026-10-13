// Entry point. Detector (Q2) → candidates → alert output (Q3), the only speaking path.
import { AlertOutput } from './alertOutput';
import { CommunityClient } from './community';
import { createDetector, type OnDeviceDetector } from './detector';
import { FaceBlurrer } from './faceBlur';
import { HealthMonitor } from './health';
import { LiveAsk } from './liveAsk';
import { MediaButtons } from './mediaButtons';
import { loadPreset, PRESET_SPOKEN, savePreset, stepPreset } from './presets';
import {
  commonAlertPhrases,
  ladderMessage,
  parseModelCommand,
  parseRouteRequest,
  parseVoiceCommand,
  type AlertPreset,
  type PublicHazard,
} from '@footprint/shared';
import { prefetchClips } from './voice';
import { ASK_MESSAGES } from './liveAsk';
import { playEarcon } from './earcon';
import { openCamera, openClip, type FrameSource } from './frameSource';
import { drawOverlay } from './overlay';
import { PerceptionLoop } from './perception';
import { SceneScanner, type ScanStatus } from './sceneScan';
import { cameraErrorMessage, MESSAGES } from './messages';
import { currentVoiceName } from './speech';
import { ScreenWakeLock } from './wakeLock';

const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const askBtn = document.querySelector<HTMLButtonElement>('#ask')!;
const askControls = document.querySelector<HTMLDivElement>('#ask-controls')!;
const askLabel = askBtn.querySelector<HTMLSpanElement>('.ask-label') ?? askBtn;
const presetBox = document.querySelector<HTMLFieldSetElement>('#preset')!;
const controlsBox = document.querySelector<HTMLDivElement>('#controls')!;
const levelBadge = document.querySelector<HTMLSpanElement>('#level-badge');
const describeBtn = document.querySelector<HTMLButtonElement>('#describe')!;
const repeatBtn = document.querySelector<HTMLButtonElement>('#repeat')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const video = document.querySelector<HTMLVideoElement>('#preview')!;
const clipInput = document.querySelector<HTMLInputElement>('#clip-file')!;
const frameInfo = document.querySelector<HTMLParagraphElement>('#frame-info');
const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!;
/** The on-screen camera view. It shows the blurred upload frame only; the raw `<video>` stays invisible (ST-10). */
const blurView = document.querySelector<HTMLCanvasElement>('#blur-view')!;
const blurInfo = document.querySelector<HTMLParagraphElement>('#blur-info');
/**
 * How often the on-screen view is refreshed. Each refresh is a full face-detection + blur pass (frame + 4 tiles) on the
 * same thread as the obstacle detector. Owner review (CPU throttled 4× ≈ mid-range phone): every 200 ms cost the
 * detector ~1–2 fps (≈ 10 %); every 500 ms was within noise. The detector is the safety layer, so it wins.
 */
const PREVIEW_INTERVAL_MS = 500;

let source: FrameSource | null = null;
let frameTimer: number | undefined;
let previewTimer: number | undefined;
let detector: OnDeviceDetector | null = null;
let loop: PerceptionLoop | null = null;
let perfText = '';
/** Face blur (R1.8). Null until loaded, or when it failed — then nothing may be uploaded (fail closed). */
let blurrer: FaceBlurrer | null = null;

const output = new AlertOutput(statusEl, loadPreset());

/** Q11 lite: walking route → hazards reported along it → spoken summary (no turn-by-turn, ADR-027). */
let routeSession = '';
async function checkRoute(destinationRaw: string): Promise<void> {
  const destination = destinationRaw.trim();
  if (destination.length < 2) return announce(MESSAGES.routeNeedsDestination);
  const origin = community.currentFix();
  if (!origin) return announce(MESSAGES.routeNeedsLocation);
  routeSession ||= crypto.randomUUID();
  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': routeSession },
      body: JSON.stringify({ destination, origin }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 422) return announce(MESSAGES.routeTooFar);
    if (res.status === 404) return announce(MESSAGES.routeNotFound);
    if (!res.ok) return announce(MESSAGES.routeUnavailable);
    const body = (await res.json()) as { summary: string; hazards: PublicHazard[] };
    community.addHazards(body.hazards); // announced as "reported ahead" when the walker gets near
    announce(body.summary); // fixed server template; the destination echo is cleaned server-side
  } catch {
    announce(MESSAGES.routeUnavailable);
  }
}

// DEVIATION(ADR-040): walking / not-walking layout for the redesigned page (owner request 2026-10-14, R4.8).
/**
 * Walking vs. not (ADR-040): the page shows the camera view and the walking controls on top; the alert level moves
 * below Ask so the screen-reader order matches what is on screen.
 */
function setWalking(on: boolean): void {
  document.body.dataset.walking = String(on);
  if (on) askControls.after(presetBox);
  else controlsBox.prepend(presetBox);
  window.scrollTo({ top: 0 });
}

/** Q14: alert level — chosen on screen or by voice ("fewer alerts" / "more alerts"), remembered on this phone. */
function applyPreset(p: AlertPreset, speakIt: boolean): void {
  output.setPreset(p);
  savePreset(p);
  const radio = document.querySelector<HTMLInputElement>(`input[name="preset"][value="${p}"]`);
  if (radio) radio.checked = true;
  if (levelBadge) levelBadge.textContent = p[0]!.toUpperCase() + p.slice(1);
  if (speakIt) announce(PRESET_SPOKEN[p]);
}
applyPreset(output.preset, false);
document.querySelectorAll<HTMLInputElement>('input[name="preset"]').forEach((r) =>
  r.addEventListener('change', () => applyPreset(r.value as AlertPreset, source !== null)),
);

/** Q6: Gemini scene scan — static ground hazards (potholes, drains, kerbs, footpath, crossings). */
const SCAN_MESSAGES: Record<ScanStatus, string> = {
  down: MESSAGES.scanDown,
  up: MESSAGES.scanUp,
  capped: MESSAGES.scanCapped,
};
/** Q10: ask Gemini Live about the view — blurred frame + voice; the text answer goes through the safety filter. */
const ask = new LiveAsk({
  frame: async () => (blurrer && source ? (await blurrer.getUploadJpeg(source.video))?.blob ?? null : null),
  onAnswer: (text, question, spoken) => {
    // "Fewer alerts" / "more alerts" / "what level?" / "route to …" are commands to the app, not questions for Gemini.
    // Gemini answers them with a fixed "Command: …" reply (ADR-037); the user's own words are the fallback. Only a
    // spoken question can be a command — never "What's around me" (a sign in the photo can't change settings).
    const model = spoken ? parseModelCommand(text) : null;
    const destination = model?.kind === 'route' ? model.destination : spoken ? parseRouteRequest(question) : null;
    if (destination) return void checkRoute(destination);
    const cmd = model && model.kind !== 'route' && model.kind !== 'unclear' ? model.kind : spoken ? parseVoiceCommand(question) : null;
    if (cmd === 'level') return announce(PRESET_SPOKEN[output.preset]);
    if (cmd) return applyPreset(stepPreset(output.preset, cmd), true);
    if (model || /^command\b/i.test(text.trim())) return announce(MESSAGES.commandUnclear); // never read "Command: …" aloud
    output.sayModelText(text, { kind: 'answer' });
  },
  onProblem: announce,
  onState: (s) => {
    askBtn.setAttribute('aria-pressed', String(s === 'listening' || s === 'starting'));
    askBtn.dataset.state = s;
    askLabel.textContent =
      s === 'starting' ? 'Starting microphone…' : s === 'listening' ? 'Listening… tap to send now' : s === 'thinking' ? 'Thinking…' : 'Ask a question';
    if (s === 'starting' && 'vibrate' in navigator) navigator.vibrate(30); // instant: got your tap
    if (s === 'listening') playEarcon('near'); // a tone, not words — speech would be picked up by the microphone
    if (s === 'thinking') playEarcon('system');
  },
});
askBtn.addEventListener('click', () => void ask.toggle());
describeBtn.addEventListener('click', () => void ask.describe());
document.querySelector<HTMLFormElement>('#route-form')!.addEventListener('submit', (e) => {
  e.preventDefault();
  void checkRoute(document.querySelector<HTMLInputElement>('#destination')!.value);
});
repeatBtn.addEventListener('click', () => {
  if (!output.repeat()) announce(MESSAGES.nothingToRepeat);
});
/** The earbud tip is said on the first walk only (fewer words at every later Start). */
function seenEarbudHelp(): boolean {
  try {
    if (localStorage.getItem('footprint.earbudHelp')) return true;
    localStorage.setItem('footprint.earbudHelp', '1');
  } catch {
    /* storage blocked: say it each time */
  }
  return false;
}
/** Earbud button: 1 press ask · 2 describe · 3 repeat (most used = fewest presses). */
const mediaButtons = new MediaButtons();

/** Q9: fail-loud monitor — camera quality, angle, detector heartbeat, scan, battery, heat, location (ladder L0–L3). */
let detectorBeat = 0;
let detectorFps = 0;
const health = new HealthMonitor({
  video,
  detectorBeat: () => detectorBeat,
  detectorFps: () => detectorFps,
  sceneOk: () => scanner.healthy,
  gpsAge: () => community.gpsAge(),
  announce,
});

/** Q7: community hazard map — scan findings shared anonymously; confirmed reports spoken as "reported". */
const community = new CommunityClient({ onLocationOff: () => announce(MESSAGES.locationOff), onNoFix: () => announce(MESSAGES.noLocationYet) });
const scanner = new SceneScanner({
  video,
  blurrer: () => blurrer,
  // Scan down/back is part of the degradation ladder (L1, announced by the health monitor); only the cap is said here.
  onStatus: (status) => { if (status === 'capped') announce(SCAN_MESSAGES[status]); },
  onContext: (text) => output.sayModelText(text, { kind: 'context' }),
  onScan: (result) => community.onScan(result),
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
  window.clearInterval(previewTimer);
  loop?.stop();
  loop = null;
  scanner.stop();
  community.stop();
  routeSession = '';
  health.stop();
  ask.stop();
  mediaButtons.disarm();
  askControls.hidden = true;
  setWalking(false);
  detectorBeat = 0;
  blurrer?.clearPersons();
  output.reset();
  overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
  source?.stop();
  source = null;
  await wakeLock.release();
  startBtn.textContent = 'Start walking';
  if (frameInfo) frameInfo.textContent = '';
  if (blurInfo) blurInfo.textContent = '';
  hidePreview();
  announce(message);
}

/**
 * Natural voice (ADR-041): fetch the phrases most likely needed, most urgent first, as soon as the walk starts — so
 * "Stop!" and fail-loud warnings play without a network wait. Runs in the background; misses fall back to the
 * device voice.
 */
function prefetchVoice(): void {
  const ladder = (['covered', 'dark', 'ground', 'sky'] as const).map((r) => ladderMessage({ level: 'L2', reasons: [r] }, 'L0'));
  ladder.push(
    ladderMessage({ level: 'L3', reasons: ['detector'] }, 'L0'),
    ladderMessage({ level: 'L1', reasons: ['scene'] }, 'L0'),
    ladderMessage({ level: 'L0', reasons: [] }, 'L2'),
  );
  const strings = (o: Record<string, unknown>) => Object.values(o).filter((v): v is string => typeof v === 'string' && v.length <= 300);
  void prefetchClips([
    MESSAGES.started,
    PRESET_SPOKEN[output.preset],
    ...commonAlertPhrases().filter((p) => p.startsWith('Stop!')),
    ...ladder,
    ...strings(MESSAGES),
    ...commonAlertPhrases(),
    ...strings(ASK_MESSAGES),
  ]);
}

async function start(): Promise<void> {
  prefetchVoice();
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
  startBtn.textContent = 'Stop walking';
  setWalking(true);
  announce(MESSAGES.started);
  await wakeLock.acquire();
  await startPerception();
  scanner.start();
  if (source?.kind === 'camera') community.start(); // recorded clips have no location
  ask.warm();
  health.start();
  askControls.hidden = false;
  announce(PRESET_SPOKEN[output.preset]); // ADR-026: current level said at walk start
  if (MediaButtons.supported && !seenEarbudHelp()) announce(MESSAGES.earbudHelp); // first walk on this phone only
  // Development readout (no frame is grabbed for it).
  previewTimer = window.setInterval(drawPreview, PREVIEW_INTERVAL_MS);
  frameTimer = window.setInterval(() => {
    const v = source?.video;
    if (frameInfo) {
      frameInfo.textContent = v && v.videoWidth > 0
        ? `Video: ${v.videoWidth}×${v.videoHeight} (${source?.kind}) · voice: ${currentVoiceName()} · ${perfText} · ${scanReadout()}`
        : 'Waiting for frames…';
    }
  }, 1000);
}

function hidePreview(): void {
  blurView.hidden = true;
  blurView.width = 1; // resizing clears the canvas, so no frame lingers
  blurView.height = 1;
}

/**
 * The picture on screen is the blurred upload frame, never the raw camera image (ST-10): what a viewer, a screen
 * recording or a demo video sees is what Gemini would get. Fail closed — until the blur model is loaded, or when a
 * pass fails, nothing is shown rather than the raw video.
 */
function drawPreview(): void {
  if (document.hidden) return; // nobody can see it; don't spend detector time
  const v = source?.video;
  if (!v || v.videoWidth === 0 || !blurrer) {
    hidePreview();
    if (blurInfo) blurInfo.textContent = source ? 'View hidden until face blur is ready.' : '';
    return;
  }
  const f = blurrer.getUploadFrame(v);
  if (!f) {
    hidePreview();
    if (blurInfo) blurInfo.textContent = 'View hidden: blur failed (fail closed).';
    return;
  }
  blurView.hidden = false;
  if (blurView.width !== f.canvas.width || blurView.height !== f.canvas.height) {
    blurView.width = f.canvas.width;
    blurView.height = f.canvas.height;
  }
  blurView.getContext('2d')?.drawImage(f.canvas, 0, 0);
  if (blurInfo) {
    blurInfo.textContent = `blur ${blurrer.delegate}: ${f.faces} face(s), ${f.heads} head area(s), ${f.ms.toFixed(0)} ms · view ${f.canvas.width}×${f.canvas.height}`;
  }
}

/** Dev readout for the scene scan: counts, last round trip, cost so far and per walking hour (REL-06). */
function scanReadout(): string {
  const s = scanner.stats;
  const hours = Math.max(1 / 60, (performance.now() - s.startedAt) / 3_600_000);
  const c = community.stats;
  return `map ${c.sent}/${c.queued} sent · ${c.notSeen} not-seen · ${c.hazardsNearby} reported nearby · scan ${s.ok}/${s.sent} ok · ${s.stale} stale · ${s.failed} failed · ${s.unchanged} unchanged · ${s.lastRoundTripMs} ms (prep ${s.lastPrepMs}, model ${s.lastServerMs}) · $${s.costUsd.toFixed(4)} ($${(s.costUsd / hours).toFixed(2)}/h)`;
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
      detectorBeat = performance.now();
      detectorFps = stats.fps;
      // L2/L3: the camera image can't be trusted — alerts derived from it are withheld (SAFETY §2); map reports remain.
      const cameraTrusted = health.level === 'L0' || health.level === 'L1';
      output.update(cameraTrusted ? [...candidates, ...scanner.candidates(), ...community.candidates()] : community.candidates(), frame.ts);
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
  if (!source) {
    output.unlock();
    HealthMonitor.requestMotionPermission(); // iOS: motion sensors need the tap too
    const kind = document.querySelector<HTMLInputElement>('input[name="source"]:checked')?.value;
    if (kind !== 'clip') CommunityClient.requestPermission(); // location prompt inside the tap (some browsers need it)
    mediaButtons.arm({ ask: () => void ask.toggle(), describe: () => void ask.describe(), repeat: () => repeatBtn.click() });
  }
  void (source ? stop() : start());
});

// ST-04: leaving the app or locking the screen stops protection — say so; say so again on return.
document.addEventListener('visibilitychange', () => {
  if (!source) return;
  if (document.hidden) {
    announce(MESSAGES.paused);
  } else {
    void wakeLock.reacquireIfNeeded();
    health.resume();
    announce(MESSAGES.resumed);
  }
});
window.addEventListener('pagehide', () => {
  if (source) announce(MESSAGES.paused);
});
