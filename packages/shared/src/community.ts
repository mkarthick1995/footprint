// Community hazard map (R2.3, ADR-020/025): validation, geometry, clustering and the Beta evidence model. Pure —
// the API stores what these functions compute; the client uses the geometry and privacy trimming. No accounts, no images.
import { HAZARD_TYPES, type HazardType, type ObservationSource } from './types.js';

/** Static hazards worth sharing. People and vehicles move — they are never stored. */
export const COMMUNITY_TYPES = [
  'pothole',
  'open_drain',
  'drop_off',
  'speed_breaker',
  'obstruction',
  'street_furniture',
  'no_footpath',
  'crossing',
] as const satisfies readonly HazardType[];
export type CommunityType = (typeof COMMUNITY_TYPES)[number];

/** Observations worse than this GPS accuracy are dropped (ADR-020). */
export const MAX_ACCURACY_M = 25;
/** Same-type observations within this distance belong to one hazard (ADR-020). */
export const CLUSTER_RADIUS_M = 15;
/** Raw observations are deleted after this (Firestore TTL, ADR-020). */
export const OBSERVATION_TTL_MS = 7 * 24 * 3600_000;
/** Privacy: nothing is shared within this distance of where a walk starts or ends (PRI-04). */
export const TRIP_TRIM_M = 200;

/** How long a hazard stays on the map without fresh evidence, by type (days, ADR-020 — tune with data). */
export const HAZARD_TTL_DAYS: Readonly<Record<CommunityType, number>> = {
  pothole: 30,
  open_drain: 30,
  drop_off: 90,
  speed_breaker: 90,
  no_footpath: 90,
  crossing: 180,
  street_furniture: 14,
  obstruction: 3,
};

export interface LatLng {
  lat: number;
  lng: number;
}

/** A validated observation as accepted by the API (server adds time and session). */
export interface ObservationInput extends LatLng {
  type: CommunityType;
  accuracyM: number;
  confidence: number;
  source: Exclude<ObservationSource, 'user_report'> | 'user_report';
  /** "Passed this reported hazard and did not see it" (ADR-025). */
  notSeen?: boolean;
  /** Required with notSeen: which hazard was not seen. */
  hazardId?: string;
}

const isOneOf = <T extends string>(values: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (values as readonly string[]).includes(v);

/** Validate an untrusted observation body. Returns null when anything is off (the API answers 400). */
export function parseObservation(raw: unknown): ObservationInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const lat = num(o.lat);
  const lng = num(o.lng);
  const accuracyM = num(o.accuracyM);
  const confidence = num(o.confidence);
  if (!isOneOf(COMMUNITY_TYPES, o.type) || !isOneOf(['scan', 'on_device', 'user_report'] as const, o.source)) return null;
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || (lat === 0 && lng === 0)) return null;
  if (!(accuracyM > 0 && accuracyM <= MAX_ACCURACY_M) || !(confidence >= 0 && confidence <= 1)) return null;
  const notSeen = o.notSeen === true;
  const hazardId = typeof o.hazardId === 'string' && /^[a-z0-9]{8,40}$/.test(o.hazardId) ? o.hazardId : undefined;
  if (notSeen && !hazardId) return null;
  return { type: o.type, lat, lng, accuracyM, confidence, source: o.source, ...(notSeen ? { notSeen, hazardId } : {}) };
}

