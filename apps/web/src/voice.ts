// Natural voice (R3.4, ADR-041): Google Chirp 3 HD ("Aoede") audio for the words the alert manager already chose —
// fixed phrases and safety-filtered answers — played through Web Audio. Common phrases are fetched once at walk start,
// so urgent alerts play with no network wait; anything else is fetched on demand and, if it is late or the network is
// down, the on-device voice speaks instead (an alert is never silent). Gemini Live's own audio is still never played.
import { audioContext } from './earcon';

export interface PlayCallbacks {
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onDone?: () => void;
}

const buffers = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer | null>>();
const session = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `v-${Date.now()}`).slice(0, 64);
let lang = 'en-IN';
let failures = 0;
/** After repeated failures the natural voice rests for a while (no waiting on a dead network for every alert). */
let downUntil = 0;
let playing: { src: AudioBufferSourceNode; timer: number } | null = null;
/** Bumped on each new prefetch: an older one (e.g. the previous language's) stops taking requests. */
let prefetchRun = 0;
/** Rate-limited by the server: background fetching pauses until then (on-demand phrases still try). */
let backoffUntil = 0;

/** Default language of new clips (R3.2). Clips are cached per language, so switching back is instant. */
export function setVoiceLanguage(code: string): void {
  lang = code;
}

export function naturalVoiceReady(): boolean {
  return audioContext() !== null && performance.now() >= downUntil;
}

export function cachedClip(text: string, language = lang): AudioBuffer | null {
  return buffers.get(key(text, language)) ?? null;
}

function key(text: string, language: string): string {
  return `${language}|${text.replace(/\s+/g, ' ').trim()}`;
}

/** Fetch + decode one phrase (shared by concurrent callers). Null on any failure. */
export function loadClip(text: string, language = lang, background = false): Promise<AudioBuffer | null> {
  const k = key(text, language);
  const hit = buffers.get(k);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(k);
  if (pending) return pending;
  const ctx = audioContext();
  if (!ctx || performance.now() < downUntil) return Promise.resolve(null);
  const p = (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-id': session },
        body: JSON.stringify({ text, lang: language }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        // Too many requests is not "voice down": pause background fetching, keep the natural voice.
        backoffUntil = performance.now() + 20_000;
        return null;
      }
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(k, buf);
      failures = 0;
      return buf;
    } catch {
      // Only phrases being spoken now count towards "voice down"; a failed background fetch just stays uncached.
      if (!background && ++failures >= 3) downUntil = performance.now() + 60_000;
      return null;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

/** Fetch phrases in the background, a few at a time (walk start). */
export async function prefetchClips(texts: readonly string[], concurrency = 4, language = lang): Promise<number> {
  const run = ++prefetchRun;
  const queue = [...new Set(texts)].filter((t) => !buffers.has(key(t, language)));
  let ok = 0;
  const worker = async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
      if (run !== prefetchRun) return; // superseded (language switched)
      if (performance.now() < backoffUntil) {
        await new Promise((r) => setTimeout(r, backoffUntil - performance.now()));
        if (run !== prefetchRun) return;
      }
      if (await loadClip(t, language, true)) ok++;
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return ok;
}

/** Play a decoded clip now (stops any clip already playing). Progress is estimated from playback time. */
export function playClip(buf: AudioBuffer, text: string, cb: PlayCallbacks = {}): void {
  const ctx = audioContext();
  if (!ctx) return cb.onDone?.();
  stopClip();
  if (ctx.state === 'suspended') void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  const t0 = ctx.currentTime;
  const timer = window.setInterval(() => {
    const frac = Math.min(1, (ctx.currentTime - t0) / buf.duration);
    cb.onBoundary?.(Math.round(frac * text.length));
  }, 150);
  src.onended = () => {
    window.clearInterval(timer);
    if (playing?.src === src) playing = null;
    cb.onDone?.();
  };
  playing = { src, timer };
  src.start();
  cb.onStart?.();
}

export function stopClip(): void {
  if (!playing) return;
  const { src, timer } = playing;
  playing = null;
  window.clearInterval(timer);
  src.onended = null; // a cut clip doesn't report "done" (the caller has moved on)
  try {
    src.stop();
  } catch {
    /* already stopped */
  }
}

export function voiceLanguage(): string {
  return lang;
}
