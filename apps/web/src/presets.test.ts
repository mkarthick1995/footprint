import { describe, expect, it } from 'vitest';
import { PRESET_SPOKEN, stepPreset } from './presets';

describe('alert presets (Q14)', () => {
  it('steps one level at a time and stops at the ends', () => {
    expect(stepPreset('standard', 'fewer')).toBe('essential');
    expect(stepPreset('essential', 'fewer')).toBe('essential');
    expect(stepPreset('standard', 'more')).toBe('detailed');
    expect(stepPreset('detailed', 'more')).toBe('detailed');
  });
  it('every level has short spoken wording', () => {
    for (const s of Object.values(PRESET_SPOKEN)) expect(s.split(' ').length).toBeLessThanOrEqual(10);
  });
});
