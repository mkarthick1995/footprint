import { describe, expect, it } from 'vitest';
import { englishMessages } from './i18nCatalog';

describe('translation catalogue (R3.2)', () => {
  it('lists the fixed sentences once each', () => {
    const m = englishMessages();
    expect(m.length).toBeGreaterThan(40);
    expect(new Set(m).size).toBe(m.length);
    expect(m).toContain('Footprint stopped. Alerts are off.');
  });
});

describe('every offered language covers every fixed sentence (R3.2)', () => {
  it('no sentence falls back to English', async () => {
    const { LANGUAGES, translate } = await import('@footprint/shared');
    const missing: string[] = [];
    for (const { code } of LANGUAGES) {
      if (code === 'en-IN') continue;
      for (const m of englishMessages()) if (translate(m, code) === null) missing.push(`${code}: ${m}`);
    }
    expect(missing).toEqual([]);
  });
});
