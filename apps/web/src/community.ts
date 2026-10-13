// Community hazards on the phone (Q7, ADR-020/025): GPS while walking → scan findings become anonymous observations,
// released only away from both ends of the trip (PRI-04) → server clusters and confirms them → confirmed reports near
// the walker are spoken as "Pothole reported ahead, 3 walkers" (SAF-18). Passing a reported hazard that fresh scans
// don't see sends a "not seen" vote (ADR-025). No accounts; a new random walk ID per walk.
import {
  angleDiff,
  bearingTo,
  COMMUNITY_TYPES,
  distanceM,
  offsetPoint,
  releasable,
  type AlertCandidate,
  type CommunityType,
  type LatLng,
  type PublicHazard,
  type ScanResult,
} from '@footprint/shared';

/** Max GPS error for sharing or for direction-aware announcements (ADR-020). */
const MAX_ACCURACY_M = 25;
/** Below this speed the GPS course is noise; heading comes from recent movement instead. */
const MIN_SPEED_MPS = 0.5;
/** Confirmed reports closer than this are announced. */
export const ANNOUNCE_RADIUS_M = 30;
/** Without a known heading, only reports this close are announced, as "nearby". */
export const NEARBY_RADIUS_M = 12;
/** Re-fetch confirmed hazards after moving this far from the last fetch centre. */
const REFETCH_M = 200;
/** Half-size of the fetched box (~550 m around the walker; server max is 0.05°). */
const FETCH_HALF_DEG = 0.005;
const SCAN_DISTANCE_M = { very_close: 1.5, near: 4 } as const;
const SCAN_SIDE_DEG = { left: -30, ahead: 0, right: 30 } as const;

interface Fix extends LatLng {
  accuracy: number;
  ts: number;
}

interface PendingObservation {
  point: LatLng;
  body: Record<string, unknown>;
  createdAt: number;
}

export interface CommunityOptions {
  /** Fixed-wording problems (location denied) — the caller announces them. */
  onLocationOff: () => void;
  /** No position at all within the watch timeout (prompt dismissed or ignored, GPS indoors) — said once per walk. */
  onNoFix?: () => void;
  fetchImpl?: typeof fetch;
  geolocation?: Geolocation;
  now?: () => number;
}

/** Tracks one view of a reported hazard during a walk, for "not seen" votes (ADR-025). */
interface PassState {
  freshScansInView: number;
  sawIt: boolean;
  voted: boolean;
}

export class CommunityClient {
  private watchId: number | null = null;
  private noFixSaid = false;
  private fix: Fix | null = null;
  private walkStart: LatLng | null = null;
  private heading: number | null = null;
  private lastMovePoint: LatLng | null = null;
  private pending: PendingObservation[] = [];
  private hazards: PublicHazard[] = [];
  private fetchCentre: LatLng | null = null;
  private passes = new Map<string, PassState>();
  private session = '';
  private active = false;
  private lastGoodFixAt = 0;
  readonly stats = { queued: 0, sent: 0, failed: 0, notSeen: 0, hazardsNearby: 0 };

  constructor(private readonly opts: CommunityOptions) {}

  private get now(): number {
    return (this.opts.now ?? Date.now)();
  }

  /** Start a walk: ask for location (must follow a user gesture), new random walk ID. Clips have no location. */
  /**
   * Call synchronously inside the Start tap: asks for location permission while the tap still counts as a user
   * gesture. The walk's own watch starts later (after the camera and detector load); some browsers (Brave, owner
   * test 2026-10-14) never showed the prompt for that delayed request, so community reports silently stayed off.
   */
  static requestPermission(geolocation: Geolocation | undefined = typeof navigator !== 'undefined' ? navigator.geolocation : undefined): void {
    geolocation?.getCurrentPosition(() => undefined, () => undefined, { maximumAge: 60_000, timeout: 30_000 });
  }

