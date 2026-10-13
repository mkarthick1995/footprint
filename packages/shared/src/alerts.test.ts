import { describe, expect, it } from 'vitest';
import { AlertManager, phraseFor, sideOf, WORD_CAP, wordCount } from './alerts.js';
import { HAZARD_TYPES, type AlertCandidate, type HazardType, type Tier } from './types.js';

let seq = 0;
function cand(p: Partial<AlertCandidate> & { tier: Tier; type: AlertCandidate['type'] }, now = 1000): AlertCandidate {
  return { id: `c${++seq}`, ttcSeconds: 3, bearingDeg: 0, inPath: true, confidence: 0.8, source: 'on_device', observedAt: now, ...p };
}

describe('AlertManager queue rules (ADR-022)', () => {
  it('ST-21: an imminent hazard is spoken before a person further away', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'person', ttcSeconds: 3.5 }), cand({ tier: 'P0', type: 'pothole', ttcSeconds: 0.7 })]);
    const u = m.next(1000)!;
    expect(u.tier).toBe('P0');
    expect(u.text).toBe('Stop! Pothole');
    expect(u.earcon).toBe('imminent');
    expect(u.vibrate).not.toBeNull();
  });

  it('ST-22: same type, tier and side merge into one message', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P2', type: 'pothole', ttcSeconds: 5 }), cand({ tier: 'P2', type: 'pothole', ttcSeconds: 6 })]);
    const u = m.next(1000)!;
    expect(u.text).toBe('Two potholes, ahead');
    expect(u.ids).toHaveLength(2);
    m.finished();
    expect(m.next(5000)).toBeNull(); // both covered — nothing left to repeat
  });

  it('a crowd collapses to one short message instead of a list (SAF-31)', () => {
    const m = new AlertManager();
    m.update(Array.from({ length: 6 }, (_, i) => cand({ tier: 'P1', type: 'person', ttcSeconds: 2 + i * 0.2, bearingDeg: -15 })));
    expect(m.next(1000)!.text).toBe('People close, left');
  });

  it('people on several sides merge into one "around" message; uncertain items join their type', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'person', bearingDeg: -20, ttcSeconds: 2 }), cand({ tier: 'P1', type: 'person', bearingDeg: 25, ttcSeconds: 3 })]);
    expect(m.next(1000)!.text).toBe('Two people close around');
    const m2 = new AlertManager();
    m2.update([cand({ tier: 'P1', type: 'person', bearingDeg: 20 }), cand({ tier: 'P1', type: 'person', bearingDeg: 22, confidence: 0.4 })]);
    expect(m2.next(1000)!.text).toBe('Two people close, right');
  });

  it('ST-24: candidates gone from the latest frame or older than 1 s are never spoken', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'person' }, 1000)]);
    m.update([]); // walked past it — the newest frame no longer has it
    expect(m.next(1100)).toBeNull();
    m.update([cand({ tier: 'P1', type: 'person' }, 1000)]);
    expect(m.next(2500)).toBeNull(); // stale: observed 1.5 s ago
  });

  it('ST-25: within a tier the lower time-to-contact goes first (cyclist before pothole)', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'pothole', ttcSeconds: 2.1 }), cand({ tier: 'P1', type: 'cyclist', ttcSeconds: 1.6, bearingDeg: 20 })]);
    expect(m.next(1000)!.text).toBe('Bike close, right');
  });

  it('equal TTC → more severe type first', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P2', type: 'person', ttcSeconds: 5 }), cand({ tier: 'P2', type: 'vehicle', ttcSeconds: 5, bearingDeg: 30 })]);
    expect(m.next(1000)!.text).toBe('Vehicle, right');
  });

  it('does not repeat the same object, but re-alerts when it escalates', () => {
    const m = new AlertManager();
    const p = cand({ tier: 'P2', type: 'person', ttcSeconds: 6 });
    m.update([p]);
    expect(m.next(1000)!.tier).toBe('P2');
    m.finished();
    m.update([{ ...p, observedAt: 5000 }]);
    expect(m.next(5000)).toBeNull(); // same tier within the cool-down
    m.update([{ ...p, tier: 'P1', ttcSeconds: 3, observedAt: 5100 }]);
    expect(m.next(5100)!.text).toBe('Person close ahead');
  });

  it('tracker ID churn: a "new" track of the same type/side/tier waits for the group cool-down', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'person' }, 1000)]);
    expect(m.next(1000)).not.toBeNull();
    m.finished();
    m.update([cand({ tier: 'P1', type: 'person' }, 2600)]);
    expect(m.next(2600)).toBeNull();
    m.update([cand({ tier: 'P1', type: 'person' }, 5100)]);
    expect(m.next(5100)).toBeNull(); // same situation, already worded: only a cue, and not within 10 s
    m.update([cand({ tier: 'P1', type: 'person' }, 11_100)]);
    expect(m.next(11_100)).toMatchObject({ text: '', earcon: 'near' });
  });

  it('P0 interrupts a lower message; P2 waits for silence and for its rate gap', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P2', type: 'vehicle', ttcSeconds: 8 }, 1000)]);
    expect(m.next(1000)!.interrupt).toBe(false);
    m.update([cand({ tier: 'P2', type: 'person', ttcSeconds: 7, bearingDeg: -30 }, 1200)]);
    expect(m.next(1200, true)).toBeNull(); // busy speaking P2
    m.update([cand({ tier: 'P0', type: 'person', ttcSeconds: 1 }, 1300)]);
    const u = m.next(1300, true)!;
    expect(u.tier).toBe('P0');
    expect(u.interrupt).toBe(true);
    m.finished();
    m.update([cand({ tier: 'P2', type: 'person', ttcSeconds: 7, bearingDeg: -30 }, 2000)]);
    expect(m.next(2000)).toBeNull(); // < 3 s since the last message
    m.update([cand({ tier: 'P2', type: 'person', ttcSeconds: 7, bearingDeg: -30 }, 4400)]);
    expect(m.next(4400)!.text).toBe('Person, left');
  });

  it('system messages go first and interrupt hazards below P0, but wait for an active P0', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P0', type: 'person', ttcSeconds: 1 })]);
    expect(m.next(1000)!.tier).toBe('P0');
    m.system('Camera stopped. Alerts are off.');
    expect(m.next(1100, true)).toBeNull(); // P0 still speaking
    m.finished();
    const s = m.next(1200)!;
    expect(s.tier).toBe('SYS');
    expect(s.earcon).toBe('system');
  });

  it('low confidence: close → "possible", far → dropped (cautious wins)', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P2', type: 'person', confidence: 0.3, ttcSeconds: 7 })]);
    expect(m.next(1000)).toBeNull();
    m.update([cand({ tier: 'P1', type: 'person', confidence: 0.3, bearingDeg: 25 })]);
    expect(m.next(1000)!.text).toBe('Possible person close, right');
  });

  it('presets: Essential mutes P2 but P0 and SYS can never be turned off (ADR-026, ST-29)', () => {
    const m = new AlertManager({ preset: 'essential' });
    m.update([cand({ tier: 'P2', type: 'vehicle', ttcSeconds: 6 })]);
    expect(m.next(1000)).toBeNull();
    m.update([cand({ tier: 'P0', type: 'vehicle', ttcSeconds: 1 })]);
    expect(m.next(1000)!.tier).toBe('P0');
    m.finished();
    m.system('Footprint paused. Alerts are off.');
    expect(m.next(1100)!.tier).toBe('SYS');
  });

  it('a recurring situation is worded once, then cued (P1, P0) or skipped (P2) (ADR-023, owner glasses test 10-14)', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P1', type: 'person', bearingDeg: 20 }, 1000)]);
    expect(m.next(1000)!.text).toBe('Person close, right');
    m.finished();
    m.update([cand({ tier: 'P1', type: 'person', bearingDeg: 20 }, 6000)]); // new track, same situation
    expect(m.next(6000)).toBeNull(); // cue at most every 10 s
    m.update([cand({ tier: 'P1', type: 'person', bearingDeg: 20 }, 11_000)]);
    expect(m.next(11_000)).toMatchObject({ text: '', earcon: 'near' });
    m.finished();
    m.update([cand({ tier: 'P2', type: 'vehicle', ttcSeconds: 7 }, 14_000)]);
    expect(m.next(14_000)!.text).toBe('Vehicle, ahead');
    m.finished();
    m.update([cand({ tier: 'P2', type: 'vehicle', ttcSeconds: 7 }, 19_000)]);
    expect(m.next(19_000)).toBeNull(); // P2 has no cue: nothing new to say
    m.update([cand({ tier: 'P0', type: 'person' }, 19_100)]);
    expect(m.next(19_100)!.text).toBe('Stop! Person');
    m.finished();
    m.update([cand({ tier: 'P0', type: 'person' }, 21_200)]); // same imminent situation again: no words
    expect(m.next(21_200)).toBeNull();
    m.update([cand({ tier: 'P0', type: 'person' }, 24_200)]);
    expect(m.next(24_200)).toMatchObject({ text: '', earcon: 'imminent', tier: 'P0' });
  });

  it('staring at one object for 20 s: "Stop!" once, then a cue every 5 s — never the words again', () => {
    const m = new AlertManager();
    const said: string[] = [];
    for (let t = 1000; t <= 21_000; t += 100) {
      m.update([cand({ tier: 'P0', type: 'unknown', ttcSeconds: Number.NaN, confidence: 0.4 }, t)]); // new ID each frame (worst case)
      const u = m.next(t);
      if (u) (said.push(u.text || '(cue)'), m.finished());
    }
    expect(said[0]).toBe('Stop! Obstacle');
    expect(said.filter((s) => s !== '(cue)')).toHaveLength(1);
    expect(said.length).toBeLessThanOrEqual(5);
  });

  it('out of view for 15 s, then back: worded again (a new encounter)', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P0', type: 'cyclist' }, 1000)]);
    expect(m.next(1000)!.text).toBe('Stop! Bike');
    m.finished();
    m.update([]);
    m.next(9000);
    m.update([cand({ tier: 'P0', type: 'cyclist' }, 16_500)]);
    expect(m.next(16_500)!.text).toBe('Stop! Bike');
  });

  it('Essential level: "near" warnings are a tone only; imminent ones keep their words', () => {
    const m = new AlertManager({ preset: 'essential' });
    m.update([cand({ tier: 'P1', type: 'person' }, 1000)]);
    expect(m.next(1000)).toMatchObject({ text: '', earcon: 'near' });
    m.finished();
    m.update([cand({ tier: 'P0', type: 'vehicle' }, 1200)]);
    expect(m.next(1200)!.text).toBe('Stop! Vehicle');
  });

  it('nothing to report → silence, never an all-clear', () => {
    const m = new AlertManager();
    m.update([]);
    expect(m.next(1000)).toBeNull();
  });
});

