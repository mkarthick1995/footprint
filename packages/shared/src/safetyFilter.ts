// Output safety filter (ADR-012, R1.7): every piece of model-derived text passes through here before it can be spoken.
// Pure and deterministic — no model, no network — so every rule is unit-tested.
//
// What it stops (SAFETY.md §5): an "all clear" / "it is safe" claim, a go / cross instruction, an unhedged traffic-signal
// state, a description of who a person is or looks like, and text that repeats an injected instruction (SEC-04).
// How: split into sentences, drop every sentence that trips a rule, and say the approved fallback instead.
//
// Deliberately conservative: it over-blocks rather than under-blocks. A phrase filter cannot catch every paraphrase,
// so it is one layer next to the Gemini system instruction and the response schema — see SAFETY.md §4.

export type FilterReason = 'all_clear' | 'crossing' | 'signal' | 'identity' | 'injection' | 'invalid';

/** Approved neutral wording, spoken instead of a blocked claim. Each must pass this filter itself (tested). */
export const FALLBACK_TEXT: Readonly<Record<Exclude<FilterReason, 'invalid'>, string>> = {
  crossing: "I can't tell you when to cross.",
  signal: "I can't confirm the signal. Please verify it yourself.",
  all_clear: "I can't confirm the way ahead, so use your cane.",
  identity: "I don't describe people.",
  injection: "I don't follow instructions written on signs.",
};

/** Order in which fallbacks are appended. */
const REASON_ORDER: readonly Exclude<FilterReason, 'invalid'>[] = ['crossing', 'signal', 'all_clear', 'identity', 'injection'];

export interface FilterResult {
  /** Safe text to speak: kept sentences plus any fallback. Empty when there is nothing to say. */
  text: string;
  /** True when anything was removed or the input was unusable. */
  blocked: boolean;
  /** Why (reasons only — never log the blocked text itself, it may describe a bystander). */
  reasons: FilterReason[];
}

// ---------- normalisation ----------

/** Look-alike letters from other scripts that survive Unicode normalisation. */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ѕ: 's', ј: 'j', ԁ: 'd', ɡ: 'g', һ: 'h',
  α: 'a', ο: 'o', ρ: 'p', ν: 'v', ι: 'i', κ: 'k', τ: 't', χ: 'x',
};

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

