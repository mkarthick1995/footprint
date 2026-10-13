// Cloud Run service: API + the built web app on one URL (thin slice, ADR-028).
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { FirestoreStore, registerCommunity, type CommunityOptions, type HazardStore } from './community.js';
import { registerRoute, type RouteOptions } from './route.js';
import { registerTts, type TtsOptions } from './tts.js';
import { registerLive, type LiveOptions } from './live.js';
import { registerScan, type ScanOptions } from './scan.js';
import { registerSecurity } from './security.js';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_DIST = resolve(here, '../../../apps/web/dist');

export interface ServerOptions {
  webDist?: string;
  logger?: boolean;
  scan?: ScanOptions;
  community?: CommunityOptions;
  live?: LiveOptions;
  route?: Omit<RouteOptions, 'store'>;
  tts?: TtsOptions;
  /** Override per-client limits (tests). */
  limits?: ReadonlyArray<[string, number]>;
}

export async function buildServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  // Never log request bodies (frames, locations — PRI-06/PRI-10) or client addresses: requests log method + path only.
  // trustProxy: behind Cloud Run's front end, req.ip is the client (used only in memory, for rate limits).
  const app = Fastify({
    logger: opts.logger ? { serializers: { req: (r) => ({ method: r.method, url: r.url }) } } : false,
    bodyLimit: 64 * 1024,
    trustProxy: true,
  });

  // R2.7: security headers on every response + per-client request budgets (SEC-02/03/07).
  registerSecurity(app, { limits: opts.limits });

  app.get('/api/healthz', async () => ({ ok: true }));

  // R1.4: Gemini Live Q&A — WebSocket proxy, transcript text only (ADR-030, SAF-21).
  await registerLive(app, opts.live);

  // R2.2: Gemini scene scan (blurred frame → validated JSON).
  await registerScan(app, opts.scan);

  // R2.3: community hazards — observations in, confirmed hazards out (ADR-020/025).
  let lazyStore: HazardStore | undefined;
  const getStore = (): HazardStore => opts.community?.store ?? (lazyStore ??= new FirestoreStore());
  await registerCommunity(app, { ...opts.community, getStore });

  // R2.1/R2.5 (Q11 lite): walking route → hazards along it → spoken summary (ADR-021/027).
  registerRoute(app, { ...opts.route, store: getStore });

  // R3.4: natural voice for our own (already safety-filtered) words — ADR-041.
  registerTts(app, opts.tts);

  // R2.4: the hazard map page needs the browser Maps key. It is public by design (sent to Google from the browser) and
  // referrer-locked to our URLs; it comes from Secret Manager at runtime so it is never in the repo or the build.
  app.get('/api/map-config', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return { mapsKey: process.env.MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || null };
  });

  const webDist = opts.webDist ?? DEFAULT_WEB_DIST;
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    app.get('/map', async (_req, reply) => reply.sendFile('map.html'));
  }

  return app;
}
