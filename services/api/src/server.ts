// Cloud Run service: API + the built web app on one URL (thin slice, ADR-028).
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_DIST = resolve(here, '../../../apps/web/dist');

export interface ServerOptions {
  webDist?: string;
  logger?: boolean;
}

export async function buildServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  // Never log request bodies: they may carry location data (PRI-06).
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024 });

  app.get('/api/healthz', async () => ({ ok: true }));

  // R1.4: mint a Gemini Live ephemeral token (ADR-029). Not implemented yet — fail loudly, never fake success.
  app.post('/api/session-token', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented', item: 'R1.4' }),
  );

  // R2.3: community observations (ADR-020/025).
  app.post('/api/observations', async (_req, reply) =>
    reply.code(501).send({ error: 'not_implemented', item: 'R2.3' }),
  );

  const webDist = opts.webDist ?? DEFAULT_WEB_DIST;
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
  }

  return app;
}
