// Q7 client: trip-end privacy trimming (PRI-04), "reported" announcements only for hazards ahead (SAF-18),
// and "not seen" votes (ADR-025). Simulated walks with fake GPS and a fake server.
import { describe, expect, it, vi } from 'vitest';
import { AlertManager, offsetPoint, type LatLng, type PublicHazard, type ScanResult } from '@footprint/shared';
import { CommunityClient } from './community';

const START: LatLng = { lat: 1.3, lng: 103.8 };
const NORTH = 0;
const at = (m: number) => offsetPoint(START, NORTH, m);
const scan = (p: Partial<ScanResult> = {}): ScanResult => ({ hazards: [], footpath: 'present', surface: 'even', crossing: 'none', ...p });
const pothole = scan({ hazards: [{ type: 'pothole', direction: 'ahead', distance: 'very_close', confidence: 0.9 }] });

function setup(hazards: PublicHazard[] = []) {
  const posted: Record<string, unknown>[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).startsWith('/api/hazards')) return new Response(JSON.stringify({ hazards }), { status: 200 });
    posted.push(JSON.parse(String(init!.body)));
    return new Response('{}', { status: 200 });
  });
  let watcher: PositionCallback = () => {};
  const geolocation = {
    watchPosition: (ok: PositionCallback) => ((watcher = ok), 1),
    clearWatch: () => {},
  } as unknown as Geolocation;
  const c = new CommunityClient({ onLocationOff: () => {}, fetchImpl: fetchImpl as unknown as typeof fetch, geolocation });
  c.start();
  let t = 0;
  const walkTo = async (m: number, heading: number | null = NORTH) => {
    const p = at(m);
    t += 1000;
    watcher({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 6, heading, speed: heading === null ? 0 : 1.4 }, timestamp: t } as GeolocationPosition);
    await new Promise((r) => setTimeout(r, 0)); // let flush / refresh settle
  };
  return { c, posted, walkTo };
}

describe('privacy trimming on the phone (PRI-04)', () => {
  it('a pothole seen near the start is never sent', async () => {
    const { c, posted, walkTo } = setup();
    for (let m = 0; m <= 50; m += 10) await walkTo(m);
    c.onScan(pothole);
    for (let m = 60; m <= 700; m += 20) await walkTo(m);
    expect(posted).toEqual([]);
  });

  it('a pothole mid-walk is sent only once the walker is 200 m past it', async () => {
    const { c, posted, walkTo } = setup();
    for (let m = 0; m <= 300; m += 20) await walkTo(m);
    c.onScan(pothole);
    await walkTo(420);
    expect(posted).toEqual([]);
    await walkTo(520);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: 'pothole', source: 'scan', accuracyM: 6 });
    expect(Object.keys(posted[0]!).sort()).toEqual(['accuracyM', 'confidence', 'lat', 'lng', 'source', 'type']);
  });

  it('a walk that ends within 200 m of a sighting drops it (trip-end trim)', async () => {
    const { c, posted, walkTo } = setup();
    for (let m = 0; m <= 400; m += 20) await walkTo(m);
    c.onScan(pothole);
    await walkTo(500);
    c.stop();
    expect(posted).toEqual([]);
  });

  it('people, low-confidence and far items are never shared', async () => {
    const { c, posted, walkTo } = setup();
    for (let m = 0; m <= 300; m += 20) await walkTo(m);
    c.onScan(scan({ hazards: [
      { type: 'pothole', direction: 'ahead', distance: 'very_close', confidence: 0.4 },
      { type: 'open_drain', direction: 'left', distance: 'far', confidence: 0.9 },
    ] }));
    for (let m = 320; m <= 700; m += 20) await walkTo(m);
    expect(posted).toEqual([]);
  });
});

