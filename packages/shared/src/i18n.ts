// Languages (R3.2, ADR-042): spoken alerts, system messages, the caption and the page in the user's language.
// Only languages with both a natural Google voice (Chirp 3 HD) and Gemini Live understanding are offered. Translations
// live in i18nData.ts (machine-translated, then checked by native-speaker teammates). English is the source: every
// message is keyed by its English text (numbers → {n}), so a missing translation falls back to English — never silence.
import type { HazardType, Tier } from './types.js';
import { I18N_DATA } from './i18nData.js';

export const LANGUAGES = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ja-JP', name: 'Japanese', native: '日本語' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANG: LangCode = 'en-IN';

export function isLang(x: unknown): x is LangCode {
  return LANGUAGES.some((l) => l.code === x);
}

export function languageName(code: LangCode): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? 'English';
}

/** "Tamil" / "tamil" / "தமிழ்" / "ta" → 'ta-IN'; null if not offered. */
export function languageByName(name: string): LangCode | null {
  const n = name.trim().toLowerCase().replace(/[.!?]+$/, '');
  const hit = LANGUAGES.find(
    (l) => l.name.toLowerCase() === n || l.native.toLowerCase() === n || l.code.toLowerCase() === n || l.code.slice(0, 2) === n,
  );
  return hit?.code ?? null;
}

// ---------- Messages (English sentence → translation) ----------

/** Translation key for an English sentence: numbers become {n}. */
export function messageKey(text: string): string {
  return text.replace(/\d+(?:\.\d+)?/g, '{n}').replace(/\s+/g, ' ').trim();
}

/** `text` in `lang`, or null when there is no translation (the caller keeps English). English → itself. */
export function translate(text: string, lang: LangCode): string | null {
  if (lang === 'en-IN') return text;
  const out = I18N_DATA[lang]?.messages[messageKey(text)];
  if (!out) return null;
  const nums = text.match(/\d+(?:\.\d+)?/g) ?? [];
  let i = 0;
  return out.replace(/\{n\}/g, () => nums[i++] ?? '');
}

// ---------- Page text ----------

export const UI_EN = {
  hazardMap: 'Hazard map',
  language: 'Language',
  headline: 'An extra pair of eyes for the street.',
  lead: 'Spoken warnings about people, bikes, vehicles and hazards ahead, and answers when you ask about what is around you.',
  safety: 'Footprint can miss things and never tells you when it is safe to cross. Keep using your cane or guide dog.',
  levelLegend: 'How much should it say?',
  essential: 'Essential',
  essentialHint: 'Urgent only',
  standard: 'Standard',
  standardHint: 'Close and ahead',
  detailed: 'Detailed',
  detailedHint: 'Everything',
  ask: 'Ask a question',
  askStarting: 'Starting microphone…',
  askListening: 'Listening… tap to send now',
  askThinking: 'Thinking…',
  askHint: 'Or tap your earbuds or glasses once.',
  describe: "What's around me",
  repeat: 'Repeat',
  routePanel: 'Check a walking route',
  destination: 'Destination',
  destinationPlaceholder: 'e.g. nearest bus stop',
  checkRoute: 'Check route',
  routeHint: 'Or ask: "route to …". Footprint lists hazards other walkers reported; your navigation app gives the turns.',
  start: 'Start walking',
  stop: 'Stop walking',
  cameraWait: 'The camera view appears once faces can be blurred.',
  devOptions: 'Developer options',
  mapLink: 'Community hazard map',
  privacy: 'Faces are blurred on the phone before any photo is sent. No images, video or audio are stored.',
} as const;

export type UiKey = keyof typeof UI_EN;

export function uiText(key: UiKey, lang: LangCode): string {
  return (lang === 'en-IN' ? undefined : I18N_DATA[lang]?.ui[key]) ?? UI_EN[key];
}

// ---------- Alert phrases (built from parts, in each language's word order) ----------

export interface PhraseKit {
  /** [one, many] per hazard type. */
  noun: Record<HazardType, [string, string]>;
  side: { left: string; right: string; ahead: string; around: string };
  /** Templates: {noun} {subject} {side} {n} {place}. */
  stop: string; // "Stop! {noun}"
  obstacle: string; // the generic word used for unknown / low-confidence things
  possible: string; // "Possible {noun}"
  count: string; // "{n} {noun}" (noun = many)
  close: string; // P1: "{subject} close, {side}"
  ahead: string; // P2: "{subject}, {side}"
  reported: string; // "{noun} reported {place}"
  walkers: string; // ", {n} walkers"
}

/** What an alert says, in parts (set by the AlertManager on every hazard utterance). */
export interface PhraseSpec {
  tier: Tier;
  type: HazardType;
  side: 'left' | 'right' | 'ahead' | 'around';
  n: number;
  lowConfidence: boolean;
  community?: boolean;
  reports?: number;
}

const GENERIC: readonly HazardType[] = ['unknown', 'obstruction', 'street_furniture'];

/** The alert in `lang` built from its parts; null for English (the manager's own wording is used) or no kit. */
export function localPhrase(p: PhraseSpec, lang: LangCode): string | null {
  if (lang === 'en-IN') return null;
  const k = I18N_DATA[lang]?.phrase;
  if (!k) return null;
  const [one, many] = k.noun[p.type] ?? k.noun.unknown;
  const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, x: string) => v[x] ?? '');
  if (p.community) {
    const walkers = (p.reports ?? 1) >= 2 ? fill(k.walkers, { n: String(p.reports) }) : '';
    return fill(k.reported, { noun: one, place: k.side[p.side] }) + walkers;
  }
  if (p.tier === 'P0') return fill(k.stop, { noun: p.lowConfidence ? k.obstacle : one });
  const generic = GENERIC.includes(p.type);
  const subject = p.lowConfidence
    ? fill(k.possible, { noun: generic ? k.obstacle : p.n === 1 ? one : many })
    : p.n === 1 ? one : fill(k.count, { n: String(p.n), noun: many });
  return fill(p.tier === 'P1' ? k.close : k.ahead, { subject, side: k.side[p.side] });
}

// ---------- Route summary ----------

export interface RouteKit {
  head: string; // "Walking route to {dest}: {distance}, {time}."
  metres: string; // "about {n} metres"
  km: string; // "about {n} kilometres"
  minutes: string; // "{n} minutes"
  noReports: string;
  reported: string; // "Reported along it: {list}."
  and: string; // " and "
  count: string; // "{n} {noun}"
  first: string; // "The first is {distance} from the start."
  walkers: string; // "Reports from up to {n} walkers."
  turns: string;
  yourDestination: string;
}

export interface LangData {
  messages: Record<string, string>;
  ui: Partial<Record<UiKey, string>>;
  phrase: PhraseKit;
  route: RouteKit;
  /** Spoken when the user switches to this language. */
  switched: string;
}

export function routeKit(lang: LangCode): RouteKit | null {
  return lang === 'en-IN' ? null : (I18N_DATA[lang]?.route ?? null);
}

export function switchedTo(lang: LangCode): string {
  return lang === 'en-IN' ? 'Language: English.' : (I18N_DATA[lang]?.switched ?? `Language: ${languageName(lang)}.`);
}
