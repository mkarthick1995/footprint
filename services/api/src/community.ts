// Community hazards API (R2.3, ADR-020/025): POST /api/observations and GET /api/hazards?bbox=.
// Firestore (asia-southeast1) written only by this service. Raw observations expire after 7 days (Firestore TTL on
// `expireAt`); hazard clusters keep evidence, never identities: walk IDs are stored as per-hazard hashes, so two
// hazards can't be linked into one person's route (PRI-04). Nothing here logs coordinates or session IDs (PRI-06).
import { createHash, randomBytes } from 'node:crypto';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import type { FastifyInstance } from 'fastify';
import {
  applyObservation,
  CLUSTER_RADIUS_M,
  latDegrees,
  nearestCluster,
  newHazard,
  OBSERVATION_TTL_MS,
  parseObservation,
  roundCoord,
  statusOf,
  toPublic,
  type HazardRecord,
  type ObservationInput,
} from '@footprint/shared';
import { MinuteLimiter } from './limits.js';

export interface StoredObservation {
  type: string;
  lat: number;
  lng: number;
  accuracyM: number;
  confidence: number;
  source: string;
  notSeen: boolean;
  hazardId: string;
  ts: number;
  expireAt: number;
}

export interface StoreTx {
  /** Hazards whose latitude is within ±dLat of `lat` (callers filter by exact distance and type). */
  near(lat: number, dLat: number): Promise<HazardRecord[]>;
  get(id: string): Promise<HazardRecord | null>;
  put(h: HazardRecord): void;
  addObservation(o: StoredObservation): void;
}

export interface HazardStore {
  transact<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>;
  /** Hazards in a latitude band (callers filter longitude and status). */
  latBand(minLat: number, maxLat: number): Promise<HazardRecord[]>;
}

/** In-memory store for tests and local development without Firestore. */
export class MemoryStore implements HazardStore {
  readonly hazards = new Map<string, HazardRecord>();
  readonly observations: StoredObservation[] = [];
  async transact<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
    const writes: HazardRecord[] = [];
    const obs: StoredObservation[] = [];
    const out = await fn({
      near: async (lat, d) => [...this.hazards.values()].filter((h) => Math.abs(h.lat - lat) <= d),
      get: async (id) => this.hazards.get(id) ?? null,
      put: (h) => writes.push(h),
      addObservation: (o) => obs.push(o),
    });
    for (const h of writes) this.hazards.set(h.id, h);
    this.observations.push(...obs);
    return out;
  }
  async latBand(minLat: number, maxLat: number): Promise<HazardRecord[]> {
    return [...this.hazards.values()].filter((h) => h.lat >= minLat && h.lat <= maxLat);
  }
}

/** Firestore store: `hazards/{id}` and `observations/{auto}` (TTL policy on `expireAt`). */
export class FirestoreStore implements HazardStore {
  private readonly db: Firestore;
  constructor(projectId = process.env.GOOGLE_CLOUD_PROJECT) {
    this.db = new Firestore({ projectId, ignoreUndefinedProperties: true });
  }
  async transact<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
    const hazards = this.db.collection('hazards');
    const observations = this.db.collection('observations');
    return this.db.runTransaction(async (t) => {
      const puts: HazardRecord[] = [];
      const obs: StoredObservation[] = [];
      const out = await fn({
        near: async (lat, d) =>
          (await t.get(hazards.where('lat', '>=', lat - d).where('lat', '<=', lat + d))).docs.map((x) => x.data() as HazardRecord),
        get: async (id) => {
          const snap = await t.get(hazards.doc(id));
          return snap.exists ? (snap.data() as HazardRecord) : null;
        },
        put: (h) => puts.push(h),
        addObservation: (o) => obs.push(o),
      });
      for (const h of puts) t.set(hazards.doc(h.id), h);
      for (const o of obs) t.create(observations.doc(), { ...o, expireAt: Timestamp.fromMillis(o.expireAt) });
      return out;
    });
  }
  async latBand(minLat: number, maxLat: number): Promise<HazardRecord[]> {
    const snap = await this.db.collection('hazards').where('lat', '>=', minLat).where('lat', '<=', maxLat).limit(500).get();
    return snap.docs.map((d) => d.data() as HazardRecord);
  }
}

/** Per-hazard hash of a walk ID: counts distinct walks without linking hazards to each other. */
export function walkHash(sessionId: string, hazardId: string): string {
  return createHash('sha256').update(`${sessionId}:${hazardId}`).digest('hex').slice(0, 16);
}

