import { describe, expect, it } from 'vitest';
import { offsetPoint, type PublicHazard } from './community.js';
import { decodePolyline, distanceToRoute, hazardsAlongRoute, parseRouteRequest, routeBox, routeSummary } from './route.js';

const A = { lat: 1.3, lng: 103.8 };
const line = [A, offsetPoint(A, 0, 400), offsetPoint(offsetPoint(A, 0, 400), 90, 400)]; // 400 m north, then 400 m east
const hz = (p: Partial<PublicHazard> & { lat: number; lng: number }): PublicHazard => ({
  id: `h${Math.random().toString(16).slice(2, 12)}`, type: 'pothole', reports: 2, lastSeen: 0, status: 'confirmed', ...p,
});

describe('polyline', () => {
  it('decodes the Google reference example', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 },
    ]);
  });
  it('distance to the route and position along it', () => {
    const r = distanceToRoute(offsetPoint(offsetPoint(A, 0, 200), 90, 10), line);
    expect(r.distance).toBeCloseTo(10, 0);
    expect(r.alongM).toBeCloseTo(200, -1);
  });
});

describe('hazards along the route', () => {
  it('keeps confirmed hazards within 25 m, ordered from the start; drops far and unconfirmed ones', () => {
    const near1 = hz({ ...offsetPoint(A, 0, 300), type: 'open_drain' });
    const near2 = hz({ ...offsetPoint(offsetPoint(A, 0, 100), 90, 15) });
    const far = hz({ ...offsetPoint(offsetPoint(A, 0, 100), 90, 60) });
    const unconfirmed = hz({ ...offsetPoint(A, 0, 50), status: 'unconfirmed' });
    const along = hazardsAlongRoute([near1, far, near2, unconfirmed], line);
    expect(along.map((h) => h.id)).toEqual([near2.id, near1.id]);
    expect(along[0]!.alongM).toBeGreaterThan(90);
  });
  it('the route box covers the line', () => {
    const b = routeBox(line);
    expect(b.minLat).toBeLessThan(A.lat);
    expect(b.maxLng).toBeGreaterThan(line[2]!.lng);
  });
});

describe('route summary (ADR-021)', () => {
  it('ST-19: no reports → says so, never "safe" or "clear"', () => {
    const s = routeSummary('Chinatown MRT', 820, 660, []);
    expect(s).toBe('Walking route to Chinatown MRT: about 800 metres, 11 minutes. No community reports along this route yet. That does not mean there are no hazards. Use your navigation app for turns.');
    expect(s).not.toMatch(/\b(safe|clear)\b/i);
  });
  it('lists reported hazards by type, where the first one is, and the walker count', () => {
    const along = [
      { ...hz({ ...A, type: 'pothole', reports: 3 }), alongM: 120 },
      { ...hz({ ...A, type: 'no_footpath' }), alongM: 300 },
      { ...hz({ ...A, type: 'pothole' }), alongM: 450 },
    ];
    expect(routeSummary('the library', 1240, 1000, along)).toBe(
      'Walking route to the library: about 1.2 kilometres, 17 minutes. Reported along it: two potholes and one stretch without footpath. The first is about 100 metres from the start. Reports from up to 3 walkers. Use your navigation app for turns.',
    );
  });
  it('a destination with odd characters is spoken safely', () => {
    expect(routeSummary('<script>Bus stop</script>', 300, 240, [])).toMatch(/^Walking route to script Bus stop script:/);
  });
});

describe('route requests by voice', () => {
  it.each([
    ['Route to Chinatown MRT.', 'Chinatown MRT'],
    ['directions to the library', 'the library'],
    ['Take me to Bugis station', 'Bugis station'],
    ['How do I get to Marina Bay?', 'Marina Bay'],
  ])('%s → %s', (q, d) => expect(parseRouteRequest(q)).toBe(d));
  it('ordinary questions are not route requests', () => {
    for (const q of ["What's in front of me?", 'Is there a route sign?', 'Fewer alerts', undefined]) expect(parseRouteRequest(q)).toBeNull();
  });
});
