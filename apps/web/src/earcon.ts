// Short non-speech cues (ADR-022/023): faster to perceive than words and don't mask traffic for long.
// Web Audio needs a user gesture before it can play: call unlockAudio() from the Start button.
import type { Earcon } from '@footprint/shared';

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null; // no Web Audio: speech and vibration still work
  }
}

/** [frequency Hz, duration ms, gap ms] per beep. */
const PATTERNS: Record<Exclude<Earcon, null>, [number, number, number][]> = {
  imminent: [[1100, 70, 40], [1100, 70, 40], [1100, 70, 0]],
  near: [[760, 110, 0]],
  system: [[440, 120, 60], [330, 160, 0]],
};

/** Plays the cue and returns its length in ms (so speech can start right after it). */
export function playEarcon(kind: Earcon): number {
  if (!kind || !ctx) return 0;
  let t = ctx.currentTime;
  let total = 0;
  for (const [freq, dur, gap] of PATTERNS[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur / 1000 + 0.02);
    t += (dur + gap) / 1000;
    total += dur + gap;
  }
  return total;
}
