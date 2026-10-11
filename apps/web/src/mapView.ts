// Hazard map page helpers (Q8): pure formatting and query-box logic, unit-tested. No DOM.
import { distanceM, type LatLng, type PublicHazard } from '@footprint/shared';

/** Server limit for one hazards query (MAX_BBOX_DEG in services/api/src/community.ts). */
export const MAX_QUERY_DEG = 0.05;

const LABEL: Record<PublicHazard['type'], string> = {
  pothole: 'Pothole',
  open_drain: 'Open drain',
  drop_off: 'Kerb or step',
  speed_breaker: 'Speed bump',
  obstruction: 'Obstruction',
  street_furniture: 'Street furniture',
  no_footpath: 'No footpath',
  crossing: 'Crossing',
};

/** Marker colours by type (paired with text labels in the list — never colour alone). */
export const TYPE_COLOR: Record<PublicHazard['type'], string> = {
  pothole: '#c2410c',
  open_drain: '#b91c1c',
  drop_off: '#7c3aed',
  speed_breaker: '#a16207',
  obstruction: '#be185d',
  street_furniture: '#475569',
  no_footpath: '#991b1b',
  crossing: '#1d4ed8',
};

export function hazardLabel(type: PublicHazard['type']): string {
  return LABEL[type] ?? 'Hazard';
}

/** "today", "yesterday", "3 days ago", "5 weeks ago". */
export function ageText(lastSeen: number, now: number): string {
  const days = Math.floor(Math.max(0, now - lastSeen) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/** One list line, readable on its own by a screen reader. Always "reported" (SAF-18). */
export function hazardSentence(h: PublicHazard, now: number, from?: LatLng): string {
  const walkers = h.reports === 1 ? '1 walker' : `${h.reports} walkers`;
  const dist = from ? `, about ${roundDistance(distanceM(from, h))} from the map centre` : '';
  return `${hazardLabel(h.type)} reported by ${walkers}, last ${ageText(h.lastSeen, now)}${dist}`;
}

function roundDistance(m: number): string {
  if (m < 100) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 1000) return `${Math.round(m / 50) * 50} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export interface Box {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/**
 * The box to query for a view. A wide view is shrunk to the server's maximum around its centre, and `clipped` tells the
 * page to say "zoom in to see more" instead of silently showing a partial map.
 */
export function queryBox(view: Box): { box: Box; clipped: boolean } {
  const latSpan = view.maxLat - view.minLat;
  const lngSpan = view.maxLng - view.minLng;
  if (latSpan <= MAX_QUERY_DEG && lngSpan <= MAX_QUERY_DEG) return { box: view, clipped: false };
  const cLat = (view.minLat + view.maxLat) / 2;
  const cLng = (view.minLng + view.maxLng) / 2;
  const h = (MAX_QUERY_DEG * 0.999) / 2;
  return { box: { minLat: cLat - h, minLng: cLng - h, maxLat: cLat + h, maxLng: cLng + h }, clipped: true };
}

export function boxParam(b: Box): string {
  return [b.minLat, b.minLng, b.maxLat, b.maxLng].map((v) => v.toFixed(5)).join(',');
}

/** Sorted nearest-first from the map centre. */
export function sortByDistance(hazards: readonly PublicHazard[], centre: LatLng): PublicHazard[] {
  return [...hazards].sort((a, b) => distanceM(centre, a) - distanceM(centre, b));
}

/** Map position from the URL (?lat=&lng=&z=), else a default. */
export function initialView(search: string, fallback: LatLng & { zoom: number }): LatLng & { zoom: number } {
  const q = new URLSearchParams(search);
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  const zoom = Number(q.get('z'));
  if (q.has('lat') && q.has('lng') && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, zoom: zoom >= 3 && zoom <= 21 ? zoom : 16 };
  }
  return fallback;
}
