import { describe, expect, it } from 'vitest';
import { tierAllowed, tierFor } from './tiers.js';

describe('tierFor (ADR-022)', () => {
  it('ranks a pothole 1 m ahead above a person 10 m ahead (ST-21)', () => {
    const pothole = tierFor(1 / 1.4, true, 1); // ~0.7 s
    const person = tierFor(10 / 2.8, true, 10); // ~3.6 s, both walking towards each other
    expect(pothole).toBe('P0');
    expect(person).toBe('P1');
  });

  it('ranks a fast cyclist 10 m away above a pothole 3 m away (ST-25)', () => {
    expect(tierFor(10 / 6.4, true, 10)).toBe('P1'); // ~1.6 s
    expect(tierFor(3 / 1.4, true, 3)).toBe('P1'); // ~2.1 s — same tier, ordered by TTC in the queue
  });

  it('treats anything under 2 m in path as imminent', () => {
    expect(tierFor(5, true, 1.5)).toBe('P0');
  });

  it('downgrades off-path items one tier', () => {
    expect(tierFor(1, false)).toBe('P1');
    expect(tierFor(3, false)).toBe('P2');
  });

  it('falls back to a cautious tier on invalid input (SAFETY.md §2)', () => {
    expect(tierFor(Number.NaN, true)).toBe('P1');
  });
});

describe('tierAllowed (ADR-026)', () => {
  it('never mutes P0 or SYS, even on the Essential preset (ST-29)', () => {
    expect(tierAllowed('P0', 'essential')).toBe(true);
    expect(tierAllowed('SYS', 'essential')).toBe(true);
  });

  it('mutes P2 and P3 on Essential, allows P3 only on Detailed', () => {
    expect(tierAllowed('P2', 'essential')).toBe(false);
    expect(tierAllowed('P2', 'standard')).toBe(true);
    expect(tierAllowed('P3', 'standard')).toBe(false);
    expect(tierAllowed('P3', 'detailed')).toBe(true);
  });
});
