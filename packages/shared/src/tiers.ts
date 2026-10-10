// Alert tier rules (ADR-022). Pure functions: easy to unit-test, safe to share with the client.
import type { AlertPreset, HazardType, Tier } from './types.js';

/** Thresholds in seconds of time-to-contact. Starting values — tune on clips (SAF-23). */
export const TTC_THRESHOLDS = { p0: 1.5, p1: 4, p2: 10 } as const;

/** Distance (metres) under which an in-path item is imminent regardless of TTC. */
export const IMMINENT_DISTANCE_M = 2;

/**
 * Tier from time-to-contact. Off-path items drop one tier (ADR-022).
 * Unknown/invalid input falls back to the cautious side (SAFETY.md §2).
 */
export function tierFor(ttcSeconds: number, inPath: boolean, distanceM?: number): Tier {
  if (Number.isNaN(ttcSeconds)) return inPath ? 'P1' : 'P2';
  if (inPath && distanceM !== undefined && distanceM < IMMINENT_DISTANCE_M) return 'P0';

  let tier: Tier;
  if (ttcSeconds < TTC_THRESHOLDS.p0) tier = 'P0';
  else if (ttcSeconds < TTC_THRESHOLDS.p1) tier = 'P1';
  else if (ttcSeconds < TTC_THRESHOLDS.p2) tier = 'P2';
  else tier = 'P3';

  return inPath ? tier : downgrade(tier);
}

function downgrade(tier: Tier): Tier {
  switch (tier) {
    case 'P0':
      return 'P1';
    case 'P1':
      return 'P2';
    case 'P2':
      return 'P3';
    default:
      return tier;
  }
}

/** Severity order for tie-breaks within a tier (ADR-022): lower index = more severe. */
export const SEVERITY_ORDER: readonly HazardType[] = [
  'drop_off',
  'open_drain',
  'vehicle',
  'pothole',
  'cyclist',
  'obstruction',
  'person',
  'no_footpath',
  'speed_breaker',
  'crossing',
  'street_furniture',
  'unknown',
];

/** Which tiers a preset allows. P0 and SYS are a floor that can never be disabled (ADR-026, SAF-28). */
export function tierAllowed(tier: Tier, preset: AlertPreset): boolean {
  if (tier === 'P0' || tier === 'SYS') return true;
  if (tier === 'P1') return true;
  if (tier === 'P2') return preset !== 'essential';
  return preset === 'detailed';
}