function baseNormalise(s: string): string {
  let t = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); // strip accents
  t = t.replace(/[​-‏⁠­﻿‪-‮]/g, ''); // zero-width and bidi controls, soft hyphen
  t = [...t].map((c) => HOMOGLYPHS[c] ?? c).join('');
  t = t.toLowerCase().replace(/[’'`]/g, ''); // "don't" → "dont", "it's" → "its"
  return t.replace(/\s+/g, ' ').trim();
}

/** "c r o s s  n o w", "c.r.o.s.s" → joined letters. Runs of ≥ 4 single letters are collapsed. */
function despace(s: string): string {
  return s.replace(/\b(?:[a-z][\s.\-_*]+){3,}[a-z]\b/g, (run) => run.replace(/[\s.\-_*]+/g, ''));
}

function leet(s: string): string {
  return [...s].map((c) => LEET[c] ?? c).join('');
}

/** Variants of one sentence to test: as written, de-leeted, and de-spaced. */
function variants(sentence: string): string[] {
  const n = baseNormalise(sentence);
  const out = new Set<string>([n, leet(n), despace(n), despace(leet(n))]);
  return [...out];
}

// ---------- rules ----------

const word = (alts: string): RegExp => new RegExp(`\\b(?:${alts})\\b`);

/** Absence / safety claims. Broad on purpose: "safe", "clear", "free", "empty" are never ours to assert. */
const ALL_CLEAR: RegExp[] = [
  word('safe|safely|unobstructed|empty|clear|free|secure'),
  word('all set|in the clear|good to go|nothing to worry|no worries'),
  /\bno (?:obstacles?|obstructions?|hazards?|dangers?|threats?|traffic|vehicles?|cars?|bikes?|cyclists?|people|pedestrians?|potholes?|problems?|issues?|barriers?|one)\b/,
  /\bnothing (?:ahead|there|here|in (?:your|the) (?:way|path)|in front|blocking|dangerous|wrong|to (?:worry|avoid|fear))\b/,
  /\b(?:dont|do not|cant|cannot|didnt|did not|not) (?:see|detect|notice|find|spot|observe|sense) (?:any|anything|an?|obstacles?|hazards?|traffic|vehicles?)\b/,
  /\b(?:youre|you are|youll be|you will be) (?:good|fine|ok|okay)\b/,
  /\ball good\b/,
];

/** Go / cross instructions and permissions. */
const CROSSING: RegExp[] = [
  /\b(?:you can|you may|you could|you should|you might|you must|can|may|should|must|ok to|okay to|time to|ready to|go ahead and|ahead and|start to|begin to|start|begin|continue to|proceed to|free to|clear to|safe to|fine to|good to|now) (?:to )?(?:cross|go|walk|proceed|step|move|continue|run|hurry)(?:ing)?\b/,
  // "step" is deliberately absent: "a step ahead" is a hazard (a stair or kerb), not an instruction. Step commands are
  // caught by the sentence-start rule below and by "you can / now step" above (owner review 2026-10-12).
  /\b(?:cross|go|walk|proceed|move|run|hurry|continue) (?:now|ahead|across|forward|out|on|over|quickly|fast|straight|immediately)\b/,
  /^(?:please |now )?step (?:now|across|out|off|over|onto|into the road)\b/,
  /\bcross (?:the )?(?:road|street|junction|intersection|here|there|safely)\b/,
  /\bcrossing (?:the )?(?:road|street) (?:now|is)\b/,
  /^(?:please )?(?:cross|go|walk|proceed|step forward|move forward|run|hurry)\b/,
  /\b(?:its|it is) (?:your turn|time to|ok|okay|fine)\b/,
  /\bgo ahead\b/,
  /\bwalk sign\b/,
  /\byou(?:re| are) (?:free|clear|good|allowed|able) to\b/,
];

const SIGNAL_NOUN = word('traffic lights?|lights?|signals?|walk signs?|pedestrian (?:lights?|signals?)|crossing (?:lights?|signals?)|green man|red man|beacon');
const SIGNAL_STATE = word('green|red|amber|yellow|white|walk|dont walk|go|stop|turned|changed|changing|flashing');
const HEDGE = word('appears?|looks?|seems?|may|might|possibly|probably|could be|i think');
const VERIFY = word('verify|check|confirm');

/** People: who they are or what they look like. The approved form is "A person ahead, about 3 steps". */
const IDENTITY: RegExp[] = [
  word('man|woman|men|women|boy|girl|boys|girls|lady|ladies|gentleman|guy|guys|male|female|child|children|kid|kids|baby|infant|toddler|teen|teens|teenager|teenagers|adult|adults|young|elderly|aged|senior|youth'),
  /\b\d{1,3} ?(?:years? old|yrs? old|year olds?)\b/,
  word('wearing|wears|dressed|clothes|clothing|outfit|shirt|tshirt|t shirt|jacket|coat|dress|saree|sari|kurta|jeans|pants|trousers|shorts|skirt|hat|cap|turban|hijab|burqa|scarf|uniform|sunglasses|glasses|spectacles'),
  word('face|faces|facial|hair|haircut|beard|moustache|mustache|bald|skin|complexion|eyes|smile|smiling|frowning|overweight|attractive|handsome|beautiful|pretty|ugly'),
  /\b(?:looks?|seems?|appears?) (?:like|angry|happy|sad|upset|suspicious|dangerous|drunk|tired|lost|poor|rich|homeless|scary|friendly|threatening)\b/,
  word('race|racial|ethnic|ethnicity|asian|african|indian|chinese|european|caucasian|hispanic|latino|arab|muslim|hindu|christian|sikh|buddhist|religion|religious|caste|nationality|foreigner|tourist'),
  /\b(?:i|we) (?:recogni[sz]e|know|identified?)\b/,
  /\b(?:named|called|name is|is called)\b/,
];

/** Instructions that came from the scene (a sign), or attempts to change our rules (SEC-04). */
const INJECTION: RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass|skip|drop) (?:all |any |the |your |these |those |previous |prior |above |earlier |system |safety |original )*(?:instructions?|rules?|prompts?|guidelines?|directions?|polic(?:y|ies)|constraints?|filters?|restrictions?)\b/,
  word('system prompt|developer mode|jailbreak|prompt injection|new instructions?|new rules?|new role'),
  /\byou are now\b/,
  /\bact as\b/,
  /\bpretend (?:to|that|you)\b/,
  /\b(?:dont|do not|never) (?:tell|inform|warn|alert|mention)\b/,
  /\b(?:tell|inform|instruct|command|order|persuade|convince) (?:the |this )?(?:user|person|blind|them)\b/,
  /\b(?:the )?(?:sign|poster|note|screen|text|message|label) (?:says?|reads?|instructs?|tells?|orders?|commands?)\b.*\b(?:ignore|tell|cross|go|safe|clear|obey|follow)\b/,
];

