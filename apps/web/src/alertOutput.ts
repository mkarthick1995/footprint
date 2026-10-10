// The only speaking path (Q3, ADR-022): renders AlertManager decisions as earcon → speech, vibration, and an
// aria-live mirror. Everything that wants to say something goes through say() (system) or update() (hazards).
import { AlertManager, type AlertCandidate, type AlertPreset, type Utterance } from '@footprint/shared';
import { playEarcon, unlockAudio } from './earcon';
import { cancelSpeech, speak } from './speech';

/** If the speech engine never reports "ended" (seen on some Android builds), free the output after this. */
function watchdogMs(text: string): number {
  return 1500 + text.length * 90;
}

export class AlertOutput {
  readonly manager: AlertManager;
  private busy = false;
  private token = 0;
  private watchdog: number | undefined;
  private startTimer: number | undefined;

  constructor(
    private readonly mirror: HTMLElement,
    preset: AlertPreset = 'standard',
  ) {
    this.manager = new AlertManager({ preset });
  }

  /** Call from a user gesture (Start button) so earcons can play. */
  unlock(): void {
    unlockAudio();
  }

  /** System message (SYS): spoken next, interrupting anything below an active P0. */
  say(text: string): void {
    this.manager.system(text);
    this.pump();
  }

  /** Latest frame's hazard candidates. */
  update(candidates: readonly AlertCandidate[], now = performance.now()): void {
    this.manager.update(candidates);
    this.pump(now);
  }

  /** Walk stopped: forget hazard state (queued system messages still play). */
  reset(): void {
    this.manager.reset();
  }

  pump(now = performance.now()): void {
    const u = this.manager.next(now, this.busy);
    if (u) this.render(u);
  }

  private render(u: Utterance): void {
    const token = ++this.token;
    window.clearTimeout(this.watchdog);
    window.clearTimeout(this.startTimer);
    if (u.interrupt) cancelSpeech();
    this.busy = true;
    if (u.text) this.mirror.textContent = u.text; // cue-only repeats keep the last words on screen
    if (u.vibrate && 'vibrate' in navigator) navigator.vibrate(u.vibrate);
    const done = () => {
      if (token !== this.token) return; // superseded by a newer message
      window.clearTimeout(this.watchdog);
      this.busy = false;
      this.manager.finished();
      this.pump();
    };
    const lead = playEarcon(u.earcon);
    this.startTimer = window.setTimeout(() => {
      if (token !== this.token) return;
      if (u.text) speak(u.text, { interrupt: false, onDone: done });
      else done();
    }, lead);
    this.watchdog = window.setTimeout(done, lead + watchdogMs(u.text));
  }
}
