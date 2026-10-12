// Owner phone test 2026-10-13: an answer was cut off by a "near" alert repeating the same thing.
import { describe, expect, it } from 'vitest';
import { AlertManager, remainingAfter } from './alerts.js';
import type { AlertCandidate } from './types.js';

const cand = (p: Partial<AlertCandidate> & Pick<AlertCandidate, 'tier'>, now: number): AlertCandidate => ({
  id: `c-${p.tier}-${now}`, type: 'obstruction', ttcSeconds: 3, bearingDeg: 0, inPath: true, confidence: 0.9, source: 'on_device', observedAt: now, ...p,
});
const ANSWER = 'There is a pole ahead on the right. The footpath continues past a bus stop.';

function speakingAnswer() {
  const m = new AlertManager();
  m.modelText(ANSWER, 0, { kind: 'answer' });
  const u = m.next(2000)!;
  expect(u.kind).toBe('answer');
  return m;
}

describe('answers to a question', () => {
  it('a "near" (P1) alert waits for the answer to finish instead of cutting it', () => {
    const m = speakingAnswer();
    m.update([cand({ tier: 'P1' }, 2500)]);
    expect(m.next(2500, true)).toBeNull();
    m.finished();
    m.update([cand({ tier: 'P1' }, 3600)]); // the next frame still sees it
    expect(m.next(3600)!.tier).toBe('P1'); // after the normal 1.5 s gap
  });

  it('an imminent (P0) alert still interrupts the answer at once', () => {
    const m = speakingAnswer();
    m.update([cand({ tier: 'P0' }, 2500)]);
    const u = m.next(2500, true)!;
    expect(u.tier).toBe('P0');
    expect(u.interrupt).toBe(true);
  });

  it('after a P0 interruption the unheard part of the answer resumes', () => {
    const m = speakingAnswer();
    m.resumeAnswer(ANSWER, 45, 2500); // cut inside the second sentence
    m.update([cand({ tier: 'P0' }, 2500)]);
    expect(m.next(2500, true)!.tier).toBe('P0');
    m.finished();
    m.update([]);
    expect(m.next(4500)!.text).toBe('The footpath continues past a bus stop.');
  });

  it('a stale answer is not resumed (SAF-22)', () => {
    const m = speakingAnswer();
    m.resumeAnswer(ANSWER, 45, 20_000);
    m.finished();
    expect(m.next(20_500)).toBeNull();
  });

  it('a P1 still cuts ambient context (only answers are protected)', () => {
    const m = new AlertManager({ preset: 'detailed' });
    m.modelText('Wet surface.', 0, { kind: 'context' });
    expect(m.next(7000)!.kind).toBe('context');
    m.update([cand({ tier: 'P1' }, 8600)]);
    expect(m.next(8600, true)?.tier).toBe('P1'); // still speaking the context, past the 1.5 s gap
  });
});

describe('repeat', () => {
  it('says the last spoken words again; nothing to repeat at the start', () => {
    const m = new AlertManager();
    expect(m.repeat()).toBe(false);
    m.update([cand({ tier: 'P1' }, 0)]);
    const first = m.next(0)!.text;
    m.finished();
    expect(m.repeat()).toBe(true);
    expect(m.next(500)!.text).toBe(first);
  });
});

describe('remainingAfter', () => {
  it('restarts from the sentence being spoken; unknown progress → whole text', () => {
    expect(remainingAfter(ANSWER, 10)).toBe(ANSWER);
    expect(remainingAfter(ANSWER, 45)).toBe('The footpath continues past a bus stop.');
    expect(remainingAfter(ANSWER, 0)).toBe(ANSWER);
  });
});
