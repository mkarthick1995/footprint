import { describe, expect, it } from 'vitest';
import { offsetPoint } from '@footprint/shared';
import { MemoryStore } from './community.js';
import type { RouteFetcher } from './route.js';
import { buildServer } from './server.js';

const A = { lat: 1.3, lng: 103.8 };
/** Encode a polyline (Google algorithm) for a fake Routes response. */
function encode(points: { lat: number; lng: number }[]): string {
  let out = '', pl = 0, pg = 0;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (x >= 0x20) (s += String.fromCharCode((0x20 | (x & 0x1f)) + 63), (x >>= 5));
    return s + String.fromCharCode(x + 63);
  };
  for (const p of points) {
    const la = Math.round(p.lat * 1e5), lg = Math.round(p.lng * 1e5);
    out += enc(la - pl) + enc(lg - pg);
    pl = la; pg = lg;
  }
  return out;
}
const LINE = [A, offsetPoint(A, 0, 600)];

async function setup(fetcher: RouteFetcher) {
  const store = new MemoryStore();
  const app = await buildServer({ webDist: '/nonexistent', community: { store }, route: { fetcher } });
  const post = (b: object, session = 'route-walk-0001') => app.inject({ method: 'POST', url: '/api/route', payload: b, headers: { 'x-session-id': session } });
  const observe = (p: { lat: number; lng: number }, walk: string) =>
    app.inject({ method: 'POST', url: '/api/observations', payload: { type: 'pothole', ...p, accuracyM: 6, confidence: 0.9, source: 'scan' }, headers: { 'x-session-id': walk } });
  return { app, store, post, observe };
}

describe('POST /api/route (Q11 lite)', () => {
  it('ST-19: no community data → summary says so, never "safe"/"clear"', async () => {
    const { app, post } = await setup(async () => ({ distanceMeters: 610, durationS: 500, encodedPolyline: encode(LINE) }));
    const res = await post({ destination: 'Chinatown MRT', origin: A });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toMatch(/No community reports along this route yet/);
    expect(res.json().summary).not.toMatch(/\b(safe|clear)\b/i);
    await app.close();
  });

  it('a confirmed pothole beside the route is reported, with where it is', async () => {
    const { app, post, observe } = await setup(async () => ({ distanceMeters: 610, durationS: 500, encodedPolyline: encode(LINE) }));
    const p = offsetPoint(offsetPoint(A, 0, 300), 90, 8);
    await observe(p, 'walker-one-0001');
    await observe(p, 'walker-two-0002');
    const body = (await post({ destination: 'the library', origin: A })).json();
    expect(body.hazards).toHaveLength(1);
    expect(body.summary).toMatch(/Reported along it: one pothole\. The first is about 300 metres from the start\./);
    await app.close();
  });

  it('rejects bad input, too-long routes and missing routes; Routes errors → 502', async () => {
    const tooFar = await setup(async () => ({ distanceMeters: 9000, durationS: 7000, encodedPolyline: encode(LINE) }));
    expect((await tooFar.post({ destination: 'x', origin: A })).statusCode).toBe(400);
    expect((await tooFar.post({ destination: 'Far away', origin: { lat: 0, lng: 0 } })).statusCode).toBe(400);
    expect((await tooFar.post({ destination: 'Far away', origin: A })).statusCode).toBe(422);
    await tooFar.app.close();
    const none = await setup(async () => null);
    expect((await none.post({ destination: 'Nowhere', origin: A })).statusCode).toBe(404);
    await none.app.close();
    const broken = await setup(async () => { throw new Error('routes 500'); });
    expect((await broken.post({ destination: 'Somewhere', origin: A })).statusCode).toBe(502);
    await broken.app.close();
  });

  it('rate-limited per walk', async () => {
    const { app, post } = await setup(async () => ({ distanceMeters: 100, durationS: 80, encodedPolyline: encode(LINE) }));
    for (let i = 0; i < 6; i++) expect((await post({ destination: 'Shop', origin: A })).statusCode).toBe(200);
    expect((await post({ destination: 'Shop', origin: A })).statusCode).toBe(429);
    await app.close();
  });
});

describe('place label (spoken destination)', () => {
  it('adds the street, or what kind of stop it is', async () => {
    const { placeLabel } = await import('./route.js');
    expect(placeLabel('Bus stop', 'Raj Bhavan Rd, Somajiguda, Hyderabad')).toBe('Bus stop, Raj Bhavan Rd');
    expect(placeLabel('Joyalukkas', 'Building address, 1239/2, Amar House')).toBe('Joyalukkas');
    expect(placeLabel('Charminar', 'Charminar Rd, Char Kaman')).toBe('Charminar');
    expect(placeLabel(undefined, 'MG Road, Bengaluru')).toBe('MG Road');
    expect(placeLabel('Satyam Theatre', 'Ameerpet', 'bus_stop')).toBe('Satyam Theatre bus stop');
    expect(placeLabel('Ameerpet', 'Ameerpet', 'subway_station')).toBe('Ameerpet metro station');
    expect(placeLabel('Ameerpet Metro Station', 'x', 'subway_station')).toBe('Ameerpet Metro Station');
  });
});

describe('resolved place name is spoken', () => {
  it('uses the place the destination resolved to', async () => {
    const { app, post } = await setup(async () => ({ distanceMeters: 1200, durationS: 900, encodedPolyline: encode(LINE), placeName: 'Bus stop, Raj Bhavan Rd' }));
    expect((await post({ destination: 'bus stop', origin: A })).json().summary).toMatch(/^Walking route to Bus stop, Raj Bhavan Rd: about 1\.2 kilometres/);
    await app.close();
  });
});

describe('choosing among place results', () => {
  it('picks the nearest place of the best match kind', async () => {
    const { nearestOfBestKind } = await import('./route.js');
    const at = (m: number) => ({ latitude: A.lat + m / 110_540, longitude: A.lng });
    const places = [
      { id: 'far-stop', primaryType: 'bus_stop', location: at(850) },
      { id: 'cafe', primaryType: 'cafe', location: at(10) },
      { id: 'near-stop', primaryType: 'bus_stop', location: at(50) },
    ];
    expect(nearestOfBestKind(places, A)?.id).toBe('near-stop');
    expect(nearestOfBestKind([], A)).toBeUndefined();
  });
});
