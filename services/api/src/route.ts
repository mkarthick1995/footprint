// POST /api/route (Q11 lite, R2.1/R2.5, ADR-021/027): destination + current position → Google Routes API (walking) →
// confirmed community hazards along the line → spoken summary. The position and destination are used for this one
// request only — never stored or logged (PRI-04). No turn-by-turn: the user's navigation app does that.
import { GoogleAuth } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import {
  cleanDestination,
  decodePolyline,
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
}

/** Walking route lookup; null when Google finds no route. */
export type RouteFetcher = (origin: LatLng, destination: string, signal: AbortSignal) => Promise<RouteResult | null>;

/** Google Routes API with the runtime service account (OAuth) — the browser Maps key is referrer-locked to our site. */
export function googleRoutesFetcher(env: NodeJS.ProcessEnv = process.env): RouteFetcher {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const project = env.GOOGLE_CLOUD_PROJECT ?? '';
  return async (origin, destination, signal) => {
    const token = await auth.getAccessToken();
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
        destination: { address: destination },
        travelMode: 'WALK',
        languageCode: 'en',
      }),
    });
    if (!res.ok) throw new Error(`routes ${res.status}`);
    const body = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[] };
    const r = body.routes?.[0];
    if (!r?.polyline?.encodedPolyline) return null;
    return { distanceMeters: r.distanceMeters ?? 0, durationS: Number.parseInt(r.duration ?? '0', 10) || 0, encodedPolyline: r.polyline.encodedPolyline };
  };
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
    const b = (req.body ?? {}) as { destination?: unknown; origin?: { lat?: unknown; lng?: unknown } };
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
        summary: routeSummary(destination, route.distanceMeters, route.durationS, along),
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
