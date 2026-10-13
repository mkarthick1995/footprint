// The only speaking path (Q3, ADR-022): renders AlertManager decisions as earcon → speech, vibration, and an
// aria-live mirror. Everything that wants to say something goes through say() (system) or update() (hazards).
import {
  AlertManager,
  phraseText,
  translate,
  type LangCode,
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

/**
 * Longest wait for the natural voice when a phrase isn't pre-fetched (ADR-041): urgent alerts barely wait — the device
 * voice speaks instead — while answers can wait for the nicer voice.
 */
const NATURAL_WAIT_MS: Record<string, number> = { P0: 250, P1: 400, P2: 700, SYS: 1200, P3: 2500 };

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
  /** Spoken language (R3.2): alerts and system messages are localized at the last step, here. */
  private lang: LangCode = 'en-IN';
  /** Recently produced localized texts (a repeat or resume of one is already in the user's language). */
  private localized = new Set<string>();
  private lastSaid = '';
  /** The utterance being spoken and how far it got (for resuming an interrupted answer). */
  private speaking: { text: string; kind?: string; tier: string; chars: number } | null = null;

  constructor(
    private readonly mirror: HTMLElement,
    preset: AlertPreset = 'standard',
  ) {
    this.manager = new AlertManager({ preset });
  }

  setLanguage(lang: LangCode): void {
    this.lang = lang;
  }

  /**
   * What to actually say for `u`, in which language: hazard alerts from their parts, system messages translated,
   * model answers as they are (already in the user's language). No translation → the English text in the English voice.
   */
  private localize(u: Utterance): { text: string; lang: LangCode } {
    if (!u.text) return { text: '', lang: this.lang };
    if (this.lang === 'en-IN' || u.kind === 'answer' || u.kind === 'context' || this.localized.has(u.text)) {
      return { text: u.text, lang: this.lang };
    }
    const local = u.phrase ? phraseText(u.phrase, this.lang) : translate(u.text, this.lang);
    if (!local) return { text: u.text, lang: 'en-IN' };
    if (this.localized.size > 200) this.localized.clear();
    this.localized.add(local);
    return { text: local, lang: this.lang };
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
    // The last words as actually said (localized), not the manager's English original.
    if (!this.lastSaid) return false;
    this.localized.add(this.lastSaid);
    this.manager.system(this.lastSaid);
    this.pump();
    return true;
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
      // A system message (e.g. the start disclaimer) cut by "Stop!": the rest is said once afterwards, not from the top.
      if (cut?.tier === 'SYS') this.manager.resumeSystem(cut.text, cut.chars);
      cancelSpeech();
    }
    const said = this.localize(u);
    this.speaking = said.text ? { text: said.text, kind: u.kind, tier: u.tier, chars: 0 } : null;
    this.busy = true;
    if (said.text) {
      this.mirror.textContent = said.text; // cue-only repeats keep the last words on screen
      this.lastSaid = said.text;
    }
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
      if (!said.text) return done();
      window.clearTimeout(this.silentTimer);
      this.silentTimer = window.setTimeout(() => this.reportSilentVoice(), START_TIMEOUT_MS);
      speak(said.text, {
        lang: said.lang,
        englishFallback: u.text,
        interrupt: false,
        naturalWaitMs: NATURAL_WAIT_MS[u.tier] ?? 0,
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
    this.watchdog = window.setTimeout(done, lead + (NATURAL_WAIT_MS[u.tier] ?? 0) + watchdogMs(said.text));
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
