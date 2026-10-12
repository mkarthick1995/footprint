// Q14: street-demand level (ADR-023) and presets with the P0/SYS floor (ADR-026).
import { describe, expect, it } from 'vitest';
import { AlertManager, DEMAND_HEADS_UP } from './alerts.js';
import type { AlertCandidate, HazardType, Tier } from './types.js';

let n = 0;
const cand = (tier: Tier, now: number, type: HazardType = 'obstruction', bearingDeg = 0): AlertCandidate => ({
  id: `d${n++}`, type, tier, ttcSeconds: tier === 'P0' ? 1 : 3, bearingDeg, inPath: true, confidence: 0.9, source: 'on_device', observedAt: now,
});

/** Feed one close hazard every `every` ms, of rotating types/sides so they are not merged or cooled down. */
function busyStreet(m: AlertManager, fromMs: number, count: number, every: number): string[] {
  const said: string[] = [];
  const types: HazardType[] = ['obstruction', 'vehicle', 'cyclist', 'person', 'street_furniture', 'pothole'];
  for (let i = 0; i < count; i++) {
    const t = fromMs + i * every;
    m.finished();
    m.update([cand('P1', t, types[i % types.length], (i % 3) * 30 - 30)]);
    const u = m.next(t);
    if (u?.text) said.push(u.text);
  }
  return said;
}

describe('street demand (ADR-023, ST-26)', () => {
  it('4 close warnings within 10 s → "Busy street" heads-up once, then quieter', () => {
    const m = new AlertManager();
    const said = busyStreet(m, 0, 4, 1600);
    expect(m.streetDemand).toBe('demanding');
    m.finished();
    expect(m.next(7000)!.text).toBe(DEMAND_HEADS_UP);
    expect(said.length).toBe(4);
  });

  it('while demanding: ahead-items (P2) are not worded; close ones at most every 3 s; P0 always', () => {
    const m = new AlertManager();
    busyStreet(m, 0, 4, 1600);
    m.finished();
    m.next(7000); // heads-up
    m.finished();
    m.update([cand('P2', 7100, 'pothole')]);
    expect(m.next(9500)).toBeNull();
    m.update([cand('P1', 9600, 'vehicle', 30)]);
    expect(m.next(9600)).toBeNull(); // < 3 s since the heads-up
    m.update([cand('P1', 10100, 'vehicle', 30)]);
    expect(m.next(10100)?.tier).toBe('P1');
    m.finished();
    m.update([cand('P0', 10200, 'cyclist')]);
    expect(m.next(10200)?.tier).toBe('P0');
  });

  it('back to normal after a quiet spell — silently', () => {
    const m = new AlertManager();
    busyStreet(m, 0, 4, 1600);
    m.finished();
    m.next(7000);
    m.finished();
    m.update([]);
    m.next(20_000);
    expect(m.streetDemand).toBe('demanding');
    expect(m.next(40_000)).toBeNull();
    expect(m.streetDemand).toBe('normal');
  });

  it('a calm street never switches', () => {
    const m = new AlertManager();
    busyStreet(m, 0, 4, 5000);
    expect(m.streetDemand).toBe('normal');
  });
});

describe('presets (ADR-026, ST-29)', () => {
  it('Essential mutes P2; P0 and SYS always speak; switching preset applies immediately', () => {
    const m = new AlertManager({ preset: 'essential' });
    m.update([cand('P2', 0, 'pothole')]);
    expect(m.next(0)).toBeNull();
    m.setPreset('standard');
    expect(m.preset).toBe('standard');
    m.update([cand('P2', 100, 'pothole')]);
    expect(m.next(100)?.tier).toBe('P2');
    m.setPreset('essential');
    m.finished();
    m.update([cand('P0', 5000, 'vehicle')]);
    expect(m.next(5000)?.tier).toBe('P0');
    m.finished();
    m.system('Camera stopped.');
    expect(m.next(5100)?.tier).toBe('SYS');
  });
});

describe('system messages queue instead of cutting each other off (found 10-13)', () => {
  it('a second system message waits for the first to finish', () => {
    const m = new AlertManager();
    m.system('Footprint started.');
    m.system('Alerts: Standard.');
    expect(m.next(0)!.text).toBe('Footprint started.');
    expect(m.next(100, true)).toBeNull();
    m.finished();
    expect(m.next(2000)!.text).toBe('Alerts: Standard.');
  });
  it('a system message still interrupts a hazard message below P0', () => {
    const m = new AlertManager();
    m.update([cand('P1', 0)]);
    expect(m.next(0)!.tier).toBe('P1');
    m.system('Camera stopped.');
    expect(m.next(100, true)).toMatchObject({ tier: 'SYS', interrupt: true });
  });
  it('an imminent (P0) alert interrupts a system message, which is replayed right after', () => {
    const m = new AlertManager();
    m.system('Footprint started.');
    expect(m.next(0)!.tier).toBe('SYS');
    m.update([cand('P0', 500, 'vehicle')]);
    expect(m.next(500, true)).toMatchObject({ tier: 'P0', interrupt: true });
    m.finished();
    m.update([]);
    expect(m.next(2000)!.text).toBe('Footprint started.');
  });
});
