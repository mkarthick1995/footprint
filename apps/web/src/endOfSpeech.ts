// End-of-speech detection for one-tap questions (owner phone test 2026-10-13: a second "send" tap is not usable for a
// blind person). Pure: fed the loudness (RMS) of each audio block. Learns the background noise for the first moments,
// treats clearly louder audio as speech, and ends the question after a pause. Tuned for street noise; the 10 s cap and
// the Ask button (tap again = send now) remain as fallbacks.

export type SpeechState = 'waiting' | 'speaking' | 'done' | 'no_speech';

export const EOS = {
  /** Background noise is learned during this first part (the user usually starts a moment after the tone). */
  calibrateMs: 300,
  /** Speech = louder than noise × this, and above an absolute floor. */
  ratio: 2.5,
  floor: 0.015,
  /** Loud audio must last this long to count as speech (ignores clicks, a passing horn blip). */
  minSpeechMs: 200,
  /** Quiet this long after speech → the question is over. 1.1 s cut people off at natural 1–2 s pauses (test round 1); tapping Ask again still sends at once. */
  endSilenceMs: 2000,
  /** No speech within this long → give up ("I didn't hear a question"). */
  noSpeechMs: 6000,
} as const;

export class EndOfSpeech {
  private elapsed = 0;
  private noise = 0;
  private noiseN = 0;
  private loudMs = 0;
  private quietMs = 0;
  private state: SpeechState = 'waiting';

  get current(): SpeechState {
    return this.state;
  }

  /** Feed one audio block: its RMS (0..1) and duration. Returns the state after it. */
  feed(rms: number, ms: number): SpeechState {
    if (this.state === 'done' || this.state === 'no_speech') return this.state;
    this.elapsed += ms;
    if (this.elapsed <= EOS.calibrateMs) {
      this.noise = (this.noise * this.noiseN + rms) / (this.noiseN + 1);
      this.noiseN++;
      return this.state;
    }
    const loud = rms > Math.max(EOS.floor, this.noise * EOS.ratio);
    if (this.state === 'waiting') {
      this.loudMs = loud ? this.loudMs + ms : 0;
      if (!loud) this.noise = this.noise * 0.98 + rms * 0.02; // keep tracking slow changes in street noise
      if (this.loudMs >= EOS.minSpeechMs) this.state = 'speaking';
      else if (this.elapsed >= EOS.noSpeechMs) this.state = 'no_speech';
      return this.state;
    }
    this.quietMs = loud ? 0 : this.quietMs + ms;
    if (this.quietMs >= EOS.endSilenceMs) this.state = 'done';
    return this.state;
  }
}

/** Root-mean-square loudness of a block of samples. */
export function rms(samples: Float32Array): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return samples.length ? Math.sqrt(s / samples.length) : 0;
}