describe('hearing confirmed reports (SAF-18)', () => {
  const hz = (m: number, reports = 3): PublicHazard => ({ id: 'abcdef0123', type: 'pothole', ...at(m), reports, lastSeen: 0, status: 'confirmed' });

  it('a report 25 m ahead becomes a P2 candidate worded "reported", with the walker count', async () => {
    const { c, walkTo } = setup([hz(125)]);
    await walkTo(100);
    await walkTo(100);
    const cands = c.candidates();
    expect(cands).toHaveLength(1);
    expect(cands[0]).toMatchObject({ source: 'community', tier: 'P2', reports: 3 });
    const m = new AlertManager();
    m.update(cands);
    expect(m.next(cands[0]!.observedAt)!.text).toBe('Pothole reported ahead, 3 walkers');
  });

  it('a report behind the walker is not announced', async () => {
    const { c, walkTo } = setup([hz(90)]);
    await walkTo(80);
    await walkTo(100);
    expect(c.candidates()).toEqual([]);
  });

  it('without a heading only very close reports are announced, as "nearby"', async () => {
    const { c, walkTo } = setup([hz(110)]);
    await walkTo(100, null);
    expect(c.candidates()).toHaveLength(1);
    const m = new AlertManager();
    m.update(c.candidates());
    expect(m.next(performance.now())!.text).toBe('Pothole reported nearby, 3 walkers');
    const far = setup([hz(125)]);
    await far.walkTo(100, null);
    expect(far.c.candidates()).toEqual([]);
  });
});

describe('"not seen" votes (ADR-025)', () => {
  const hz: PublicHazard = { id: 'abcdef0123', type: 'pothole', ...at(400), reports: 2, lastSeen: 0, status: 'confirmed' };

  it('two fresh scans of the spot without the pothole → one not-seen vote, sent after the privacy trim', async () => {
    const { c, posted, walkTo } = setup([hz]);
    for (let m = 0; m <= 390; m += 20) await walkTo(m);
    await walkTo(392);
    c.onScan(scan());
    await walkTo(396);
    c.onScan(scan());
    for (let m = 420; m <= 640; m += 20) await walkTo(m);
    expect(posted).toEqual([expect.objectContaining({ type: 'pothole', notSeen: true, hazardId: 'abcdef0123' })]);
  });

  it('no vote when a scan did see it', async () => {
    const { c, posted, walkTo } = setup([hz]);
    for (let m = 0; m <= 390; m += 20) await walkTo(m);
    await walkTo(392);
    c.onScan(pothole);
    await walkTo(396);
    c.onScan(scan());
    for (let m = 420; m <= 640; m += 20) await walkTo(m);
    expect(posted.filter((p) => p.notSeen)).toEqual([]);
  });
});

describe('location permission and "no fix" (owner test 2026-10-14)', () => {
  const fakeGeo = () => {
    const calls: string[] = [];
    let fail: ((e: GeolocationPositionError) => void) | undefined;
    const geo = {
      getCurrentPosition: () => void calls.push('getCurrentPosition'),
      watchPosition: (_ok: PositionCallback, err?: PositionErrorCallback | null) => {
        fail = err ?? undefined;
        calls.push('watchPosition');
        return 1;
      },
      clearWatch: () => undefined,
    } as unknown as Geolocation;
    const error = (code: number) => fail?.({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
    return { geo, calls, error };
  };

  it('requestPermission asks for a position at once (inside the tap)', () => {
    const { geo, calls } = fakeGeo();
    CommunityClient.requestPermission(geo);
    expect(calls).toEqual(['getCurrentPosition']);
  });

  it('no position within the timeout → said once; denied → location off', () => {
    const { geo, error } = fakeGeo();
    const said: string[] = [];
    const c = new CommunityClient({ geolocation: geo, onLocationOff: () => said.push('off'), onNoFix: () => said.push('no fix') });
    c.start();
    error(3);
    error(3);
    expect(said).toEqual(['no fix']);
    error(1);
    expect(said).toEqual(['no fix', 'off']);
  });
});
