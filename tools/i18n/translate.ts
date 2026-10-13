// Generates packages/shared/src/i18nData.ts (R3.2, ADR-042): Gemini translates the English catalogue, page text and
// the phrase/route kits into each offered language. Run: npx tsx tools/i18n/translate.ts [lang…]
// Output is machine-translated — native speakers review it (docs/i18n-review.md) before a language counts as checked.
import { writeFileSync } from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';
import { HAZARD_TYPES, LANGUAGES, UI_EN, type LangCode, type LangData } from '../../packages/shared/src/index';
import { I18N_DATA } from '../../packages/shared/src/i18nData';
import { englishMessages } from '../../apps/web/src/i18nCatalog';

const NOUN_EN: Record<string, [string, string]> = {
  pothole: ['pothole', 'potholes'],
  no_footpath: ['no footpath', 'no footpath'],
  open_drain: ['open drain', 'open drains'],
  speed_breaker: ['speed bump', 'speed bumps'],
  obstruction: ['obstacle', 'obstacles'],
  drop_off: ['drop', 'drops'],
  crossing: ['crossing', 'crossings'],
  vehicle: ['vehicle', 'vehicles'],
  cyclist: ['bike', 'bikes'],
  person: ['person', 'people'],
  street_furniture: ['obstacle', 'obstacles'],
  unknown: ['obstacle', 'obstacles'],
};

const PHRASE_EN = {
  side: { left: 'left', right: 'right', ahead: 'ahead', around: 'nearby' },
  stop: 'Stop! {noun}',
  obstacle: 'obstacle',
  possible: 'Possible {noun}',
  count: '{n} {noun}',
  close: '{subject} close, {side}',
  ahead: '{subject}, {side}',
  reported: '{noun} reported {place}',
  walkers: ', {n} walkers',
};

const ROUTE_EN = {
  head: 'Walking route to {dest}: {distance}, {time}.',
  metres: 'about {n} metres',
  km: 'about {n} kilometres',
  minutes: '{n} minutes',
  noReports: 'No community reports along this route yet. That does not mean there are no hazards.',
  reported: 'Reported along it: {list}.',
  and: ' and ',
  count: '{n} {noun}',
  first: 'The first is {distance} from the start.',
  walkers: 'Reports from up to {n} walkers.',
  turns: 'Use your navigation app for turns.',
  yourDestination: 'your destination',
};

const str = { type: Type.STRING };
const obj = (keys: readonly string[], value: object = str) => ({
  type: Type.OBJECT,
  properties: Object.fromEntries(keys.map((k) => [k, value])),
  required: [...keys],
});
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    messages: { type: Type.ARRAY, items: str },
    ui: obj(Object.keys(UI_EN)),
    phrase: {
      type: Type.OBJECT,
      properties: {
        noun: obj(HAZARD_TYPES, { type: Type.ARRAY, items: str }),
        side: obj(['left', 'right', 'ahead', 'around']),
        ...Object.fromEntries(['stop', 'obstacle', 'possible', 'count', 'close', 'ahead', 'reported', 'walkers'].map((k) => [k, str])),
      },
      required: ['noun', 'side', 'stop', 'obstacle', 'possible', 'count', 'close', 'ahead', 'reported', 'walkers'],
    },
    route: obj(Object.keys(ROUTE_EN)),
    switched: str,
  },
  required: ['messages', 'ui', 'phrase', 'route', 'switched'],
};

const RULES = (language: string) => `You translate the spoken interface of Footprint, a safety app for blind and low-vision
pedestrians in India and Asia, into ${language}. Everything is HEARD through a speech voice, not read.
Rules:
- Natural, everyday spoken ${language} that ordinary people in the street use — short, clear, calm, polite but direct.
  Prefer common words over formal/literary ones; English loan words people actually say (e.g. "bike") are fine.
- Keep every placeholder exactly: {n} {noun} {subject} {side} {place} {dest} {distance} {time} {list}. You may move them
  to fit ${language} word order. Keep the brand name "Footprint" as is (in Latin letters).
- Safety meaning must not change: "Stop!" is the most urgent short command a person shouts to make someone halt at once.
  Never soften "can miss things", "never tells you when it is safe to cross", "Keep using your cane".
- phrase.* are building blocks for very short alerts: phrase.noun[type] = [one, many]; phrase.side = direction words
  (relative to the walker: left, right, straight ahead, nearby); keep them as short as possible.
- messages: return the same number of items in the same order.
- switched: one short sentence saying the app now speaks ${language}.`;

async function translateOne(ai: GoogleGenAI, lang: LangCode): Promise<LangData> {
  const language = LANGUAGES.find((l) => l.code === lang)!.name;
  const key = (m: string) => m.replace(/\d+(?:\.\d+)?/g, '{n}').replace(/\s+/g, ' ').trim();
  const messages = englishMessages().map(key); // numbers as {n}, so translations keep the placeholder
  const input = { messages, ui: UI_EN, phrase: { noun: NOUN_EN, ...PHRASE_EN }, route: ROUTE_EN, switched: 'Language: English. Footprint will now speak English.' };
  const res = await ai.models.generateContent({
    model: process.env.I18N_MODEL || 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: `${RULES(language)}\n\nTranslate this JSON:\n${JSON.stringify(input)}` }] }],
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
  });
  const out = JSON.parse(res.text ?? '{}') as {
    messages: string[];
    ui: LangData['ui'];
    phrase: LangData['phrase'];
    route: LangData['route'];
    switched: string;
  };
  if (out.messages.length !== messages.length) throw new Error(`${lang}: ${out.messages.length} of ${messages.length} messages`);
  const keyed: Record<string, string> = {};
  const holes = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
  messages.forEach((m, i) => {
    const t = out.messages[i]!;
    if (holes(t) !== holes(m)) throw new Error(`${lang}: placeholders differ in "${m}" → "${t}"`);
    keyed[m] = t;
  });
  for (const [k, v] of Object.entries(ROUTE_EN)) {
    if (holes(out.route[k as keyof typeof ROUTE_EN]) !== holes(v)) throw new Error(`${lang}: route.${k} placeholders differ`);
  }
  return { messages: keyed, ui: out.ui, phrase: out.phrase, route: out.route, switched: out.switched };
}

const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: 'global' });
const wanted = (process.argv.slice(2).length ? process.argv.slice(2) : ['hi-IN', 'ta-IN', 'te-IN', 'ja-JP']) as LangCode[];
const data: Partial<Record<LangCode, LangData>> = { ...I18N_DATA };
for (const lang of wanted) {
  const t0 = Date.now();
  data[lang] = await translateOne(ai, lang);
  console.log(lang, `${Date.now() - t0} ms`, Object.keys(data[lang]!.messages).length, 'messages');
}
writeFileSync(
  new URL('../../packages/shared/src/i18nData.ts', import.meta.url),
  `// Generated by tools/i18n/translate.ts (Gemini, then reviewed by native speakers — see docs/i18n-review.md).\n` +
    `// Do not edit by hand except to apply a reviewer's correction.\n` +
    `import type { LangCode, LangData } from './i18n.js';\n\n` +
    `export const I18N_DATA: Partial<Record<LangCode, LangData>> = ${JSON.stringify(data, null, 2)};\n`,
);