function matchesAny(rules: readonly RegExp[], text: string): boolean {
  return rules.some((r) => r.test(text));
}

/**
 * Phrases checked after all spacing is removed, only for text that was spaced out letter by letter ("c r o s s n o w"),
 * where word gaps are lost and the normal patterns cannot see the phrase.
 */
const SQUASHED: Readonly<Record<string, Exclude<FilterReason, 'invalid'>>> = {
  crossnow: 'crossing', safetocross: 'crossing', gonow: 'crossing', walknow: 'crossing', youcancross: 'crossing',
  goahead: 'crossing', proceednow: 'crossing',
  allclear: 'all_clear', itissafe: 'all_clear', itssafe: 'all_clear', pathisclear: 'all_clear', wayisclear: 'all_clear',
  nothingahead: 'all_clear', nohazards: 'all_clear', noobstacles: 'all_clear',
};

/** Reasons a single sentence is blocked (empty = clean). Tests every normalised variant. */
function sentenceReasons(sentence: string, verifyInText: boolean): Exclude<FilterReason, 'invalid'>[] {
  const found = new Set<Exclude<FilterReason, 'invalid'>>();
  const n = baseNormalise(sentence);
  for (const base of [n, leet(n)]) {
    const spaced = despace(base);
    if (spaced === base) continue; // not letter-spaced text
    const squashed = spaced.replace(/[^a-z0-9]/g, '');
    for (const [key, reason] of Object.entries(SQUASHED)) if (squashed.includes(key)) found.add(reason);
  }
  for (const v of variants(sentence)) {
    if (matchesAny(INJECTION, v)) found.add('injection');
    if (matchesAny(CROSSING, v)) found.add('crossing');
    if (matchesAny(ALL_CLEAR, v)) found.add('all_clear');
    if (matchesAny(IDENTITY, v)) found.add('identity');
    // A signal state is only allowed when hedged ("looks green") and the text also asks the user to verify — in the
    // same sentence or a neighbouring one ("The signal looks green. Please verify.").
    if (SIGNAL_NOUN.test(v) && SIGNAL_STATE.test(v) && !(HEDGE.test(v) && (VERIFY.test(v) || verifyInText))) found.add('signal');
  }
  return [...found];
}

/** Remove things that should never be spoken or rendered: URLs, markup, control characters. */
function clean(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[*_#`~>|\\]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Sentences, keeping their punctuation. A newline or ; also ends a sentence. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…;])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => /[a-z0-9]/i.test(s));
}

/**
 * Filter model-derived text. Returns the text that is safe to speak (possibly with an approved fallback), or an empty
 * result. Never throws; anything that is not a string is "invalid" and produces no speech.
 */
export function filterModelText(raw: unknown): FilterResult {
  if (typeof raw !== 'string') return { text: '', blocked: true, reasons: ['invalid'] };
  const cleaned = clean(raw);
  if (!cleaned) return { text: '', blocked: false, reasons: [] };

  const kept: string[] = [];
  const reasons = new Set<Exclude<FilterReason, 'invalid'>>();
  const verifyInText = VERIFY.test(baseNormalise(cleaned));
  for (const s of sentences(cleaned)) {
    const why = sentenceReasons(s, verifyInText);
    if (why.length === 0) kept.push(s);
    else why.forEach((r) => reasons.add(r));
  }
  if (reasons.size === 0) return { text: kept.join(' '), blocked: false, reasons: [] };

  const fallbacks = REASON_ORDER.filter((r) => reasons.has(r)).map((r) => FALLBACK_TEXT[r]);
  // Refusal first: if the text is later capped to two sentences, the fallback must not be the part that is cut.
  return { text: [...fallbacks, ...kept].join(' '), blocked: true, reasons: REASON_ORDER.filter((r) => reasons.has(r)) };
}

/** Convenience for callers that only need to know whether the model text was clean. */
export function isCleanModelText(raw: unknown): boolean {
  return !filterModelText(raw).blocked;
}
