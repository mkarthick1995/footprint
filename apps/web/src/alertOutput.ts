// The only speaking path (Q3, ADR-022): renders AlertManager decisions as earcon → speech, vibration, and an
// aria-live mirror. Everything that wants to say something goes through say() (system) or update() (hazards).
import {
  AlertManager,
  type AlertCandidate,
  type AlertPreset,
  type FilterResult,
  type ModelTextKind,
  type Utterance,
} from '@footprint/shared';
import { playEarcon, unlockAudio } from './earcon';
import { cancelSpeech, primeSpeech, speak } from './speech';

/** Speech that hasn't started this long after being requested is treated as a silent engine (fail loud). */
const START_TIMEOUT_MS = 4000; // generous: a network voice can take a few seconds to load the first time

export const VOICE_FAILED = 'Voice is not working. Tap Stop, then Start again.';

/** If the speech engine never reports "ended" (seen on some Android builds), free the output after this. */
function watchdogMs(text: string): number {
  return 1500 + text.length * 90;
}

export class AlertOutput {
  // Private on purpose (R1.7): model text must enter through sayModelText(), never through the manager directly.
  private readonly manager: AlertManager;
  private busy = false;
  private token = 0;
  private watchdog: number | undefined;
  private startTimer: number | undefined;
  private silentTimer: number | undefined;
  private voiceFailed = false;
  /** The utterance being spoken and how far it got (for resuming an interrupted answer). */
  private speaking: { text: string; kind?: string; chars: number } | null = null;

  constructor(
    private readonly mirror: HTMLElement,
    preset: AlertPreset = 'standard',
  ) {
    this.manager = new AlertManager({ preset });
  }

  /** Call synchronously from the Start tap: unlocks earcons and speech (mobile browsers need a gesture). */
  unlock(firstWords = 'Starting.'): void {
    unlockAudio();
    primeSpeech(firstWords);
    this.voiceFailed = false;
  }

  /**
   * System message (SYS): spoken next, interrupting anything below an active P0.
   * For our OWN fixed wording only (fail-loud announcements) — never pass model-derived text here; use sayModelText().
   */
  say(text: string): void {
    this.manager.system(text);
    this.pump();
  }

  /**
   * The single entry point for model-derived text (Gemini answers, scene descriptions — Q6, Q10). The safety filter is
   * always applied (all-clear / crossing / signal / identity / injection), the text is capped to P3 length and queued as
   * P3: spoken when no hazard is pending, interrupted by P0/P1, dropped if stale. Returns the filter result.
   */
  sayModelText(raw: unknown, opts: { kind?: ModelTextKind; ttlMs?: number } = {}): FilterResult {
    const result = this.manager.modelText(raw, performance.now(), opts);
    // Reasons only: the blocked text may describe a bystander (PRI-03), so it is never logged.
    if (result.blocked) console.warn(`model text filtered: ${result.reasons.join(', ')}`);
    this.pump();
    return result;
  }

  /** Alert level (Q14). P0 and SYS stay on in every preset. */
  setPreset(preset: AlertPreset): void {
    this.manager.setPreset(preset);
  }

  get preset(): AlertPreset {
    return this.manager.preset;
  }

  /** "Repeat": say the last spoken message again. */
  repeat(): boolean {
    const ok = this.manager.repeat();
    this.pump();
    return ok;
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
    if (u.interrupt) {
      // An answer cut by an imminent alert resumes afterwards from the sentence it was in (owner phone test).
      const cut = this.speaking;
      if (cut?.kind === 'answer') this.manager.resumeAnswer(cut.text, cut.chars, performance.now());
      cancelSpeech();
    }
    this.speaking = u.text ? { text: u.text, kind: u.kind, chars: 0 } : null;
    this.busy = true;
    if (u.text) this.mirror.textContent = u.text; // cue-only repeats keep the last words on screen
    if (u.vibrate && 'vibrate' in navigator) navigator.vibrate(u.vibrate);
    const done = () => {
      if (token !== this.token) return; // superseded by a newer message
      window.clearTimeout(this.watchdog);
      this.busy = false;
      this.speaking = null;
      this.manager.finished();
      this.pump();
    };
    const lead = playEarcon(u.earcon);
    this.startTimer = window.setTimeout(() => {
      if (token !== this.token) return;
      if (!u.text) return done();
      window.clearTimeout(this.silentTimer);
      this.silentTimer = window.setTimeout(() => this.reportSilentVoice(), START_TIMEOUT_MS);
      speak(u.text, {
        interrupt: false,
        onStart: () => {
          window.clearTimeout(this.silentTimer);
          this.voiceFailed = false; // recovered
        },
        onBoundary: (chars) => {
          if (token === this.token && this.speaking) this.speaking.chars = chars;
        },
        onDone: done,
      });
    }, lead);
    this.watchdog = window.setTimeout(done, lead + watchdogMs(u.text));
  }

  /** The speech engine accepted text but never started: say so on screen, with a tone and vibration (SAF-05). */
  private reportSilentVoice(): void {
    if (this.voiceFailed) return;
    this.voiceFailed = true;
    this.mirror.textContent = VOICE_FAILED;
    playEarcon('system');
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
  }
}