describe('wording', () => {
  it('direction buckets', () => {
    expect(sideOf(-25)).toBe('left');
    expect(sideOf(4)).toBe('ahead');
    expect(sideOf(18)).toBe('right');
  });

  it('every type, tier, side and count stays within the length caps and never says clear/safe/go', () => {
    const banned = /\b(clear|safe|go|cross)\b/i;
    for (const type of HAZARD_TYPES as readonly HazardType[]) {
      for (const tier of ['P0', 'P1', 'P2'] as const) {
        for (const side of ['left', 'ahead', 'right', 'around'] as const) {
          for (const n of [1, 2, 5]) {
            for (const lowConfidence of [false, true]) {
              const text = phraseFor({ tier, type, side, items: Array.from({ length: n }, () => cand({ tier, type })), lowConfidence });
              expect(wordCount(text), text).toBeLessThanOrEqual(WORD_CAP[tier]);
              expect(text).not.toMatch(banned);
            }
          }
        }
      }
    }
  });
});

describe('cues never cut speech (owner glasses test 2026-10-14)', () => {
  it('a repeat of an imminent situation waits for silence instead of interrupting', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P0', type: 'vehicle' }, 1000)]);
    expect(m.next(1000)!.text).toBe('Stop! Vehicle');
    m.finished();
    m.system('Footprint started. Keep using your cane.');
    expect(m.next(1500)!.tier).toBe('SYS');
    m.update([cand({ tier: 'P0', type: 'vehicle' }, 7000)]);
    expect(m.next(7000, true)).toBeNull(); // speaking: the cue doesn't cut the message
    m.finished();
    expect(m.next(7100)).toMatchObject({ text: '', earcon: 'imminent' });
  });
});

describe('imminent situations ignore the side', () => {
  it('"Stop! Obstacle" drifting from ahead to left as the user turns is one situation', () => {
    const m = new AlertManager();
    m.update([cand({ tier: 'P0', type: 'unknown', bearingDeg: 0 }, 1000)]);
    expect(m.next(1000)!.text).toBe('Stop! Obstacle');
    m.finished();
    m.update([cand({ tier: 'P0', type: 'unknown', bearingDeg: -30 }, 3000)]);
    expect(m.next(3000)).toBeNull(); // not worded again; a cue only after 5 s
  });
});

describe('phrases fetched at walk start (R3.4)', () => {
  it('covers every "Stop!" and the common near/ahead phrases, each once', async () => {
    const { commonAlertPhrases } = await import('./alerts.js');
    const p = commonAlertPhrases();
    expect(p).toContain('Stop! Bike');
    expect(p).toContain('Stop! Obstacle');
    expect(p).toContain('Person close, left');
    expect(p).toContain('Possible obstacle close ahead');
    expect(new Set(p).size).toBe(p.length);
    expect(p.length).toBeLessThan(60);
  });
});
