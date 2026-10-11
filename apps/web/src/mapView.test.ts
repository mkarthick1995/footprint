import { describe, expect, it } from 'vitest';
import type { PublicHazard } from '@footprint/shared';
import { ageText, boxParam, hazardSentence, initialView, queryBox, sortByDistance, MAX_QUERY_DEG } from './mapView';

const DAY = 86_400_000;
const h = (p: Partial<PublicHazard> = {}): PublicHazard => ({
  id: 'abcdef0123', type: 'pothole', lat: 1.3, lng: 103.8, reports: 3, lastSeen: 0, status: 'confirmed', ...p,
});

describe('hazard map helpers', () => {
  it('list sentences say "reported", how many walkers, how long ago (SAF-18)', () => {
    expect(hazardSentence(h(), 2 * DAY)).toBe('Pothole reported by 3 walkers, last 2 days ago');
    expect(hazardSentence(h({ reports: 1, type: 'drop_off' }), 0)).toBe('Kerb or step reported by 1 walker, last today');
    expect(hazardSentence(h(), 0, { lat: 1.3, lng: 103.8018 })).toBe('Pothole reported by 3 walkers, last today, about 200 m from the map centre');
  });

  it('ages read naturally', () => {
    expect(ageText(0, 0)).toBe('today');
    expect(ageText(0, DAY)).toBe('yesterday');
    expect(ageText(0, 10 * DAY)).toBe('10 days ago');
    expect(ageText(0, 30 * DAY)).toBe('4 weeks ago');
  });

  it('a wide view is shrunk to the server limit around its centre, and says so', () => {
    const small = { minLat: 1.29, minLng: 103.8, maxLat: 1.3, maxLng: 103.81 };
    expect(queryBox(small)).toEqual({ box: small, clipped: false });
    const wide = queryBox({ minLat: 1.2, minLng: 103.7, maxLat: 1.4, maxLng: 103.9 });
    expect(wide.clipped).toBe(true);
    expect(wide.box.maxLat - wide.box.minLat).toBeLessThanOrEqual(MAX_QUERY_DEG);
    expect((wide.box.minLat + wide.box.maxLat) / 2).toBeCloseTo(1.3, 6);
    expect(boxParam(small)).toBe('1.29000,103.80000,1.30000,103.81000');
  });

  it('nearest first; URL position overrides the default', () => {
    const far = h({ id: 'far0000000', lat: 1.31 });
    const near = h({ id: 'near000000', lat: 1.3001 });
    expect(sortByDistance([far, near], { lat: 1.3, lng: 103.8 }).map((x) => x.id)).toEqual(['near000000', 'far0000000']);
    const def = { lat: 1, lng: 2, zoom: 16 };
    expect(initialView('?lat=12.97&lng=77.59&z=18', def)).toEqual({ lat: 12.97, lng: 77.59, zoom: 18 });
    expect(initialView('?lat=abc&lng=77', def)).toEqual(def);
    expect(initialView('', def)).toEqual(def);
  });
});
