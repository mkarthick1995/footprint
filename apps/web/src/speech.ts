// On-device speech (ADR-033): free, instant, offline. Picks the most natural installed voice instead of the
// browser default. Natural Google voice (pre-rendered + Gemini-TTS) replaces this before submission (R3.4).

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

/** Speak now, interrupting anything already speaking. The alert manager (Q3) adds queueing and priorities. */
export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (chosen) {
    u.voice = chosen;
    u.lang = chosen.lang;
  }
  u.rate = 1.0; // natural pace; user-adjustable rate comes with presets (Q14, ACC-03)
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

/** For the dev readout: which voice is in use. */
export function currentVoiceName(): string {
  return chosen ? `${chosen.name} (${chosen.lang})` : 'browser default';
}
