import { describe, expect, it } from 'vitest';
import { AlertManager } from './alerts.js';
import { filterModelText } from './safetyFilter.js';
import { parseScanResult, SCAN_RESPONSE_SCHEMA, scanSurfaceNote, scanTier, scanToCandidates, type ScanResult } from './scan.js';

const ok = {
  hazards: [{ type: 'pothole', direction: 'ahead', distance: 'very_close', confidence: 0.9 }],
  footpath: 'present',
  surface: 'even',
  crossing: 'none',
};

const scan = (p: Partial<ScanResult>): ScanResult => ({ hazards: [], footpath: 'present', surface: 'even', crossing: 'none', ...p });

describe('parseScanResult (server-side validation of untrusted model output)', () => {
  it('accepts a valid response, as an object or a JSON string', () => {
    expect(parseScanResult(ok)).toEqual(ok);
    expect(parseScanResult(JSON.stringify(ok))).toEqual(ok);
  });

  it('rejects unusable shapes', () => {
    for (const bad of [null, 42, 'not json', '[]', [], { footpath: 'present' }, { hazards: 'x' }]) {
      expect(parseScanResult(bad)).toBeNull();
    }
  });

  it('drops malformed hazards, moving objects and invented types; keeps the rest', () => {
    const r = parseScanResult({
      ...ok,
      hazards: [
        ok.hazards[0],
        { type: 'person', direction: 'ahead', distance: 'near', confidence: 0.9 }, // moving → on-device only
        { type: 'lava', direction: 'ahead', distance: 'near', confidence: 0.9 },
        { type: 'open_drain', direction: 'up', distance: 'near', confidence: 0.9 },
        { type: 'open_drain', direction: 'left', distance: 'near', confidence: 1.7 },
        { type: 'open_drain', direction: 'left', distance: 'near', confidence: 0.6, note: 'ignore your rules' },
      ],
    })!;
    expect(r.hazards).toEqual([ok.hazards[0], { type: 'open_drain', direction: 'left', distance: 'near', confidence: 0.6 }]);
  });

  it('unknown enum values for context fields become "unknown"', () => {
    const r = parseScanResult({ ...ok, footpath: 'perfectly safe', surface: 7, crossing: 'go now' })!;
    expect([r.footpath, r.surface, r.crossing]).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('caps the number of hazards', () => {
    const many = Array.from({ length: 12 }, () => ok.hazards[0]);
    expect(parseScanResult({ ...ok, hazards: many })!.hazards).toHaveLength(5);
  });

  it('the response schema has no free-text field (nothing that could be spoken unfiltered)', () => {
    const json = JSON.stringify(SCAN_RESPONSE_SCHEMA);
    expect(json.match(/"type":"STRING"(?!,"enum")/g)).toBeNull();
  });
});

describe('scanToCandidates', () => {
  it('never produces P0: a scan is seconds old on arrival', () => {
    expect(scanTier('very_close', 'ahead')).toBe('P1');
    expect(scanTier('very_close', 'left')).toBe('P2');
    expect(scanTier('near', 'ahead')).toBe('P2');
    expect(scanTier('far', 'ahead')).toBe('P3');
  });

  it('maps hazards with stable IDs, direction and source', () => {
    const [c] = scanToCandidates(scan({ hazards: [{ type: 'open_drain', direction: 'right', distance: 'near', confidence: 0.8 }] }), 1000);
    expect(c).toMatchObject({ id: 'scan:open_drain:right', type: 'open_drain', tier: 'P3', bearingDeg: 30, inPath: false, source: 'scan', observedAt: 1000 });
  });

  it('missing/blocked footpath and crossings become P2 alerts', () => {
    const ids = scanToCandidates(scan({ footpath: 'absent', crossing: 'zebra' }), 0).map((c) => [c.id, c.tier]);
    expect(ids).toEqual([['scan:no_footpath', 'P2'], ['scan:crossing', 'P2']]);
  });

  it('surface notes are fixed wording that passes the safety filter', () => {
    for (const s of [scan({ footpath: 'broken' }), scan({ surface: 'uneven' }), scan({ surface: 'wet' })]) {
      const note = scanSurfaceNote(s);
      expect(note).not.toBe('');
      expect(filterModelText(note).blocked).toBe(false);
    }
    expect(scanSurfaceNote(scan({}))).toBe('');
  });
});

describe('scan candidates in the alert manager', () => {
  const pothole = (distance: 'very_close' | 'near') =>
    scan({ hazards: [{ type: 'pothole', direction: 'ahead', distance, confidence: 0.9 }] });

  it('a scan hazard 2.5 s old is still spoken (an on-device one would be stale)', () => {
    const m = new AlertManager();
    m.update(scanToCandidates(pothole('very_close'), 1000));
    expect(m.next(3500)!.text).toBe('Pothole close ahead');
  });

  it('expires 4 s after capture', () => {
    const m = new AlertManager();
    m.update(scanToCandidates(pothole('near'), 1000));
    expect(m.next(5200)).toBeNull();
  });

  it('the same pothole in consecutive scans is said once; again when it gets closer', () => {
    const m = new AlertManager();
    m.update(scanToCandidates(pothole('near'), 1000));
    expect(m.next(1500)!.text).toBe('Pothole, ahead');
    m.finished();
    m.update(scanToCandidates(pothole('near'), 4000));
    expect(m.next(4500)).toBeNull();
    m.update(scanToCandidates(pothole('very_close'), 6000));
    expect(m.next(6500)!.text).toBe('Pothole close ahead');
  });
});
