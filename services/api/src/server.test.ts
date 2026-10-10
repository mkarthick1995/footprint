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

  it('fails loudly on endpoints that are not built yet', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/session-token' });
    expect(res.statusCode).toBe(501);
  });
});
