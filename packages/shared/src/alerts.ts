// Alert manager core (ADR-022, Q3): decides WHAT to say and WHEN. Pure and clock-injected so every queue rule is
// unit-tested; the browser layer (apps/web/src/alertOutput.ts) only renders the result as speech, earcon and vibration.
// Never produces an "all clear": silence means "nothing to report", never "safe" (ADR-012).
import type { AlertCandidate, AlertPreset, HazardType, Tier } from './types.js';
import { SEVERITY_ORDER, tierAllowed } from './tiers.js';
import { filterModelText, type FilterResult } from './safetyFilter.js';

export type Earcon = 'imminent' | 'near' | 'system' | null;

export interface Utterance {
  /** Words to speak; empty = earcon/vibration only (a repeat of something said moments ago, ADR-023). */
  text: string;
  tier: Tier;
  earcon: Earcon;
  /** navigator.vibrate pattern (ms), or null. */
  vibrate: number[] | null;
  /** Cut off whatever is being spoken now. */
  interrupt: boolean;
  /** Candidate IDs this message covers (for cool-downs). */
  ids: string[];
}

export interface AlertManagerOptions {
  preset?: AlertPreset;
  /** On-device candidates older than this are stale and never spoken (SAF-22). */
  maxAgeMs?: number;
  /** Same object, same or lower tier: don't repeat within this window (hysteresis). */
  objectCooldownMs?: number;
  /** Same type + side + tier from *any* track (tracker ID churn in crowds): don't repeat within this window. */
  groupCooldownMs?: number;
  /** Below this confidence: far items are dropped, close items are worded "possible" (ADR-022 rule 6). */
  lowConfidence?: number;
  /** A group already put into words within this window repeats as an earcon only (P1) or not at all (P2/P3). */
  repeatAsCueMs?: number;
}

/** Minimum gap after any message before a message of this tier may start (ADR-023 rate caps). */
const MIN_GAP_MS: Record<Tier, number> = { SYS: 0, P0: 0, P1: 1500, P2: 3000, P3: 6000 };

const RANK: Record<Tier, number> = { SYS: 0, P0: 1, P1: 2, P2: 3, P3: 4 };

/** Minimum gap before spoken answers to a user question (the user is waiting, so shorter than ambient P3 context). */
const ANSWER_GAP_MS = 1500;
/** Queued model text is dropped if it has not been spoken within this time (an old answer is worse than none, SAF-22). */
const MODEL_TEXT_TTL_MS = 10_000;
/** ADR-023: P3 is at most 2 sentences and ~30 words. */
const P3_MAX_SENTENCES = 2;

export type ModelTextKind = 'answer' | 'context';

/** Keep the first sentences that fit the P3 caps; cut a single over-long sentence at a word boundary. */
function capP3(text: string): string {
  const parts = text.split(/(?<=[.!?…])\s+/u).filter((s) => s.trim());
  const out: string[] = [];
  let words = 0;
  for (const s of parts.slice(0, P3_MAX_SENTENCES)) {
    const n = wordCount(s);
    if (words + n > WORD_CAP.P3) break;
    out.push(s);
    words += n;
  }
  if (out.length > 0) return out.join(' ');
  return (parts[0] ?? '').split(/\s+/).slice(0, WORD_CAP.P3).join(' ');
}

const NOUN: Record<HazardType, [singular: string, plural: string]> = {
  pothole: ['Pothole', 'potholes'],
  no_footpath: ['No footpath', 'no footpath'],
  open_drain: ['Open drain', 'open drains'],
  speed_breaker: ['Speed bump', 'speed bumps'],
  obstruction: ['Obstacle', 'obstacles'],
  drop_off: ['Drop', 'drops'],
  crossing: ['Crossing', 'crossings'],
  vehicle: ['Vehicle', 'vehicles'],
  cyclist: ['Bike', 'bikes'],
  person: ['Person', 'people'],
  street_furniture: ['Obstacle', 'obstacles'],
  unknown: ['Obstacle', 'obstacles'],
};

/** P0 must stay ≤ 2 words: one-word nouns for the multi-word types. */
const P0_NOUN: Partial<Record<HazardType, string>> = { open_drain: 'Drain', speed_breaker: 'Bump', no_footpath: 'Road' };

const COUNT = ['', 'One', 'Two', 'Three'];

export type Side = 'left' | 'ahead' | 'right';
/** A merged group's direction: people on several sides at once are "around". */
export type GroupSide = Side | 'around';

/** Direction bucket from bearing: within ±10° counts as straight ahead. */
export function sideOf(bearingDeg: number): Side {
  if (bearingDeg < -10) return 'left';
  if (bearingDeg > 10) return 'right';
  return 'ahead';
}

/** Hard length caps by tier (ADR-023): P0 ≤ 2 words, P1 ≤ 5, P2 ≤ 8. */
export const WORD_CAP: Record<Tier, number> = { P0: 2, P1: 5, P2: 8, P3: 30, SYS: 30 };

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

