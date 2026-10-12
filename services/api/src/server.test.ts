import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

const app = await buildServer({ webDist: '/nonexistent' });
afterAll(() => app.close());

describe('api skeleton', () => {
  it('answers health checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('the old token endpoint is gone (Live goes through the /api/live proxy, ADR-030)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/session-token' });
    expect(res.statusCode).toBe(404);
  });
});

describe('map page support (Q8)', () => {
  it('serves the browser Maps key from the environment, or null', async () => {
    const before = process.env.MAPS_BROWSER_KEY;
    process.env.MAPS_BROWSER_KEY = 'test-browser-key';
    const res = await app.inject({ method: 'GET', url: '/api/map-config' });
    expect(res.json()).toEqual({ mapsKey: 'test-browser-key' });
    if (before === undefined) delete process.env.MAPS_BROWSER_KEY;
    else process.env.MAPS_BROWSER_KEY = before;
  });
});