/** Cluster → evidence → store one observation (ADR-020/025). Returns the updated hazard. */
export async function ingest(store: HazardStore, obs: ObservationInput, sessionId: string, now: number): Promise<HazardRecord | null> {
  return store.transact(async (tx) => {
    let hazard: HazardRecord | null;
    if (obs.notSeen) {
      const h = await tx.get(obs.hazardId!);
      if (!h || h.type !== obs.type) return null; // unknown hazard: nothing to refute
      hazard = applyObservation(h, obs, walkHash(sessionId, h.id), now);
    } else {
      const candidates = await tx.near(obs.lat, latDegrees(CLUSTER_RADIUS_M) * 1.2);
      const near = nearestCluster(candidates, obs, now);
      hazard = near
        ? applyObservation(near, obs, walkHash(sessionId, near.id), now)
        : (() => {
            const id = randomBytes(10).toString('hex');
            return newHazard(id, obs, walkHash(sessionId, id), now);
          })();
    }
    tx.put(hazard);
    tx.addObservation({
      type: obs.type,
      lat: roundCoord(obs.lat),
      lng: roundCoord(obs.lng),
      accuracyM: Math.round(obs.accuracyM),
      confidence: Math.round(obs.confidence * 100) / 100,
      source: obs.source,
      notSeen: obs.notSeen === true,
      hazardId: hazard.id,
      ts: now,
      expireAt: now + OBSERVATION_TTL_MS,
    });
    return hazard;
  });
}

/** Largest bbox side the hazards endpoint serves (~5.5 km): bounded reads, no whole-map scraping. */
export const MAX_BBOX_DEG = 0.05;
const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/;

export function parseBbox(raw: unknown): { minLat: number; minLng: number; maxLat: number; maxLng: number } | null {
  if (typeof raw !== 'string') return null;
  const n = raw.split(',').map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [minLat, minLng, maxLat, maxLng] = n as [number, number, number, number];
  if (!(minLat < maxLat && minLng < maxLng) || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (maxLat - minLat > MAX_BBOX_DEG || maxLng - minLng > MAX_BBOX_DEG) return null;
  return { minLat, minLng, maxLat, maxLng };
}

export interface CommunityOptions {
  store?: HazardStore;
  now?: () => number;
  perSessionPerMinute?: number;
  perClientPerMinute?: number;
}

export async function registerCommunity(app: FastifyInstance, opts: CommunityOptions = {}): Promise<void> {
  const now = opts.now ?? Date.now;
  let store = opts.store;
  const getStore = () => (store ??= new FirestoreStore());
  const perSession = new MinuteLimiter(opts.perSessionPerMinute ?? 20);
  const perClient = new MinuteLimiter(opts.perClientPerMinute ?? 60);

  app.post('/api/observations', async (req, reply) => {
    const session = req.headers['x-session-id'];
    if (typeof session !== 'string' || !SESSION_RE.test(session)) return reply.code(400).send({ error: 'session_id' });
    const obs = parseObservation(req.body);
    if (!obs) return reply.code(400).send({ error: 'invalid_observation' });
    const t = now();
    if (!perSession.allow(session, t) || !perClient.allow(req.ip, t)) return reply.code(429).send({ error: 'rate_limited' });
    try {
      const h = await ingest(getStore(), obs, session, t);
      if (!h) return reply.code(404).send({ error: 'unknown_hazard' });
      return { id: h.id, status: h.status };
    } catch (err) {
      req.log.warn({ code: 'observation_store_error', name: (err as Error)?.name }, 'observation not stored');
      return reply.code(503).send({ error: 'store_unavailable' });
    }
  });

  app.get('/api/hazards', async (req, reply) => {
    const box = parseBbox((req.query as Record<string, unknown>)?.bbox);
    if (!box) return reply.code(400).send({ error: 'bbox', max: MAX_BBOX_DEG });
    try {
      const t = now();
      const hazards = (await getStore().latBand(box.minLat, box.maxLat))
        .filter((h) => h.lng >= box.minLng && h.lng <= box.maxLng && statusOf(h, t) === 'confirmed')
        .map((h) => toPublic(h, t));
      reply.header('cache-control', 'public, max-age=30');
      return { hazards };
    } catch (err) {
      req.log.warn({ code: 'hazards_read_error', name: (err as Error)?.name }, 'hazards not read');
      return reply.code(503).send({ error: 'store_unavailable' });
    }
  });
}
