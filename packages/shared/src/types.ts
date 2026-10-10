// Shared contracts between the web client and the API.
// Design references: ADR-019 (perception), ADR-020/025 (community data), ADR-022/023/026 (alerts).

/** Hazard categories. Keep in sync with the Gemini scene-scan response schema. */
export const HAZARD_TYPES = [
  'pothole',
  'no_footpath',
  'open_drain',
  'speed_breaker',
  'obstruction',
  'drop_off',
  'crossing',
  'vehicle',
  'cyclist',
  'person',
  'street_furniture',
  'unknown',
] as const;
export type HazardType = (typeof HAZARD_TYPES)[number];

/** Where an observation came from. */
export type ObservationSource = 'on_device' | 'scan' | 'user_report';

/** Alert tiers (ADR-022). SYS = degradation-ladder announcements, treated like P0. */
export type Tier = 'P0' | 'P1' | 'P2' | 'P3' | 'SYS';

/** Degradation ladder levels (SAFETY.md §2). */
export type LadderLevel = 'L0' | 'L1' | 'L2' | 'L3';

/** User alert presets (ADR-026). P0 and SYS are always on. */
export type AlertPreset = 'essential' | 'standard' | 'detailed';

/** A single anonymous report sent from a walk to the API (ADR-020). No images, no user identity. */
export interface Observation {
  type: HazardType;
  lat: number;
  lng: number;
  /** GPS accuracy radius in metres; observations worse than 25 m are dropped server-side. */
  accuracyM: number;
  /** 0..1 detection confidence. */
  confidence: number;
  source: ObservationSource;
  /** Random per walk; never linked to a person. */
  sessionId: string;
  /** Epoch milliseconds. */
  ts: number;
  /** true when a walker passed the spot and did NOT see a previously reported hazard (ADR-025). */
  notSeen?: boolean;
}

/** A clustered community hazard (ADR-020/025). */
export interface Hazard {
  id: string;
  type: HazardType;
  lat: number;
  lng: number;
  geohash: string;
  /** Distinct walks that reported it. */
  reports: number;
  /** Beta evidence parameters; probability = alpha / (alpha + beta). */
  alpha: number;
  beta: number;
  firstSeen: number;
  lastSeen: number;
  status: 'unconfirmed' | 'confirmed' | 'expired';
}

/** An alert candidate handed to the alert manager — the only component allowed to speak. */
export interface AlertCandidate {
  id: string;
  type: HazardType | 'system';
  tier: Tier;
  /** Seconds until the user reaches it; Infinity when not approaching. */
  ttcSeconds: number;
  /** Bearing in degrees relative to heading (negative = left). */
  bearingDeg: number;
  inPath: boolean;
  confidence: number;
  source: ObservationSource | 'community' | 'system';
  /** Epoch milliseconds when the underlying observation was made. */
  observedAt: number;
}
