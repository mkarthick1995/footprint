import { describe, expect, it } from 'vitest';
import { HAZARD_TYPES } from './types.js';
import { I18N_DATA } from './i18nData.js';
import { LANGUAGES, languageByName, localPhrase, messageKey, translate, UI_EN, uiText, type LangCode } from './i18n.js';
import { phraseText } from './alerts.js';
import { parseModelCommand } from './live.js';
import { routeSummary } from './route.js';

const OTHER = LANGUAGES.filter((l) => l.code !== 'en-IN').map((l) => l.code as LangCode);

describe('languages (R3.2)', () => {
  it('every offered language has data: all page labels, all hazard nouns, the route kit', () => {
    for (const lang of OTHER) {
      const d = I18N_DATA[lang]!;
      expect(d, lang).toBeDefined();
      for (const k of Object.keys(UI_EN)) expect(d.ui[k as keyof typeof UI_EN], `${lang} ui.${k}`).toBeTruthy();
      for (const t of HAZARD_TYPES) expect(d.phrase.noun[t]?.length, `${lang} noun ${t}`).toBe(2);
      expect(d.route.noReports).toBeTruthy();
    }
  });

  it('translates with numbers kept; unknown text → null (caller keeps English)', () => {
    expect(translate('Battery low, 15 percent.', 'ta-IN')).toContain('15');
    expect(translate('Battery low, 15 percent.', 'en-IN')).toBe('Battery low, 15 percent.');
    expect(translate('Something new nobody translated.', 'hi-IN')).toBeNull();
    expect(messageKey('That is more than 5 kilometres.')).toBe('That is more than {n} kilometres.');
  });

  it('alerts are built in the language, never left in English', () => {
    for (const lang of OTHER) {
      const stop = phraseText({ tier: 'P0', type: 'cyclist', side: 'ahead', n: 1, lowConfidence: false }, lang);
      const near = phraseText({ tier: 'P1', type: 'person', side: 'left', n: 1, lowConfidence: false }, lang);
      expect(stop, lang).not.toMatch(/Stop|\{/);
      expect(near, lang).not.toMatch(/close|left|\{/);
      expect(localPhrase({ tier: 'P2', type: 'vehicle', side: 'right', n: 2, lowConfidence: false }, lang)).toContain('2');
    }
    expect(phraseText({ tier: 'P0', type: 'cyclist', side: 'ahead', n: 1, lowConfidence: false })).toBe('Stop! Bike');
  });

  it('ST-19 in every language: no reports → the cold-start warning, no placeholders left', () => {
    for (const lang of OTHER) {
      const s = routeSummary('Bus stop', 650, 540, [], lang);
      expect(s, lang).toContain(I18N_DATA[lang]!.route.noReports);
      expect(s, lang).not.toMatch(/\{|\}/);
      expect(s, lang).toContain('650');
    }
  });

  it('switching language by voice: names in English or the language itself', () => {
    expect(languageByName('Tamil')).toBe('ta-IN');
    expect(languageByName('தமிழ்')).toBe('ta-IN');
    expect(languageByName('hindi.')).toBe('hi-IN');
    expect(languageByName('Klingon')).toBeNull();
    expect(parseModelCommand('Command: language Telugu.')).toEqual({ kind: 'language', name: 'Telugu' });
    expect(uiText('start', 'ja-JP')).not.toBe('Start walking');
  });
});

describe('answers in other scripts survive the filter (R3.2)', () => {
  it('Tamil, Hindi, Telugu and Japanese answers are kept whole', async () => {
    const { filterModelText } = await import('./safetyFilter.js');
    for (const t of [
      'இடதுபுறத்தில் ஒரு கடை உள்ளது. முன்னால் நடைபாதை தொடர்கிறது.',
      'आपके बाईं ओर एक दुकान है। आगे फुटपाथ है।',
      'ఎడమవైపు ఒక దుకాణం ఉంది. ముందు ఫుట్‌పాత్ ఉంది.',
      '左側に店があります。前方に歩道が続いています。',
    ]) {
      const r = filterModelText(t);
      expect(r.blocked).toBe(false);
      expect(r.text.replace(/\s+/g, '')).toBe(t.replace(/\s+/g, ''));
    }
  });
});