interface Group {
  key: string;
  tier: Tier;
  type: HazardType;
  side: GroupSide;
  items: AlertCandidate[];
  /** Lowest TTC in the group (first to be encountered). */
  ttc: number;
  lowConfidence: boolean;
}

/** Wording for a merged group. Short, direction-first, bucketed distance — never metres (SAF-23). */
export function phraseFor(g: Pick<Group, 'tier' | 'type' | 'side' | 'items' | 'lowConfidence'>): string {
  const [one, many] = NOUN[g.type] ?? NOUN.unknown;
  const n = g.items.length;
  const where = g.side;
  if (g.tier === 'P0') return `Stop! ${g.lowConfidence ? 'Obstacle' : (P0_NOUN[g.type] ?? one)}`;
  const generic = g.type === 'unknown' || g.type === 'obstruction' || g.type === 'street_furniture';
  // Uncertain: keep the detector's best guess ("Possible person") — "possible obstacle" for everything hid the type.
  const subject = g.lowConfidence
    ? `Possible ${generic ? 'obstacle' : n === 1 ? one.toLowerCase() : many}`
    : n === 1 ? one : n <= 3 ? `${COUNT[n]} ${many}` : `${cap(many)}`;
  const spaced = g.side === 'ahead' || g.side === 'around';
  if (g.tier === 'P1') return spaced ? `${subject} close ${where}` : `${subject} close, ${where}`;
  return spaced && g.side === 'around' ? `${subject} ${where}` : `${subject}, ${where}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function severity(type: HazardType): number {
  const i = SEVERITY_ORDER.indexOf(type);
  return i < 0 ? SEVERITY_ORDER.length : i;
}

const EARCON: Record<Tier, Earcon> = { SYS: 'system', P0: 'imminent', P1: 'near', P2: null, P3: null };
const VIBRATE: Record<Tier, number[] | null> = { SYS: [300], P0: [80, 40, 80, 40, 80], P1: [120], P2: null, P3: null };

/**
 * The only component that decides speech. Feed it the latest candidates every frame (`update`), push system messages
 * (`system`), and ask `next()` whenever the output is idle or a frame arrives. It returns at most one message.
 */
export class AlertManager {
  private candidates: AlertCandidate[] = [];
  private systemQueue: string[] = [];
  /** Model-derived text that already passed the safety filter (P3). Only `modelText()` can add to it (R1.7). */
  private contextQueue: { text: string; kind: ModelTextKind; expiresAt: number }[] = [];
  private spokenObject = new Map<string, { tier: Tier; at: number }>();
  private spokenGroup = new Map<string, number>();
  /** Last time each group was put into words (not just cued). */
  private wordedGroup = new Map<string, number>();
  private lastSpokenAt = -Infinity;
  private current: Tier | null = null;
  private readonly opts: Required<AlertManagerOptions>;

  constructor(opts: AlertManagerOptions = {}) {
    this.opts = {
      preset: 'standard', maxAgeMs: 1000, objectCooldownMs: 8000, groupCooldownMs: 4000, lowConfidence: 0.5, repeatAsCueMs: 15000,
      ...opts,
    };
  }

  setPreset(preset: AlertPreset): void {
    this.opts.preset = preset;
  }

  /** Replace the current view with the latest frame's candidates (the newest frame is the re-check, rule 2). */
  update(candidates: readonly AlertCandidate[]): void {
    this.candidates = [...candidates];
  }

  /** Queue a system message (SYS tier: camera lost, paused, stopped…). Spoken next, interrupting anything below P0. */
  system(text: string): void {
    this.systemQueue.push(text);
  }

  /**
   * The ONLY way model-derived text (Gemini answers, scene descriptions) can reach the speaker (R1.7, ADR-012).
   * The text is filtered here, capped to P3 length, and queued as P3: it is spoken when no hazard is pending and is
   * interrupted by P0/P1. Returns the filter result so the caller can count blocked output (reasons only — never log
   * the text). `kind: 'context'` is ambient description and obeys the user's preset; `'answer'` replies to a question.
   */
  modelText(raw: unknown, now: number, opts: { kind?: ModelTextKind; ttlMs?: number } = {}): FilterResult {
    const kind = opts.kind ?? 'answer';
    const result = filterModelText(raw);
    const text = capP3(result.text);
    if (!text) return result;
    if (kind === 'context' && !tierAllowed('P3', this.opts.preset)) return result; // muted by preset; still filtered
    this.contextQueue.push({ text, kind, expiresAt: now + (opts.ttlMs ?? MODEL_TEXT_TTL_MS) });
    if (this.contextQueue.length > 2) this.contextQueue.shift(); // only the latest matter
    return result;
  }

  /** Tell the manager the output finished (or was cut) so lower tiers may speak again. */
  finished(): void {
    this.current = null;
  }

  /** Drop all hazard state (walk stopped). System messages stay queued. */
  reset(): void {
    this.candidates = [];
    this.spokenObject.clear();
    this.spokenGroup.clear();
    this.wordedGroup.clear();
    this.contextQueue = [];
    this.current = null;
  }

  /** Decide what to say at `now` (ms, same clock as `observedAt`). `speaking` = the output is busy. */
  next(now: number, speaking = this.current !== null): Utterance | null {
    if (!speaking) this.current = null;
    const sys = this.systemQueue[0];
    if (sys !== undefined) {
      // SYS waits only for an active P0 hazard message (ADR-022 table).
      if (speaking && this.current === 'P0') return null;
      this.systemQueue.shift();
      return this.emit({ text: sys, tier: 'SYS', earcon: 'system', vibrate: VIBRATE.SYS, interrupt: true, ids: [] }, now);
    }
    const group = this.pick(now);
    if (!group) return this.nextModelText(now, speaking);
    // Interrupt rules: P0 cuts anything below P0; P1 cuts P2/P3; otherwise wait for the output to be idle.
    if (speaking && this.current !== null) {
      const canCut = (group.tier === 'P0' && RANK[this.current] > RANK.P0) || (group.tier === 'P1' && RANK[this.current] > RANK.P1);
      if (!canCut) return null;
    }
    if (now - this.lastSpokenAt < MIN_GAP_MS[group.tier]) return null;
    const ids = group.items.map((c) => c.id);
    const key = group.key;
    for (const c of group.items) this.spokenObject.set(c.id, { tier: group.tier, at: now });
    this.spokenGroup.set(key, now);
    // Recurring situation (people streaming past): words once, then a short cue. P0 always speaks.
    const worded = this.wordedGroup.get(key);
    const repeat = group.tier !== 'P0' && worded !== undefined && now - worded < this.opts.repeatAsCueMs;
    if (repeat && EARCON[group.tier] === null) return null; // P2/P3 repeat: nothing new to say
    if (!repeat) this.wordedGroup.set(key, now);
    return this.emit(
      {
        text: repeat ? '' : phraseFor(group),
        tier: group.tier,
        earcon: EARCON[group.tier],
        vibrate: VIBRATE[group.tier],
        interrupt: speaking,
        ids,
      },
      now,
    );
  }

  /** P3: queued, already-filtered model text — only when no hazard group is waiting and the output is idle. */
  private nextModelText(now: number, speaking: boolean): Utterance | null {
    this.contextQueue = this.contextQueue.filter((c) => c.expiresAt > now); // stale answers are never spoken
    const item = this.contextQueue[0];
    if (!item || speaking) return null;
    const gap = item.kind === 'answer' ? ANSWER_GAP_MS : MIN_GAP_MS.P3;
    if (now - this.lastSpokenAt < gap) return null;
    this.contextQueue.shift();
    return this.emit({ text: item.text, tier: 'P3', earcon: null, vibrate: null, interrupt: false, ids: [] }, now);
  }

  private emit(u: Utterance, now: number): Utterance {
    this.lastSpokenAt = now;
    this.current = u.tier;
    return u;
  }

  /** Highest-priority group still worth saying. */
  private pick(now: number): Group | null {
    const { preset, maxAgeMs, objectCooldownMs, groupCooldownMs, lowConfidence } = this.opts;
    const live = this.candidates.filter((c) => {
      if (c.tier === 'SYS' || c.type === 'system') return false;
      if (now - c.observedAt > maxAgeMs) return false; // stale (SAF-22)
      if (!tierAllowed(c.tier, preset)) return false; // P0 floor inside tierAllowed (ADR-026)
      if (c.confidence < lowConfidence && (c.tier === 'P2' || c.tier === 'P3')) return false; // low + far → drop
      const said = this.spokenObject.get(c.id);
      // Hysteresis: re-alert the same object only when it escalates, or after the cool-down.
      if (said && RANK[c.tier] >= RANK[said.tier] && now - said.at < objectCooldownMs) return false;
      return true;
    });
    // Merge (rule 3): same tier + type + side; people merge across sides (a crowd is one situation, named by the nearest
    // person's side or "around"). Uncertain items join their type's group; "possible" only when all are uncertain.
    const groups = new Map<string, Group>();
    for (const c of [...live].sort((a, b) => a.ttcSeconds - b.ttcSeconds)) {
      const type = c.type as HazardType;
      const side = sideOf(c.bearingDeg);
      const low = c.confidence < lowConfidence;
      const key = `${c.tier}|${type}|${type === 'person' ? '*' : side}`;
      const g = groups.get(key) ?? { key, tier: c.tier, type, side, items: [], ttc: Infinity, lowConfidence: true };
      if (g.items.length > 0 && g.side !== side) g.side = 'around';
      g.items.push(c);
      g.ttc = Math.min(g.ttc, c.ttcSeconds);
      g.lowConfidence &&= low;
      groups.set(key, g);
    }
    const ranked = [...groups.values()]
      .filter((g) => {
        const at = this.spokenGroup.get(g.key);
        // Tracker ID churn: same thing under a new ID. P0 never waits on a group cool-down shorter than its own.
        return at === undefined || now - at >= (g.tier === 'P0' ? groupCooldownMs / 2 : groupCooldownMs);
      })
      .sort((a, b) => RANK[a.tier] - RANK[b.tier] || a.ttc - b.ttc || severity(a.type) - severity(b.type));
    return ranked[0] ?? null;
  }
}
