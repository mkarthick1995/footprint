import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  applyObservation,
  bearingTo,
  COMMUNITY_TYPES_VALID,
  distanceM,
  geohash,
  nearestCluster,
  newHazard,
  offsetPoint,
  parseObservation,
  probability,
  releasable,
  statusOf,
  toPublic,
  type ObservationInput,
} from './community.js';

const DAY = 24 * 3600_000;
const base = { lat: 1.28, lng: 103.85 }; // Singapore
const obs = (p: Partial<ObservationInput> = {}): ObservationInput => ({
  type: 'pothole', ...base, accuracyM: 8, confidence: 0.9, source: 'scan', ...p,
});

describe('parseObservation', () => {
  it('accepts a valid observation', () => {
    expect(parseObservation(obs())).toEqual(obs());
  });
  it('rejects bad GPS accuracy (> 25 m), moving types, bad coordinates, and notSeen without a hazard', () => {
    expect(parseObservation(obs({ accuracyM: 40 }))).toBeNull();
    expect(parseObservation({ ...obs(), type: 'person' })).toBeNull();
    expect(parseObservation(obs({ lat: 95 }))).toBeNull();
    expect(parseObservation(obs({ lat: 0, lng: 0 }))).toBeNull();
    expect(parseObservation(obs({ notSeen: true }))).toBeNull();
    expect(parseObservation({ ...obs(), confidence: '0.9' })).toBeNull();
    expect(parseObservation(null)).toBeNull();
  });
  it('drops unknown fields (nothing else is stored)', () => {
    expect(parseObservation({ ...obs(), name: 'Alice', phone: '123' })).toEqual(obs());
  });
});

describe('geometry', () => {
  it('distance, bearing and offset agree', () => {
    const p = offsetPoint(base, 90, 100);
    expect(distanceM(base, p)).toBeCloseTo(100, 0);
    expect(bearingTo(base, p)).toBeCloseTo(90, 0);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
  });
  it('geohash matches the reference value', () => {
    expect(geohash({ lat: 57.64911, lng: 10.40744 }, 11)).toBe('u4pruydqqvj');
  });
  it('the hazard type lists agree', () => {
    expect(COMMUNITY_TYPES_VALID).toBe(true);
  });
});

describe('clustering (same type within 15 m)', () => {
  const h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
  it('joins a same-type observation 10 m away', () => {
    expect(nearestCluster([h], obs(offsetPoint(base, 0, 10)), 0)?.id).toBe('h1aaaaaaaa');
  });
  it('starts a new hazard 20 m away or for a different type', () => {
    expect(nearestCluster([h], obs(offsetPoint(base, 0, 20)), 0)).toBeNull();
    expect(nearestCluster([h], obs({ type: 'open_drain' }), 0)).toBeNull();
  });
});

describe('evidence model (ADR-025)', () => {
  it('ST-18: one walk → unconfirmed; a second walk → confirmed', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    expect(h.status).toBe('unconfirmed');
    h = applyObservation(h, obs(), 'w2', DAY);
    expect(h.status).toBe('confirmed');
    expect(toPublic(h, DAY)).toMatchObject({ reports: 2, status: 'confirmed' });
  });

  it('the same walk scanning the pothole ten times still counts once', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    for (let i = 1; i <= 10; i++) h = applyObservation(h, obs(), 'w1', i * 1000);
    expect(h.seen).toEqual(['w1']);
    expect(h.status).toBe('unconfirmed');
  });

  it('two low-confidence walks are not enough; a third confirms', () => {
    let h = newHazard('h1aaaaaaaa', obs({ confidence: 0.55 }), 'w1', 0);
    h = applyObservation(h, obs({ confidence: 0.55 }), 'w2', 1000);
    expect(h.status).toBe('unconfirmed');
    h = applyObservation(h, obs({ confidence: 0.6 }), 'w3', 2000);
    expect(h.status).toBe('confirmed');
  });

  it('ST-30: a confirmed hazard survives one "not seen" walk; two expire it (SAF-29)', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    h = applyObservation(h, obs(), 'w2', 1000);
    h = applyObservation(h, obs({ notSeen: true, hazardId: 'h1aaaaaaaa' }), 'w3', 2000);
    expect(h.status).toBe('confirmed');
    h = applyObservation(h, obs({ notSeen: true, hazardId: 'h1aaaaaaaa' }), 'w4', 3000);
    expect(h.status).toBe('expired');
  });

  it('a hazard seen by many walks needs more than two "not seen" walks', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    for (const w of ['w2', 'w3', 'w4']) h = applyObservation(h, obs(), w, 1000);
    for (const w of ['n1', 'n2']) h = applyObservation(h, obs({ notSeen: true, hazardId: 'h1aaaaaaaa' }), w, 2000);
    expect(h.status).toBe('confirmed');
  });

  it('a walker who saw it cannot also vote "not seen"', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    h = applyObservation(h, obs({ notSeen: true, hazardId: 'h1aaaaaaaa' }), 'w1', 1000);
    expect(h.notSeen).toEqual([]);
  });

  it('expires after its type TTL without fresh sightings (obstruction 3 days, pothole 30)', () => {
    const o = newHazard('h2aaaaaaaa', obs({ type: 'obstruction' }), 'w1', 0);
    expect(statusOf(o, 4 * DAY)).toBe('expired');
    let p = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    p = applyObservation(p, obs(), 'w2', 1000);
    expect(statusOf(p, 20 * DAY)).toBe('confirmed');
    expect(statusOf(p, 31 * DAY)).toBe('expired');
  });

  it('old evidence fades toward "no opinion"', () => {
    let h = newHazard('h1aaaaaaaa', obs(), 'w1', 0);
    h = applyObservation(h, obs(), 'w2', 0);
    const fresh = probability(h);
    const later = applyObservation(h, obs({ notSeen: true, hazardId: 'h1aaaaaaaa' }), 'n1', 25 * DAY);
    expect(probability(later)).toBeLessThan(fresh);
  });

  it('public view hides walk hashes and evidence internals', () => {
    const pub = toPublic(newHazard('h1aaaaaaaa', obs(), 'w1', 0), 0) as unknown as Record<string, unknown>;
    expect(Object.keys(pub).sort()).toEqual(['id', 'lastSeen', 'lat', 'lng', 'reports', 'status', 'type']);
  });
});

describe('privacy trimming (PRI-04)', () => {
  const start = base;
  it('nothing within 200 m of the walk start is released', () => {
    const p = offsetPoint(start, 0, 150);
    expect(releasable(p, start, offsetPoint(start, 0, 600))).toBe(false);
  });
  it('a point is released only after the walker is 200 m past it', () => {
    const p = offsetPoint(start, 0, 300);
    expect(releasable(p, start, offsetPoint(start, 0, 400))).toBe(false); // 100 m past — could be the trip end
    expect(releasable(p, start, offsetPoint(start, 0, 520))).toBe(true);
  });
});
