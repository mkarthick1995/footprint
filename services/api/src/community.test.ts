import { describe, expect, it } from 'vitest';
import { MemoryStore, parseBbox, walkHash } from './community.js';
import { buildServer } from './server.js';

const DAY = 24 * 3600_000;
const body = (p: Record<string, unknown> = {}) => ({
  type: 'pothole', lat: 1.28, lng: 103.85, accuracyM: 8, confidence: 0.9, source: 'scan', ...p,
});

async function setup(extra: { perSessionPerMinute?: number } = {}) {
  const store = new MemoryStore();
  let clock = 1_000_000;
  const app = await buildServer({ webDist: '/nonexistent', community: { store, now: () => clock, ...extra } });
  const post = (b: unknown, session = 'walk-session-1') =>
    app.inject({ method: 'POST', url: '/api/observations', payload: b as object, headers: { 'x-session-id': session } });
  const get = (bbox: string) => app.inject({ method: 'GET', url: `/api/hazards?bbox=${bbox}` });
  return { app, store, post, get, tick: (ms: number) => (clock += ms) };
}

const BOX = '1.27,103.84,1.29,103.86';

describe('POST /api/observations + GET /api/hazards', () => {
  it('ST-18: one walk → stored but not served; a second walk → confirmed and served with its report count', async () => {
    const { app, store, post, get, tick } = await setup();
    expect((await post(body())).json()).toMatchObject({ status: 'unconfirmed' });
    expect((await get(BOX)).json().hazards).toEqual([]);
    tick(DAY);
    expect((await post(body({ lat: 1.28005 }), 'walk-session-2')).json()).toMatchObject({ status: 'confirmed' });
    const hazards = (await get(BOX)).json().hazards;
    expect(hazards).toHaveLength(1);
    expect(hazards[0]).toMatchObject({ type: 'pothole', reports: 2, status: 'confirmed' });
    expect(store.hazards.size).toBe(1);
    expect(store.observations).toHaveLength(2);
    await app.close();
  });

  it('ST-30 over the API: one "not seen" walk keeps it, two remove it from the served map', async () => {
    const { app, post, get } = await setup();
    const { id } = (await post(body())).json();
    await post(body(), 'walk-session-2');
    await post(body({ notSeen: true, hazardId: id }), 'walk-session-3');
    expect((await get(BOX)).json().hazards).toHaveLength(1);
    await post(body({ notSeen: true, hazardId: id }), 'walk-session-4');
    expect((await get(BOX)).json().hazards).toEqual([]);
    await app.close();
  });

  it('stores no identity: rounded coordinates, a 7-day expiry, and walk IDs only as per-hazard hashes', async () => {
    const { app, store, post } = await setup();
    await post(body({ lat: 1.2800123, lng: 103.8500456 }));
    const o = store.observations[0]!;
    expect(o.lat).toBeCloseTo(1.28, 4);
    expect(o.expireAt - o.ts).toBe(7 * DAY);
    expect(JSON.stringify(store.observations)).not.toContain('walk-session-1');
    const h = [...store.hazards.values()][0]!;
    expect(JSON.stringify(h)).not.toContain('walk-session-1');
    expect(h.seen).toEqual([walkHash('walk-session-1', h.id)]);
    expect(walkHash('walk-session-1', 'aaaaaaaaaa')).not.toBe(walkHash('walk-session-1', 'bbbbbbbbbb'));
    await app.close();
  });

  it('rejects bad input: missing session, poor GPS accuracy, people, unknown hazard for not-seen', async () => {
    const { app, post } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/observations', payload: body() })).statusCode).toBe(400);
    expect((await post(body({ accuracyM: 60 }))).statusCode).toBe(400);
    expect((await post(body({ type: 'person' }))).statusCode).toBe(400);
    expect((await post(body({ notSeen: true, hazardId: 'deadbeef00' }))).statusCode).toBe(404);
    await app.close();
  });

  it('rate-limits per walk (SEC-03)', async () => {
    const { app, post } = await setup({ perSessionPerMinute: 2 });
    expect((await post(body())).statusCode).toBe(200);
    expect((await post(body())).statusCode).toBe(200);
    expect((await post(body())).statusCode).toBe(429);
    await app.close();
  });

  it('bbox must be valid and at most ~5 km per side (no whole-map scraping)', async () => {
    const { app, get } = await setup();
    expect((await get('1,2,3')).statusCode).toBe(400);
    expect((await get('1.2,103.8,1.4,104.0')).statusCode).toBe(400);
    expect(parseBbox('1.27,103.84,1.29,103.86')).toEqual({ minLat: 1.27, minLng: 103.84, maxLat: 1.29, maxLng: 103.86 });
    await app.close();
  });
});