/** Round to a ~5 m grid so stored points are not more precise than needed (ADR-020). */
export function roundCoord(v: number): number {
  return Math.round(v / 0.00005) * 0.00005;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north (0..360). */
export function bearingTo(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point `distance` metres from `from` along `bearingDeg` (flat-earth approximation, fine below ~1 km). */
export function offsetPoint(from: LatLng, bearingDeg: number, distance: number): LatLng {
  const b = rad(bearingDeg);
  return {
    lat: from.lat + ((distance * Math.cos(b)) / R) * (180 / Math.PI),
    lng: from.lng + ((distance * Math.sin(b)) / (R * Math.cos(rad(from.lat)))) * (180 / Math.PI),
  };
}

/** Signed difference a − b in degrees, normalised to −180..180. */
export function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/** Degrees of latitude for a distance (for range queries). */
export function latDegrees(m: number): number {
  return (m / R) * (180 / Math.PI);
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Standard geohash (precision 8 ≈ 38 × 19 m). Stored for future range/segment queries (ADR-020). */
export function geohash(p: LatLng, precision = 8): string {
  let [latLo, latHi, lngLo, lngHi] = [-90, 90, -180, 180];
  let out = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (out.length < precision) {
    if (even) {
      const mid = (lngLo + lngHi) / 2;
      if (p.lng >= mid) ((ch = (ch << 1) | 1), (lngLo = mid));
      else ((ch <<= 1), (lngHi = mid));
    } else {
      const mid = (latLo + latHi) / 2;
      if (p.lat >= mid) ((ch = (ch << 1) | 1), (latLo = mid));
      else ((ch <<= 1), (latHi = mid));
    }
    even = !even;
    if (++bit === 5) {
      out += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return out;
}

// ---------- Evidence model (ADR-025) ----------

export type HazardStatus = 'unconfirmed' | 'confirmed' | 'expired';

/** Stored hazard cluster. `seen` / `notSeen` hold per-hazard hashes of walk IDs (can't be linked across hazards). */
export interface HazardRecord extends LatLng {
  id: string;
  type: CommunityType;
  geohash: string;
  alpha: number;
  beta: number;
  seen: string[];
  notSeen: string[];
  firstSeen: number;
  lastSeen: number;
  /** Last time any evidence (seen or not seen) arrived — evidence decays from here. */
  updatedAt: number;
  status: HazardStatus;
}

/** Prior: one pseudo-observation each way (p = 0.5, no opinion). */
export const PRIOR = 1;
export const CONFIRM_P = 0.7;
export const CONFIRM_WALKS = 2;
/**
 * Expiry needs ≥ 2 distinct not-seen walks AND the evidence tipped against the hazard (p < 0.5). ADR-025 said p < 0.3,
 * but with a Beta(1,1) prior two not-seen walks can never reach 0.3 against two sightings — refuted hazards would never
 * leave the map. A hazard seen by more walks needs proportionally more not-seen walks.
 */
export const EXPIRE_P = 0.5;
export const EXPIRE_NOT_SEEN_WALKS = 2;
/** Weight of one "not seen" walk. */
export const NOT_SEEN_WEIGHT = 1;
/** Max walk hashes kept per hazard (enough to count distinct walks; bounded document size). */
const MAX_WALKS = 30;

export function probability(h: Pick<HazardRecord, 'alpha' | 'beta'>): number {
  return h.alpha / (h.alpha + h.beta);
}

/** Evidence fades with age: half-life = the type's TTL / 2, pulling α and β back toward the prior. */
function decay(h: HazardRecord, now: number): Pick<HazardRecord, 'alpha' | 'beta'> {
  const halfLifeMs = (HAZARD_TTL_DAYS[h.type] * 24 * 3600_000) / 2;
  const f = Math.pow(0.5, Math.max(0, now - h.updatedAt) / halfLifeMs);
  return { alpha: PRIOR + (h.alpha - PRIOR) * f, beta: PRIOR + (h.beta - PRIOR) * f };
}

/**
 * Status from evidence. Asymmetric on purpose (SAF-29): confirmation needs p ≥ 0.7 from ≥ 2 distinct walks; a confirmed
 * hazard is removed only by ≥ 2 distinct "not seen" walks with p < 0.3, or by going stale for its type's TTL.
 */
export function statusOf(h: HazardRecord, now: number): HazardStatus {
  if (now - h.lastSeen > HAZARD_TTL_DAYS[h.type] * 24 * 3600_000) return 'expired';
  const p = probability(decay(h, now));
  if (h.notSeen.length >= EXPIRE_NOT_SEEN_WALKS && p < EXPIRE_P) return 'expired';
  if (h.status === 'confirmed') return 'confirmed';
  return p >= CONFIRM_P && h.seen.length >= CONFIRM_WALKS ? 'confirmed' : 'unconfirmed';
}

/** A new hazard from its first observation. */
export function newHazard(id: string, obs: ObservationInput, walk: string, now: number): HazardRecord {
  const p = { lat: roundCoord(obs.lat), lng: roundCoord(obs.lng) };
  const h: HazardRecord = {
    id,
    type: obs.type,
    ...p,
    geohash: geohash(p),
    alpha: PRIOR + obs.confidence,
    beta: PRIOR,
    seen: [walk],
    notSeen: [],
    firstSeen: now,
    lastSeen: now,
    updatedAt: now,
    status: 'unconfirmed',
  };
  return { ...h, status: statusOf(h, now) };
}

/**
 * Apply one observation from one walk. Each walk counts once per hazard (a walker's repeated scans of the same pothole
 * can't confirm it alone); a later observation from the same walk may only raise its weight to the higher confidence.
 * `walk` is the per-hazard hash of the walk ID.
 */
export function applyObservation(h: HazardRecord, obs: ObservationInput, walk: string, now: number): HazardRecord {
  if (statusOf(h, now) === 'expired' && !obs.notSeen) {
    // A fresh sighting of an expired hazard starts a new life for it.
    return { ...newHazard(h.id, obs, walk, now), firstSeen: h.firstSeen };
  }
  const d = decay(h, now);
  const next: HazardRecord = { ...h, ...d, updatedAt: now, seen: [...h.seen], notSeen: [...h.notSeen] };
  if (obs.notSeen) {
    if (!next.notSeen.includes(walk) && !next.seen.includes(walk)) {
      next.beta += NOT_SEEN_WEIGHT;
      next.notSeen = [...next.notSeen, walk].slice(-MAX_WALKS);
    }
  } else if (!next.seen.includes(walk)) {
    next.alpha += obs.confidence;
    next.seen = [...next.seen, walk].slice(-MAX_WALKS);
    next.lastSeen = now;
    // Move the location toward the evidence (running mean over distinct walks).
    const n = next.seen.length;
    next.lat = roundCoord(h.lat + (obs.lat - h.lat) / n);
    next.lng = roundCoord(h.lng + (obs.lng - h.lng) / n);
    next.geohash = geohash(next);
  } else {
    next.lastSeen = now; // same walk, seen again: still there, no extra weight
  }
  return { ...next, status: statusOf(next, now) };
}

/** Nearest same-type hazard within the cluster radius, or null. */
export function nearestCluster(hazards: readonly HazardRecord[], obs: ObservationInput, now: number): HazardRecord | null {
  let best: HazardRecord | null = null;
  let bestD = Infinity;
  for (const h of hazards) {
    if (h.type !== obs.type) continue;
    if (statusOf(h, now) === 'expired' && obs.notSeen) continue;
    const d = distanceM(h, obs);
    if (d <= CLUSTER_RADIUS_M && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/** What the API returns for the map / client (no walk hashes, no evidence internals). */
export interface PublicHazard extends LatLng {
  id: string;
  type: CommunityType;
  reports: number;
  lastSeen: number;
  status: HazardStatus;
}

export function toPublic(h: HazardRecord, now: number): PublicHazard {
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  return { id: h.id, type: h.type, lat: r5(h.lat), lng: r5(h.lng), reports: h.seen.length, lastSeen: h.lastSeen, status: statusOf(h, now) };
}

// ---------- Client-side privacy trimming (PRI-04) ----------

/**
 * An observation may leave the phone only when its point is ≥ 200 m from where the walk started AND the walker has
 * since moved ≥ 200 m away from it. If the walk ends within 200 m, it is never sent — so neither end of a trip (home,
 * work) is ever reported.
 */
export function releasable(point: LatLng, walkStart: LatLng, current: LatLng, trimM = TRIP_TRIM_M): boolean {
  return distanceM(point, walkStart) >= trimM && distanceM(point, current) >= trimM;
}

/** Hazard types known to `HAZARD_TYPES` (guards against drift between the two lists). */
export const COMMUNITY_TYPES_VALID = COMMUNITY_TYPES.every((t) => (HAZARD_TYPES as readonly string[]).includes(t));
