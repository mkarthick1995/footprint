// Security headers and request limits for every response (R2.7, SEC-02/03/07). Kept in one place so the policy is
// reviewable: what the app is allowed to load and connect to, and how often one client may call the API.
import type { FastifyInstance } from 'fastify';
import { MinuteLimiter } from './limits.js';

/**
 * Content Security Policy. Only our own origin plus what the features need: MediaPipe model files (storage.googleapis.com),
 * WebAssembly for the detector, Google Maps JS on the map page, blob: for the microphone worklet, data: for the silent
 * earbud-session clip. No inline scripts, no plugins, no framing.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob: https://maps.googleapis.com https://maps.gstatic.com",
  "worker-src 'self' blob:",
  "connect-src 'self' https://storage.googleapis.com https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com data: blob:",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  // Origin-only referrer to Google: the Maps key is referrer-locked to our origin; full paths never leave the site.
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'camera=(self), microphone=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), payment=(), usb=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cross-origin-opener-policy': 'same-origin',
};

/** Per-client request budgets per minute (on top of each endpoint's own per-walk limits). */
export const CLIENT_LIMITS: ReadonlyArray<[prefix: string, perMinute: number]> = [
  ['/api/hazards', 60],
  ['/api/route', 12],
  ['/api/map-config', 30],
  ['/api/live', 10], // WebSocket connections opened
  ['/api/', 240], // everything else under /api
];

export function registerSecurity(app: FastifyInstance, opts: { limits?: ReadonlyArray<[string, number]> } = {}): void {
  const limits = (opts.limits ?? CLIENT_LIMITS).map(([prefix, n]) => [prefix, new MinuteLimiter(n)] as const);
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0]!;
    if (!url.startsWith('/api/') || url === '/api/healthz') return;
    const hit = limits.find(([prefix]) => url.startsWith(prefix));
    if (hit && !hit[1].allow(req.ip, Date.now())) {
      reply.header('retry-after', '60');
      return reply.code(429).send({ error: 'rate_limited' });
    }
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) reply.header(k, v);
    return payload;
  });
}