  start(): void {
    this.stop();
    const geo = this.opts.geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
    if (!geo) {
      this.opts.onLocationOff();
      return;
    }
    this.active = true;
    this.noFixSaid = false;
    this.session = crypto.randomUUID();
    Object.assign(this.stats, { queued: 0, sent: 0, failed: 0, notSeen: 0, hazardsNearby: 0 });
    this.watchId = geo.watchPosition(
      (p) => this.onPosition(p),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.stop();
          this.opts.onLocationOff();
        } else if (err.code === err.TIMEOUT && this.lastGoodFixAt === 0 && !this.noFixSaid) {
          this.noFixSaid = true; // fail loud: never silently without location
          this.opts.onNoFix?.();
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 },
    );
  }

  /** End of walk: anything not yet released stays on the phone and is dropped — that is the trip-end trim (PRI-04). */
  stop(): void {
    if (this.watchId !== null) (this.opts.geolocation ?? navigator.geolocation).clearWatch(this.watchId);
    this.watchId = null;
    this.active = false;
    this.pending = [];
    this.fix = null;
    this.walkStart = null;
    this.heading = null;
    this.lastMovePoint = null;
    this.passes.clear();
  }

  /** Exposed for tests and the dev readout. */
  onPosition(p: GeolocationPosition): void {
    const c = p.coords;
    const fix: Fix = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, ts: p.timestamp };
    this.fix = fix;
    if (c.accuracy > MAX_ACCURACY_M) return;
    this.lastGoodFixAt = this.now;
    this.walkStart ??= { lat: fix.lat, lng: fix.lng };
    // Heading: GPS course while moving; otherwise the direction of the last ≥ 8 m of movement.
    if (c.heading !== null && Number.isFinite(c.heading) && (c.speed ?? 0) >= MIN_SPEED_MPS) this.heading = c.heading;
    if (!this.lastMovePoint) this.lastMovePoint = fix;
    else if (distanceM(this.lastMovePoint, fix) >= 8) {
      if (!(c.heading !== null && (c.speed ?? 0) >= MIN_SPEED_MPS)) this.heading = bearingTo(this.lastMovePoint, fix);
      this.lastMovePoint = fix;
    }
    void this.flush();
    if (!this.fetchCentre || distanceM(this.fetchCentre, fix) >= REFETCH_M) void this.refresh(fix);
    this.trackPasses(null);
  }

  /** Current position if GPS is good enough (≤ 25 m) and fresh, for the route summary (Q11). */
  currentFix(): LatLng | null {
    const f = this.fix;
    const age = this.gpsAge();
    return f && f.accuracy <= MAX_ACCURACY_M && age !== null && age < 30_000 ? { lat: f.lat, lng: f.lng } : null; // fresh (≤ 30 s) only
  }

  /** Hazards found along a planned route (corridor prefetch, ADR-020): announced as the walker gets near them. */
  addHazards(list: readonly PublicHazard[]): void {
    const known = new Set(this.hazards.map((h) => h.id));
    this.hazards = [...this.hazards, ...list.filter((h) => h.status === 'confirmed' && !known.has(h.id))];
  }

  /** ms since the last usable GPS fix (for the "location lost" warning); null when location isn't in use. */
  gpsAge(): number | null {
    if (!this.active) return null;
    return this.lastGoodFixAt ? this.now - this.lastGoodFixAt : null;
  }

  /** A fresh scan (≤ 2 s old) arrived: queue its static hazards as observations; count it for "not seen" votes. */
  onScan(scan: ScanResult): void {
    const fix = this.fix;
    if (!this.active || !fix || fix.accuracy > MAX_ACCURACY_M) return;
    for (const h of scan.hazards) {
      if (h.confidence < 0.6 || h.distance === 'far' || !(COMMUNITY_TYPES as readonly string[]).includes(h.type)) continue;
      // "Near" items need a heading to place them; very close ones are within GPS error of the walker anyway.
      if (h.distance === 'near' && this.heading === null) continue;
      const point = this.heading === null ? fix : offsetPoint(fix, this.heading + SCAN_SIDE_DEG[h.direction], SCAN_DISTANCE_M[h.distance]);
      this.queue(h.type as CommunityType, point, h.confidence, fix.accuracy);
    }
    if (scan.footpath === 'absent' || scan.footpath === 'blocked') this.queue('no_footpath', fix, 0.7, fix.accuracy);
    if (scan.crossing === 'zebra' || scan.crossing === 'signal') {
      const point = this.heading === null ? fix : offsetPoint(fix, this.heading, SCAN_DISTANCE_M.near);
      this.queue('crossing', point, 0.7, fix.accuracy);
    }
    this.trackPasses(scan);
  }

  /** Confirmed reports near the walker as alert candidates (P2, worded "reported" by the alert manager). */
  candidates(): AlertCandidate[] {
    const fix = this.fix;
    if (!fix || fix.accuracy > MAX_ACCURACY_M) return [];
    const out: AlertCandidate[] = [];
    let nearby = 0;
    for (const h of this.hazards) {
      const d = distanceM(fix, h);
      if (d > ANNOUNCE_RADIUS_M) continue;
      nearby++;
      let bearing = Number.NaN; // unknown direction → "nearby"
      if (this.heading !== null) {
        const rel = angleDiff(bearingTo(fix, h), this.heading);
        if (Math.abs(rel) > 60) continue; // beside or behind: already passed or not in the way
        bearing = rel;
      } else if (d > NEARBY_RADIUS_M) continue;
      out.push({
        id: `community:${h.id}`,
        type: h.type,
        tier: 'P2',
        ttcSeconds: d / 1.4,
        bearingDeg: bearing,
        inPath: Number.isNaN(bearing) || Math.abs(bearing) <= 20,
        confidence: 0.8,
        source: 'community',
        observedAt: performance.now(),
        reports: h.reports,
      });
    }
    this.stats.hazardsNearby = nearby;
    return out;
  }

  private queue(type: CommunityType, point: LatLng, confidence: number, accuracyM: number): void {
    // One observation per type per ~15 m per walk (the server counts a walk once per hazard anyway).
    if (this.pending.some((p) => p.body.type === type && distanceM(p.point, point) < 15)) return;
    this.pending.push({
      point,
      createdAt: this.now,
      body: { type, lat: point.lat, lng: point.lng, accuracyM, confidence: Math.round(confidence * 100) / 100, source: 'scan' },
    });
    this.stats.queued++;
  }

  /** Not-seen bookkeeping: a reported hazard 2–10 m ahead during ≥ 2 fresh scans that never showed it (ADR-025). */
  private trackPasses(scan: ScanResult | null): void {
    const fix = this.fix;
    if (!fix || this.heading === null) return;
    for (const h of this.hazards) {
      const d = distanceM(fix, h);
      const st = this.passes.get(h.id) ?? { freshScansInView: 0, sawIt: false, voted: false };
      const ahead = Math.abs(angleDiff(bearingTo(fix, h), this.heading)) <= 30;
      if (scan && d >= 2 && d <= 10 && ahead) {
        st.freshScansInView++;
        if (scan.hazards.some((x) => x.type === h.type) || (h.type === 'no_footpath' && scan.footpath !== 'present')) st.sawIt = true;
      }
      if (!st.voted && !st.sawIt && st.freshScansInView >= 2 && d > 20) {
        st.voted = true;
        this.pending.push({
          point: { lat: h.lat, lng: h.lng },
          createdAt: this.now,
          body: { type: h.type, lat: h.lat, lng: h.lng, accuracyM: fix.accuracy, confidence: 0.7, source: 'scan', notSeen: true, hazardId: h.id },
        });
        this.stats.notSeen++;
      }
      this.passes.set(h.id, st);
    }
  }

  /** Send queued observations that are far enough from both trip ends (PRI-04). */
  private async flush(): Promise<void> {
    const fix = this.fix;
    if (!fix || !this.walkStart) return;
    const cutoff = this.now - 15 * 60_000; // never hold a point longer than 15 min
    this.pending = this.pending.filter((p) => p.createdAt >= cutoff);
    const ready = this.pending.filter((p) => releasable(p.point, this.walkStart!, fix));
    if (ready.length === 0) return;
    this.pending = this.pending.filter((p) => !ready.includes(p));
    for (const p of ready) {
      try {
        const res = await (this.opts.fetchImpl ?? fetch)('/api/observations', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-session-id': this.session },
          body: JSON.stringify(p.body),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) this.stats.sent++;
        else this.stats.failed++;
      } catch {
        this.stats.failed++; // best effort: the walk's alerts never depend on this
      }
    }
  }

  private async refresh(centre: LatLng): Promise<void> {
    this.fetchCentre = { lat: centre.lat, lng: centre.lng };
    const b = [centre.lat - FETCH_HALF_DEG, centre.lng - FETCH_HALF_DEG, centre.lat + FETCH_HALF_DEG, centre.lng + FETCH_HALF_DEG]
      .map((v) => v.toFixed(5))
      .join(',');
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(`/api/hazards?bbox=${b}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const body = (await res.json()) as { hazards?: PublicHazard[] };
      this.hazards = (body.hazards ?? []).filter((h) => h.status === 'confirmed');
    } catch {
      this.fetchCentre = null; // retry on the next fix
    }
  }
}
