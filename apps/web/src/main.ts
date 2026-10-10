// Thin-slice entry point (ADR-028). Detector, alert manager, and Gemini wiring land in R1.2–R1.4.
import { tierAllowed } from '@footprint/shared';
import { openCamera, openClip, type FrameSource } from './frameSource';

const startBtn = document.querySelector<HTMLButtonElement>('#start')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const video = document.querySelector<HTMLVideoElement>('#preview')!;
const clipInput = document.querySelector<HTMLInputElement>('#clip-file')!;

let source: FrameSource | null = null;

/** Mirror of every spoken message (SAFETY.md: fail loud). Speech itself moves into the alert manager in R1.3. */
function announce(text: string): void {
  statusEl.textContent = text;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

document.querySelectorAll<HTMLInputElement>('input[name="source"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    clipInput.hidden = radio.value !== 'clip' || !radio.checked;
  }),
);

startBtn.addEventListener('click', async () => {
  if (source) {
    source.stop();
    source = null;
    startBtn.textContent = 'Start walking';
    announce('Footprint stopped. You are not protected.');
    return;
  }
  try {
    const kind = document.querySelector<HTMLInputElement>('input[name="source"]:checked')?.value;
    if (kind === 'clip') {
      const file = clipInput.files?.[0];
      if (!file) {
        announce('Choose a recorded clip first.');
        return;
      }
      source = await openClip(video, file);
    } else {
      source = await openCamera(video);
    }
    startBtn.textContent = 'Stop';
    // Sanity check that the shared package is wired; the real preset comes from settings (ADR-026).
    announce(tierAllowed('P0', 'essential') ? 'Footprint started. Obstacle alerts are not built yet.' : 'Error.');
  } catch (err) {
    console.error(err);
    announce('Camera could not start. Footprint is not running.');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && source) announce('Footprint paused. You are not protected.');
});
