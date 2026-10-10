import { describe, expect, it } from 'vitest';
import { pickVoiceIndex, type VoiceInfo } from './speech';

const v = (name: string, lang: string, localService = true, isDefault = false): VoiceInfo => ({
  name,
  lang,
  localService,
  default: isDefault,
});

describe('pickVoiceIndex (ADR-033)', () => {
  it('prefers a natural Google voice in the user locale', () => {
    const voices = [v('eSpeak English', 'en-US', true, true), v('Google English India', 'en-IN'), v('Google US English', 'en-US')];
    expect(pickVoiceIndex(voices, 'en-IN')).toBe(1);
  });

  it('falls back to any natural English voice when the locale has none', () => {
    const voices = [v('Basic English', 'en-GB'), v('Google UK English Female', 'en-GB')];
    expect(pickVoiceIndex(voices, 'en-SG')).toBe(1);
  });

  it('prefers on-device voices over network voices of equal quality', () => {
    const voices = [v('Google US English', 'en-US', false), v('Google US English Offline', 'en-US', true)];
    expect(pickVoiceIndex(voices, 'en-US')).toBe(1);
  });

  it('ignores non-English voices (English-first prototype)', () => {
    const voices = [v('Google हिन्दी', 'hi-IN'), v('Default English', 'en-US')];
    expect(pickVoiceIndex(voices, 'hi-IN')).toBe(1);
  });

  it('returns -1 when nothing suitable exists (caller uses the browser default)', () => {
    expect(pickVoiceIndex([], 'en-US')).toBe(-1);
    expect(pickVoiceIndex([v('Google 日本語', 'ja-JP')], 'ja-JP')).toBe(-1);
  });
});
