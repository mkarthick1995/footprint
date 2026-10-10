// Entry point. Detector (Q2) and alert manager (Q3) plug in here; until Q3, announce() is the only speaking path.
import { grabFrame, openCamera, openClip, type FrameSource } from './frameSource';
import { cameraErrorMessage, MESSAGES } from './messages';
import { currentVoiceName, speak } from './speech';
import { ScreenWakeLock } from './wakeLock';

const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const video = document.querySelector<HTMLVideoElement>('#preview')!;
const clipInput = document.querySelector<HTMLInputElement>('#clip-file')!;
const frameInfo = document.querySelector<HTMLParagraphElement>('#frame-info');

let source: FrameSource | null = null;
let frameTimer: number | undefined;

/** Mirror of every spoken message (SAFETY.md: fail loud). Moves into the alert manager in Q3. */
function announce(text: string): void {
  statusEl.textContent = text;
  speak(text);
}

const wakeLock = new ScreenWakeLock(announce);

document.querySelectorAll<HTMLInputElement>('input[name="source"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    clipInput.hidden = radio.value !== 'clip' || !radio.checked;
  }),
);

async function stop(message: string = MESSAGES.stopped): Promise<void> {
  window.clearInterval(frameTimer);
  source?.stop();
  source = null;
  await wakeLock.release();
  startBtn.textContent = 'Start walking';
  if (frameInfo) frameInfo.textContent = '';
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
  // Development readout proving frames flow at the size later steps use (Q2 detector / Q6 scan).
  const canvas = document.createElement('canvas');
  frameTimer = window.setInterval(() => {
    const frame = source ? grabFrame(source.video, 640, canvas) : null;
    if (frameInfo) frameInfo.textContent = frame ? `Frames: ${frame.width}×${frame.height} (${source?.kind}) · voice: ${currentVoiceName()}` : 'Waiting for frames…';
  }, 1000);
}

startBtn.addEventListener('click', () => void (source ? stop() : start()));

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
