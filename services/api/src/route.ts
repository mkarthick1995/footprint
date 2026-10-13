// POST /api/route (Q11 lite, R2.1/R2.5, ADR-021/027): destination + current position → Google Routes API (walking) →
// confirmed community hazards along the line → spoken summary. The position and destination are used for this one
// request only — never stored or logged (PRI-04). No turn-by-turn: the user's navigation app does that.
import { GoogleAuth } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import {
  cleanDestination,
  decodePolyline,
  isLang,
  distanceM,
  hazardsAlongRoute,
  MAX_ROUTE_M,
  routeBox,
  routeSummary,
  statusOf,
  toPublic,
  type LatLng,
} from '@footprint/shared';
import type { HazardStore } from './community.js';
import { MinuteLimiter } from './limits.js';

export interface RouteResult {
  distanceMeters: number;
  durationS: number;
  encodedPolyline: string;
  /** The place the destination resolved to ("Bus stop, Raj Bhavan Rd"), spoken so the user can catch a wrong match. */
  placeName?: string;
}

/** Walking route lookup; null when Google finds no route. */
export type RouteFetcher = (origin: LatLng, destination: string, signal: AbortSignal) => Promise<RouteResult | null>;

/**
 * Places within this radius of the user are preferred when resolving a spoken name ("bus stop" → a nearby one).
 * Relevance ranking, not distance: distance ranking loosened the match ("metro station" returned a bus stop).
 */
const PLACE_BIAS_M = 3000;

/**
 * Google Places text search (nearest match first) + Routes API, with the runtime service account (OAuth) — the browser
 * Maps key is referrer-locked to our site. A bare name like "bus stop" used to geocode to an arbitrary far place
 * (test round 1, Hyderabad: always "more than 5 km"); resolving it near the user first fixes that.
 */
export function googleRoutesFetcher(env: NodeJS.ProcessEnv = process.env): RouteFetcher {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = env.GOOGLE_CLOUD_PROJECT ?? '';
  return async (origin, destination, signal) => {
    const token = await auth.getAccessToken();
    const place = await findPlace(token, project, origin, destination, signal);
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-goog-user-project': project,
        'x-goog-fieldmask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: place ? { placeId: place.id } : { address: destination },
        travelMode: 'WALK',
        languageCode: 'en',
      }),
    });
    if (!res.ok) throw new Error(`routes ${res.status}`);
    const body = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[] };
    const r = body.routes?.[0];
    if (!r?.polyline?.encodedPolyline) return null;
    return {
      distanceMeters: r.distanceMeters ?? 0,
      durationS: Number.parseInt(r.duration ?? '0', 10) || 0,
      encodedPolyline: r.polyline.encodedPolyline,
      ...(place ? { placeName: place.name } : {}),
    };
  };
}

/** Nearest place matching the words, or null (then the Routes API geocodes the words itself). */
async function findPlace(
  token: string | null | undefined,
  project: string,
  origin: LatLng,
  text: string,
  signal: AbortSignal,
): Promise<{ id: string; name: string } | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-goog-user-project': project,
      'x-goog-fieldmask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.location',
    },
    body: JSON.stringify({
      textQuery: text,
      locationBias: { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: PLACE_BIAS_M } },
      pageSize: 5,
      languageCode: 'en',
    }),
  });
  if (!res.ok) return null; // fall back to plain geocoding rather than failing the route
  type Place = { id?: string; displayName?: { text?: string }; formattedAddress?: string; primaryType?: string; location?: { latitude?: number; longitude?: number } };
  const places = ((await res.json()) as { places?: Place[] }).places ?? [];
  const p = nearestOfBestKind(places, origin);
  if (!p?.id) return null;
  return { id: p.id, name: placeLabel(p.displayName?.text, p.formattedAddress, p.primaryType) };
}

/** "Bus stop" + "Raj Bhavan Rd, Somajiguda, …" → "Bus stop, Raj Bhavan Rd": the name, plus the street when the address starts with one. */
/** The best match decides the kind of place; among results of that kind, the nearest wins ("bus stop" → closest stop). */
export function nearestOfBestKind<P extends { primaryType?: string; location?: { latitude?: number; longitude?: number } }>(
  places: readonly P[],
  origin: LatLng,
): P | undefined {
  const best = places[0];
  if (!best) return undefined;
  const dist = (q: P) =>
    q.location?.latitude === undefined || q.location.longitude === undefined
      ? Infinity
      : distanceM(origin, { lat: q.location.latitude, lng: q.location.longitude });
  return places
    .filter((q) => q.primaryType === best.primaryType)
    .reduce((a, q) => (dist(q) < dist(a) ? q : a), best);
}

