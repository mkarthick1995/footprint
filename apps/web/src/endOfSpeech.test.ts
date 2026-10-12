import { describe, expect, it } from 'vitest';
import { EndOfSpeech, rms } from './endOfSpeech';

const BLOCK = 8; // ms (128 samples at 16 kHz)
function run(levels: [level: number, ms: number][]): string[] {
  const d = new EndOfSpeech();
  const states: string[] = [];
  for (const [level, ms] of levels) for (let t = 0; t < ms; t += BLOCK) states.push(d.feed(level, BLOCK));
  return [...new Set(states)];
}

describe('end-of-speech detection (one-tap questions)', () => {
  it('street noise → speech → pause: the question ends by itself', () => {
    expect(run([[0.01, 300], [0.012, 400], [0.08, 1500], [0.011, 1200]])).toEqual(['waiting', 'speaking', 'done']);
  });

  it('short pauses between words do not end the question', () => {
    const s = run([[0.01, 300], [0.08, 600], [0.01, 500], [0.08, 600], [0.01, 600]]);
    expect(s).toEqual(['waiting', 'speaking']);
  });

  it('a brief click or horn blip is not speech', () => {
    expect(run([[0.01, 300], [0.2, 100], [0.01, 1000]])).toEqual(['waiting']);
  });

  it('nothing said within 6 s → no_speech', () => {
    expect(run([[0.01, 300], [0.012, 6000]])).toContain('no_speech');
  });

  it('loud street: speech must stand out from the learned noise', () => {
    expect(run([[0.05, 300], [0.06, 800]])).toEqual(['waiting']); // just noise
    expect(run([[0.05, 300], [0.2, 600], [0.05, 1200]])).toEqual(['waiting', 'speaking', 'done']);
  });

  it('rms of a block', () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 6);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});
