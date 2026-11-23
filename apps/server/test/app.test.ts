import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('server', () => {
  it('reports health', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test' }));
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', version: '0.1.0' });
    await app.close();
  });

  it('serves the client with SPA fallback but keeps API 404s as JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nw-client-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>NEON WILDS</title>');
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', CLIENT_DIST: dir }));
    const page = await app.inject({ method: 'GET', url: '/some/deep/link' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('NEON WILDS');
    const api = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'not_found' });
    await app.close();
  });

  it('rejects invalid configuration', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
