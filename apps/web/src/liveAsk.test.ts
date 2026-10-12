import { describe, expect, it } from 'vitest';
import { floatToPcm16 } from './liveAsk';

describe('microphone audio → PCM16 for Gemini Live', () => {
  it('converts Float32 samples to little-endian 16-bit, clipping out-of-range values', () => {
    const out = floatToPcm16(new Float32Array([0, 1, -1, 0.5, 2, -3]));
    const v = new DataView(out.buffer);
    expect([0, 1, 2, 3, 4, 5].map((i) => v.getInt16(i * 2, true))).toEqual([0, 32767, -32768, 16383, 32767, -32768]);
  });
});