const TYPE_WORDS: Record<string, string> = {
  bus_stop: 'bus stop',
  bus_station: 'bus station',
  subway_station: 'metro station',
  train_station: 'train station',
  light_rail_station: 'station',
  transit_station: 'station',
};

export function placeLabel(name: string | undefined, address: string | undefined, primaryType?: string): string {
  const first = (address ?? '').split(',')[0]?.trim() ?? '';
  const n = (name ?? '').trim();
  if (!n) return first;
  // A stop named after a landmark ("Satyam Theatre") must say what it is, or it sounds like the wrong place.
  const kind = primaryType ? TYPE_WORDS[primaryType] : undefined;
  if (kind) return n.toLowerCase().includes(kind.split(' ').at(-1)!) ? n : `${n} ${kind}`;
  const street = /\b(rd|road|st|street|marg|lane|ln|ave|avenue|nagar|gully|path|way|jalan|lorong|drive|dr)\b\.?$/i.test(first);
  const overlap = n.toLowerCase().includes(first.toLowerCase()) || first.toLowerCase().includes(n.toLowerCase());
  return street && !overlap ? `${n}, ${first}` : n;
}

export interface RouteOptions {
  fetcher?: RouteFetcher;
  store: () => HazardStore;
  perSessionPerMinute?: number;
  dailyCap?: number;
  now?: () => number;
}

const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/;

export function registerRoute(app: FastifyInstance, opts: RouteOptions): void {
  const now = opts.now ?? Date.now;
  const perSession = new MinuteLimiter(opts.perSessionPerMinute ?? 6);
  const dailyCap = opts.dailyCap ?? Number(process.env.ROUTE_DAILY_CAP || 500);
  let fetcher = opts.fetcher;
  let day = '';
  let today = 0;

  app.post('/api/route', async (req, reply) => {
    const session = req.headers['x-session-id'];
    if (typeof session !== 'string' || !SESSION_RE.test(session)) return reply.code(400).send({ error: 'session_id' });
    const b = (req.body ?? {}) as { destination?: unknown; origin?: { lat?: unknown; lng?: unknown }; lang?: unknown };
    const lang = isLang(b.lang) ? b.lang : 'en-IN';
    const destination = typeof b.destination === 'string' ? cleanDestination(b.destination) : '';
    const lat = Number(b.origin?.lat), lng = Number(b.origin?.lng);
    if (destination.length < 2 || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) {
      return reply.code(400).send({ error: 'invalid_route_request' });
    }
    const t = now();
    const d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) ((day = d), (today = 0));
    if (today >= dailyCap) return reply.code(503).send({ error: 'daily_cap' });
    if (!perSession.allow(session, t)) return reply.code(429).send({ error: 'rate_limited' });
    today++;
    fetcher ??= googleRoutesFetcher();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const route = await fetcher({ lat, lng }, destination, ctrl.signal);
      if (!route) return reply.code(404).send({ error: 'no_route' });
      if (route.distanceMeters > MAX_ROUTE_M) return reply.code(422).send({ error: 'too_far', distanceMeters: route.distanceMeters });
      const line = decodePolyline(route.encodedPolyline);
      const box = routeBox(line);
      const hazards = (await opts.store().latBand(box.minLat, box.maxLat))
        .filter((h) => h.lng >= box.minLng && h.lng <= box.maxLng && statusOf(h, t) === 'confirmed')
        .map((h) => toPublic(h, t));
      const along = hazardsAlongRoute(hazards, line);
      return {
        summary: routeSummary(route.placeName || destination, route.distanceMeters, route.durationS, along, lang),
        distanceMeters: route.distanceMeters,
        durationS: route.durationS,
        hazards: along,
      };
    } catch (err) {
      req.log.warn({ code: ctrl.signal.aborted ? 'route_timeout' : 'route_error', name: (err as Error)?.name }, 'route failed');
      return reply.code(502).send({ error: 'route_unavailable' });
    } finally {
      clearTimeout(timer);
    }
  });
}
