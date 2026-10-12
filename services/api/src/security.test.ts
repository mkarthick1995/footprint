import { describe, expect, it } from 'vitest';
import { MemoryStore } from './community.js';
import { CSP } from './security.js';
import { buildServer } from './server.js';

describe('security headers (SEC-07)', () => {
  it('every response carries CSP, nosniff, referrer and permissions policies, HSTS', async () => {
    const app = await buildServer({ webDist: '/nonexistent' });
    const res = await app.inject({ method: 'GET', url: '/api/healthz' });
    expect(res.headers['content-security-policy']).toBe(CSP);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(String(res.headers['permissions-policy'])).toMatch(/microphone=\(self\)/);
    expect(String(res.headers['strict-transport-security'])).toMatch(/max-age=/);
    await app.close();
  });

  it('the policy forbids inline scripts, plugins and framing', () => {
    const script = CSP.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    expect(CSP).toMatch(/object-src 'none'/);
    expect(CSP).toMatch(/frame-ancestors 'none'/);
  });
});

describe('per-client request budgets (SEC-02/03, ST-15)', () => {
  it('limits the hazards endpoint per client; health checks are never limited', async () => {
    const app = await buildServer({ webDist: '/nonexistent', community: { store: new MemoryStore() }, limits: [['/api/hazards', 2], ['/api/', 100]] });
    const get = () => app.inject({ method: 'GET', url: '/api/hazards?bbox=1.27,103.84,1.29,103.86' });
    expect((await get()).statusCode).toBe(200);
    expect((await get()).statusCode).toBe(200);
    const third = await get();
    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toBe('60');
    for (let i = 0; i < 5; i++) expect((await app.inject({ method: 'GET', url: '/api/healthz' })).statusCode).toBe(200);
    await app.close();
  });
});
