// Route summary (Q11 lite, R2.1/R2.5, ADR-021/027): a walking route from Google Routes API is used only to look up
// community hazards along it and speak a short summary. No turn-by-turn (the user's navigation app does that). Absence
// of reports is never presented as good (SAF-20, ST-19). Pure and tested.
import { distanceM, type LatLng, type PublicHazard } from './community.js';

/** Hazards within this distance of the route line count as "along the route". */
export const ROUTE_CORRIDOR_M = 25;
/** Longest walking route we summarise (and query hazards for). */
export const MAX_ROUTE_M = 5000;

/** Google encoded polyline → points. */
export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < encoded.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lng += d;
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/** Distance (m) from a point to a polyline, and how far along the line its closest point is. */
export function distanceToRoute(p: LatLng, line: readonly LatLng[]): { distance: number; alongM: number } {
  if (line.length === 0) return { distance: Infinity, alongM: 0 };
  if (line.length === 1) return { distance: distanceM(p, line[0]!), alongM: 0 };
  // Local equirectangular projection around p (fine for routes of a few km).
  const k = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q: LatLng) => ({ x: (q.lng - p.lng) * 111_320 * k, y: (q.lat - p.lat) * 110_540 });
  let best = { distance: Infinity, alongM: 0 };
  let walked = 0;
  for (let s = 0; s < line.length - 1; s++) {
    const a = xy(line[s]!), b = xy(line[s + 1]!);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
    const cx = a.x + t * dx, cy = a.y + t * dy;
    const d = Math.hypot(cx, cy);
    const segLen = Math.sqrt(len2);
    if (d < best.distance) best = { distance: d, alongM: walked + t * segLen };
    walked += segLen;
  }
  return best;
}

export interface RouteHazard extends PublicHazard {
  /** Metres from the start of the route. */
  alongM: number;
}

/** Confirmed hazards within the corridor, ordered along the route. */
export function hazardsAlongRoute(hazards: readonly PublicHazard[], line: readonly LatLng[], corridorM = ROUTE_CORRIDOR_M): RouteHazard[] {
  return hazards
    .filter((h) => h.status === 'confirmed')
    .map((h) => ({ h, r: distanceToRoute(h, line) }))
    .filter(({ r }) => r.distance <= corridorM)
    .sort((a, b) => a.r.alongM - b.r.alongM)
    .map(({ h, r }) => ({ ...h, alongM: Math.round(r.alongM) }));
}

/** Bounding box of a line, padded by `padM`. */
export function routeBox(line: readonly LatLng[], padM = ROUTE_CORRIDOR_M * 2): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const lats = line.map((p) => p.lat), lngs = line.map((p) => p.lng);
  const dLat = padM / 110_540;
  const dLng = padM / (111_320 * Math.cos(((lats[0] ?? 0) * Math.PI) / 180));
  return { minLat: Math.min(...lats) - dLat, minLng: Math.min(...lngs) - dLng, maxLat: Math.max(...lats) + dLat, maxLng: Math.max(...lngs) + dLng };
}

const NAME: Record<PublicHazard['type'], [string, string]> = {
  pothole: ['pothole', 'potholes'],
  open_drain: ['open drain', 'open drains'],
  drop_off: ['kerb or step', 'kerbs or steps'],
  speed_breaker: ['speed bump', 'speed bumps'],
  obstruction: ['obstruction', 'obstructions'],
  street_furniture: ['street obstacle', 'street obstacles'],
  no_footpath: ['stretch without footpath', 'stretches without footpath'],
  crossing: ['crossing', 'crossings'],
};

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function roundDistance(m: number): string {
  if (m < 1000) return `about ${Math.max(50, Math.round(m / 50) * 50)} metres`;
  return `about ${(Math.round(m / 100) / 10).toString()} kilometres`;
}

/** Destination as the user said it, made safe to speak (short, plain characters). */
export function cleanDestination(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s'&,.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/**
 * The spoken route summary (ADR-021): distance, time, reported hazards by type with the number of walkers, a cold-start
 * line when there are no reports — never "clear" or "safe" — and a pointer to the navigation app for turns (ADR-027).
 */
export function routeSummary(destination: string, distanceMeters: number, durationS: number, along: readonly RouteHazard[]): string {
  const minutes = Math.max(1, Math.round(durationS / 60));
  const head = `Walking route to ${cleanDestination(destination) || 'your destination'}: ${roundDistance(distanceMeters)}, ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  if (along.length === 0) {
    return `${head} No community reports along this route yet. That does not mean there are no hazards. Use your navigation app for turns.`;
  }
  const byType = new Map<PublicHazard['type'], number>();
  for (const h of along) byType.set(h.type, (byType.get(h.type) ?? 0) + 1);
  const parts = [...byType.entries()].map(([t, n]) => `${NUM[n] ?? n} ${n === 1 ? NAME[t][0] : NAME[t][1]}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  const first = along[0]!;
  const walkers = Math.max(...along.map((h) => h.reports));
  return `${head} Reported along it: ${list}. The first is ${roundDistance(first.alongM)} from the start. Reports from up to ${walkers} walkers. Use your navigation app for turns.`;
}

/** "Route to Chinatown MRT" / "directions to …" / "take me to …" spoken as a question → destination, else null. */
export function parseRouteRequest(question: string | undefined): string | null {
  if (!question) return null;
  const m = question.trim().match(/^(?:please\s+)?(?:route|directions?|walk(?:ing)?\s+route|take me|navigate|guide me|how (?:do|can) i (?:get|walk))\s+(?:me\s+)?to\s+(.+?)[.?!]*$/i);
  const dest = m ? cleanDestination(m[1]!) : '';
  return dest.length >= 2 ? dest : null;
}
