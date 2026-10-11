import { describe, expect, it } from 'vitest';
import { AlertManager, wordCount, WORD_CAP } from './alerts.js';
import { FALLBACK_TEXT } from './safetyFilter.js';
import type { AlertCandidate, Tier } from './types.js';

let seq = 0;
function cand(p: Partial<AlertCandidate> & { tier: Tier; type: AlertCandidate['type'] }, now = 1000): AlertCandidate {
  return { id: `m${++seq}`, ttcSeconds: 3, bearingDeg: 0, inPath: true, confidence: 0.8, source: 'on_device', observedAt: now, ...p };
}

describe('AlertManager.modelText — the only path for model-derived text (R1.7)', () => {
  it('speaks a clean answer as P3 when nothing else is pending', () => {
    const m = new AlertManager();
    const r = m.modelText('There is a footpath on your left.', 1000);
    expect(r.blocked).toBe(false);
    const u = m.next(1100)!;
    expect(u).toMatchObject({ text: 'There is a footpath on your left.', tier: 'P3', earcon: null, vibrate: null, interrupt: false });
  });

  it('ST-08 / ST-20: a crossing answer is replaced by the approved refusal before it can be spoken', () => {
    const m = new AlertManager();
    const r = m.modelText('Yes, it is safe to cross now.', 1000);
    expect(r.blocked).toBe(true);
    const u = m.next(1100)!;
    expect(u.text).toContain(FALLBACK_TEXT.crossing);
    expect(u.text).not.toMatch(/safe to cross|cross now/i);
  });

  it('nothing the model says is ever spoken verbatim if it is an all-clear (SAF-04)', () => {
    const m = new AlertManager();
    m.modelText('The path is clear.', 1000);
    expect(m.next(1100)!.text).toBe(FALLBACK_TEXT.all_clear);
  });

  it('unusable model output produces no speech at all', () => {
    const m = new AlertManager();
    m.modelText(undefined, 1000);
    m.modelText('', 1000);
    m.modelText({ text: 'x' }, 1000);
    expect(m.next(1100)).toBeNull();
  });

  it('a pending hazard is spoken first; the answer waits (ADR-022 rule 8)', () => {
    const m = new AlertManager();
    m.modelText('There is a footpath on your left.', 1000);
    m.update([cand({ tier: 'P1', type: 'person', ttcSeconds: 2 })]);
    const first = m.next(1100)!;
    expect(first.tier).toBe('P1');
    m.finished();
    m.update([]);
    // the 1.5 s answer gap after a spoken hazard
    expect(m.next(1500)).toBeNull();
    expect(m.next(2700)!.tier).toBe('P3');
  });

  it('is not spoken over something already being spoken, and is not cut by a lower tier', () => {
    const m = new AlertManager();
    m.modelText('There is a footpath on your left.', 1000);
    expect(m.next(1100, true)).toBeNull();
    expect(m.next(1200, false)!.tier).toBe('P3');
  });

  it('a P0 interrupts an answer that is being spoken', () => {
    const m = new AlertManager();
    m.modelText('There is a footpath on your left.', 1000);
    m.next(1100); // P3 now current
    m.update([cand({ tier: 'P0', type: 'pothole', ttcSeconds: 0.7 }, 1200)]);
    const u = m.next(1200, true)!;
    expect(u.tier).toBe('P0');
    expect(u.interrupt).toBe(true);
  });

  it('a stale answer is dropped, never spoken late (ST-23, SAF-22)', () => {
    const m = new AlertManager();
    m.modelText('There is a footpath on your left.', 1000, { ttlMs: 2000 });
    expect(m.next(3500)).toBeNull();
  });

  it('keeps only the latest two queued texts', () => {
    const m = new AlertManager();
    m.modelText('First answer here.', 1000);
    m.modelText('Second answer here.', 1000);
    m.modelText('Third answer here.', 1000);
    expect(m.next(1100)!.text).toBe('Second answer here.');
    m.finished();
    expect(m.next(4000)!.text).toBe('Third answer here.');
  });

  it('caps a long answer to two sentences (ADR-023)', () => {
    const m = new AlertManager();
    m.modelText('Footpath on the left. Surface is uneven. A bench is nearby. A shop is ahead.', 1000);
    expect(m.next(1100)!.text).toBe('Footpath on the left. Surface is uneven.');
  });

  it('caps a single over-long sentence at the P3 word limit', () => {
    const m = new AlertManager();
    const long = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ') + '.';
    m.modelText(long, 1000);
    const text = m.next(1100)!.text;
    expect(wordCount(text)).toBeLessThanOrEqual(WORD_CAP.P3);
  });

  it('ambient context obeys the preset; an answer to a question always may speak', () => {
    const standard = new AlertManager({ preset: 'standard' });
    standard.modelText('A bench is nearby.', 1000, { kind: 'context' });
    expect(standard.next(1100)).toBeNull();
    const detailed = new AlertManager({ preset: 'detailed' });
    detailed.modelText('A bench is nearby.', 1000, { kind: 'context' });
    expect(detailed.next(1100)!.text).toBe('A bench is nearby.');
    const essential = new AlertManager({ preset: 'essential' });
    essential.modelText('There is a footpath on your left.', 1000, { kind: 'answer' });
    expect(essential.next(1100)!.tier).toBe('P3');
  });

  it('context text is still filtered when the preset mutes it', () => {
    const m = new AlertManager({ preset: 'standard' });
    const r = m.modelText('The path is clear.', 1000, { kind: 'context' });
    expect(r.blocked).toBe(true);
    expect(r.reasons).toContain('all_clear');
  });

  it('reset() forgets queued model text', () => {
    const m = new AlertManager();
    m.modelText('There is a footpath on your left.', 1000);
    m.reset();
    expect(m.next(1100)).toBeNull();
  });
});
