import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ServerConfig } from './config.js';

/**
 * Builds the HTTP application. Kept separate from `listen` so tests can use
 * `app.inject()` without opening sockets.
 *
 * Milestone 1 scope: health/version only. Accounts, cloud saves and
 * leaderboards are specified in docs/API.md and land in Milestone 6.
 */
export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: config.logLevel } });

  app.get('/api/v1/health', async () => ({
    status: 'ok' as const,
    version: config.version,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  if (config.clientDist) {
    const root = resolve(config.clientDist);
    if (existsSync(root)) {
      await app.register(fastifyStatic, { root, wildcard: false });
      // Single-page app: unknown non-API GETs fall back to index.html.
      app.setNotFoundHandler((req, reply) => {
        if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
        return reply.code(404).send({ error: 'not_found' });
      });
    } else {
      app.log.warn({ root }, 'CLIENT_DIST does not exist; static client disabled');
    }
  }

  return app;
}
