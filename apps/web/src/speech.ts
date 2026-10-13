// Speech output (ADR-033, ADR-041): the natural Google voice (voice.ts) when its clip is ready in time, otherwise the
// most natural installed on-device voice — free, instant and offline, so nothing is ever left unsaid.
import { cachedClip, loadClip, naturalVoiceReady, playClip, stopClip } from './voice';

export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

const NATURAL = /(google|natural|neural|enhanced|premium|wavenet|siri)/i;

/**
 * Score voices: same language as the user (e.g. en-IN) > any English; natural-sounding engines first;
 * on-device voices preferred (work offline, no network delay). Returns the index of the best voice, or -1.
 */
export function pickVoiceIndex(voices: readonly VoiceInfo[], userLang = 'en-US'): number {
  let best = -1;
  let bestScore = -Infinity;
  const userBase = userLang.toLowerCase().split('-')[0];
  voices.forEach((v, i) => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    if (!lang.startsWith('en')) return; // English-first prototype (SAFETY §4)
    let score = 0;
    if (lang === userLang.toLowerCase()) score += 4;
    else if (userBase === 'en') score += 1;
    if (NATURAL.test(v.name)) score += 3;
    if (v.localService) score += 2;
    if (v.default) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

let chosen: SpeechSynthesisVoice | null = null;

function choose(): void {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const i = pickVoiceIndex(voices, navigator.language || 'en-US');
  chosen = i >= 0 ? voices[i] ?? null : null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  choose();
  // Voices load asynchronously on most browsers.
  window.speechSynthesis.addEventListener('voiceschanged', choose);
}

export interface SpeakOptions {
  /** Cut off whatever is being spoken (default true). */
  interrupt?: boolean;
  /** Called once when the utterance ends, errors, or is cancelled. */
  onDone?: () => void;
  /** Called when audio actually starts (lets the caller detect a silent speech engine). */
  onStart?: () => void;
  /** Word-boundary progress (character index), so an interrupted answer can resume from the right sentence. */
  onBoundary?: (charIndex: number) => void;
  /**
   * How long to wait for the natural voice when its clip isn't cached yet, before the on-device voice speaks
   * instead (urgent alerts: short; answers: longer). 0 = device voice unless cached.
   */
  naturalWaitMs?: number;
  /** Language of `text` (BCP-47, e.g. ta-IN). Default English. */
  lang?: string;
  /**
   * The English original, spoken instead when neither the natural voice nor an on-device voice for `lang` is
   * available — an English alert beats an unreadable one (R3.2).
   */
  englishFallback?: string;
}

/** Bumped by every speak() / cancelSpeech(): a natural clip that arrives late for a superseded message is dropped. */
let generation = 0;

/**
 * Call synchronously inside the Start tap. Mobile Chrome only lets a page speak after it has spoken within a user
 * gesture; our first real message comes after the camera permission prompt, which was silent on first use (Q3 test).
 */
export function primeSpeech(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const u = new SpeechSynthesisUtterance(text);
  if (chosen) {
    u.voice = chosen;
    u.lang = chosen.lang;
  }
  window.speechSynthesis.speak(u);
}

/** Speak `text`. Only the alert output (alertOutput.ts) should call this. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const gen = ++generation;
  if (opts.interrupt ?? true) cancelDevice();
  stopClip();
  const lang = opts.lang ?? 'en-IN';
  if (!naturalVoiceReady()) return deviceSpeak(text, opts);
  const cached = cachedClip(text, lang);
  if (cached) return playClip(cached, text, opts);
  let settled = false;
  const fallback = window.setTimeout(() => {
    if (settled || gen !== generation) return;
    settled = true;
    deviceSpeak(text, opts); // late network: never leave an alert unsaid
  }, opts.naturalWaitMs ?? 0);
  void loadClip(text, lang).then((buf) => {
    if (settled || gen !== generation) return; // superseded, or the device voice already took it (clip is cached now)
    settled = true;
    window.clearTimeout(fallback);
    if (buf) playClip(buf, text, opts);
    else deviceSpeak(text, opts);
  });
}

function cancelDevice(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** The on-device voice. */
function deviceSpeak(textIn: string, opts: SpeakOptions): void {
  const { interrupt = true, onDone, onStart, onBoundary } = opts;
  const want = (opts.lang ?? 'en-IN').toLowerCase();
  const native = want.startsWith('en') ? null : voiceFor(want);
  // No on-device voice for this language: say the English original rather than mispronounced text.
  const text = native || want.startsWith('en') || !opts.englishFallback ? textIn : opts.englishFallback;
  const voice = native ?? chosen;
  if (!('speechSynthesis' in window)) {
    onDone?.();
    return;
  }
  if (interrupt) window.speechSynthesis.cancel();
  window.speechSynthesis.resume(); // Chrome can leave the queue paused after backgrounding
  const u = new SpeechSynthesisUtterance(text);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  u.rate = 1.0; // natural pace; user-adjustable rate comes with presets (Q14, ACC-03)
  u.pitch = 1.0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone?.();
  };
  u.onstart = () => onStart?.();
  u.onboundary = (e) => onBoundary?.(e.charIndex);
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
}

/** An installed voice for a language (e.g. "ta-in" → a Tamil voice), or null. */
function voiceFor(lang: string): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const base = lang.split('-')[0]!;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}

/** Stop any speech now (natural clip and device voice). */
export function cancelSpeech(): void {
  generation++;
  stopClip();
  cancelDevice();
}

/** For the dev readout: which voice is in use. */
export function currentVoiceName(): string {
  if (naturalVoiceReady()) return 'Google Chirp 3 HD Aoede (natural)';
  return chosen ? `${chosen.name} (${chosen.lang})` : 'browser default';
}
